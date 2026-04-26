// Entry point for the Austin Council ingestion pipeline. Usage:
//   tsx src/ingest/austin-council.ts --meeting-url <url>
//   tsx src/ingest/austin-council.ts --meeting-id <id> --meeting-guid <guid>
//
// Two phases run sequentially in one orchestrator session:
// - T-11: fetch MeetingDetail HTML + agenda PDF text, persist meetings row.
// - T-13: for each agenda item, fetch LegislationDetail, classify via
//   Anthropic Messages API + Austin skill pack, upsert candidate_items.
//
// Add --skip-classify to run T-11 only (raw scrape, no classification).

import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { sha256Hex } from "@revere/shared";
import { fetchText, fetchBuffer } from "../lib/fetch.js";
import { extractPdfText } from "../lib/pdf.js";
import { supabase } from "../lib/supabase.js";
import {
  buildMeetingUrl,
  parseMeetingHtml,
  parseMeetingRefFromUrl,
} from "./legistar/meeting.js";
import { parseItemHtml } from "./legistar/item.js";
import type { MeetingRef, ParsedMeetingItem } from "./legistar/types.js";
import { classifyItem } from "./classify.js";
import { upsertCandidateItem } from "./persist.js";
import type { InvokeResult } from "../lib/anthropic.js";

const here = dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  resolve(here, "..", "..", ".env.local"),
  resolve(here, "..", "..", "..", "..", ".env.local"),
];
for (const p of envCandidates) {
  if (existsSync(p)) {
    loadEnv({ path: p });
    break;
  }
}

interface Args {
  ref: MeetingRef;
  skipClassify: boolean;
  itemLimit: number | null;
}

function parseArgs(argv: string[]): Args {
  const args = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    if (!flag?.startsWith("--")) continue;
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      flags.add(flag.slice(2));
      continue;
    }
    args.set(flag.slice(2), value);
    i++;
  }

  let ref: MeetingRef | null = null;
  const url = args.get("meeting-url");
  if (url) ref = parseMeetingRefFromUrl(url);
  else {
    const id = args.get("meeting-id");
    const guid = args.get("meeting-guid");
    if (id && guid) {
      const idNum = Number.parseInt(id, 10);
      if (!Number.isFinite(idNum)) throw new Error(`--meeting-id must be a number, got ${id}`);
      ref = { id: idNum, guid };
    }
  }
  if (!ref) {
    throw new Error(
      "expected --meeting-url <url> OR --meeting-id <id> --meeting-guid <guid>",
    );
  }

  const limitRaw = args.get("limit");
  const itemLimit = limitRaw ? Number.parseInt(limitRaw, 10) : null;

  return { ref, skipClassify: flags.has("skip-classify"), itemLimit };
}

interface CostAccumulator {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  sonnetCalls: number;
  opusCalls: number;
}

const newCost = (): CostAccumulator => ({
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCacheReadTokens: 0,
  totalCacheCreationTokens: 0,
  sonnetCalls: 0,
  opusCalls: 0,
});

function accumulate(c: CostAccumulator, invocations: InvokeResult[]): void {
  for (const inv of invocations) {
    c.totalInputTokens += inv.inputTokens;
    c.totalOutputTokens += inv.outputTokens;
    c.totalCacheReadTokens += inv.cacheReadTokens;
    c.totalCacheCreationTokens += inv.cacheCreationTokens;
    if (inv.model.includes("opus")) c.opusCalls += 1;
    else c.sonnetCalls += 1;
  }
}

async function classifyAndPersistAll(
  parsedItems: ParsedMeetingItem[],
  meetingRefId: number,
  meetingDbId: number,
  meetingDate: string,
  itemLimit: number | null,
): Promise<{ persisted: number; escalations: string[]; cost: CostAccumulator }> {
  const cost = newCost();
  const escalations: string[] = [];
  let persisted = 0;
  const items = itemLimit ? parsedItems.slice(0, itemLimit) : parsedItems;

  for (const meetingItem of items) {
    try {
      const itemHtml = await fetchText(meetingItem.item_url);
      const parsed = parseItemHtml(itemHtml, meetingItem.ref);
      const classifyResult = await classifyItem({
        meeting_id: meetingRefId,
        meeting_date: meetingDate,
        agenda_item_number: meetingItem.agenda_item_number,
        parsed,
        rawHtml: itemHtml,
      });
      accumulate(cost, classifyResult.invocations);
      if (classifyResult.escalated) {
        escalations.push(
          `${parsed.file_id}: ${classifyResult.escalation_reason ?? "(unknown)"}`,
        );
      }
      await upsertCandidateItem({
        meetingDbId,
        item: classifyResult.item,
      });
      persisted += 1;
      const tag = classifyResult.escalated ? " [ESCALATED]" : "";
      console.log(
        `[T-13] (${persisted}/${items.length}) ${parsed.file_id} → topics=${classifyResult.item.topics.join(",")}${tag}`,
      );
    } catch (err) {
      console.warn(
        `[T-13] item ${meetingItem.file_id} FAILED: ${(err as Error).message}`,
      );
    }
  }

  return { persisted, escalations, cost };
}

async function main(): Promise<void> {
  const { ref, skipClassify, itemLimit } = parseArgs(process.argv);
  const sb = supabase();
  const startedAt = new Date().toISOString();
  const phaseTag = skipClassify ? "T-11" : "T-11+T-13";

  const { data: session, error: sessionErr } = await sb
    .from("agent_sessions")
    .insert({
      jurisdiction_id: "austin-city-council",
      meeting_id: null,
      runtime: "orchestrator",
      started_at: startedAt,
      status: "running",
      items_processed: 0,
      notes: `${phaseTag} ingest for meeting ${ref.id}`,
    })
    .select("id")
    .single();
  if (sessionErr || !session) {
    throw new Error(`failed to open agent_sessions row: ${sessionErr?.message}`);
  }
  const sessionId = session.id as number;

  try {
    const meetingUrl = buildMeetingUrl(ref);
    console.log(`[${phaseTag}] fetching ${meetingUrl}`);
    const html = await fetchText(meetingUrl);
    const parsed = parseMeetingHtml(html, ref);
    console.log(
      `[${phaseTag}] parsed: ${parsed.body} on ${parsed.meeting_date}, ${parsed.items.length} items`,
    );

    let raw_packet_text: string | null = null;
    const packetUrl = parsed.agenda_packet_url ?? parsed.agenda_url;
    if (packetUrl) {
      console.log(`[${phaseTag}] fetching agenda PDF: ${packetUrl}`);
      try {
        const pdfBytes = await fetchBuffer(packetUrl);
        raw_packet_text = await extractPdfText(pdfBytes);
        console.log(`[${phaseTag}] extracted ${raw_packet_text.length} chars`);
      } catch (err) {
        console.warn(`[${phaseTag}] PDF fetch/parse failed: ${(err as Error).message}`);
      }
    }

    const source_hash = sha256Hex(html);
    const scraped_at = new Date().toISOString();

    const { data: meetingRow, error: meetingErr } = await sb
      .from("meetings")
      .upsert(
        {
          jurisdiction_id: "austin-city-council",
          legistar_meeting_id: parsed.ref.id,
          legistar_meeting_guid: parsed.ref.guid,
          meeting_date: parsed.meeting_date,
          body: parsed.body,
          location: parsed.location,
          agenda_url: parsed.agenda_url,
          agenda_packet_url: parsed.agenda_packet_url,
          video_url: null,
          raw_html: html,
          raw_packet_text,
          raw_transcript: null,
          scraped_at,
          source_hash,
        },
        {
          onConflict: "jurisdiction_id,legistar_meeting_id,legistar_meeting_guid",
        },
      )
      .select("id")
      .single();

    if (meetingErr || !meetingRow) {
      throw new Error(`failed to upsert meeting: ${meetingErr?.message}`);
    }
    const meetingDbId = meetingRow.id as number;
    console.log(`[${phaseTag}] persisted meeting row id=${meetingDbId}`);

    if (skipClassify) {
      await sb
        .from("agent_sessions")
        .update({
          meeting_id: meetingDbId,
          finished_at: new Date().toISOString(),
          status: "success",
          items_processed: 0,
          notes: `T-11 raw ingest complete: ${parsed.items.length} items enumerated, ${raw_packet_text?.length ?? 0} chars of packet text persisted`,
        })
        .eq("id", sessionId);
      console.log(
        `[T-11] DONE meeting=${meetingDbId} items=${parsed.items.length} packet_chars=${raw_packet_text?.length ?? 0}`,
      );
      return;
    }

    console.log(
      `[T-13] classifying ${itemLimit ?? parsed.items.length} of ${parsed.items.length} items via Anthropic API`,
    );
    const { persisted, escalations, cost } = await classifyAndPersistAll(
      parsed.items,
      parsed.ref.id,
      meetingDbId,
      parsed.meeting_date,
      itemLimit,
    );

    const noteLines = [
      `T-13 classify complete: ${persisted}/${itemLimit ?? parsed.items.length} items persisted`,
      `tokens in/out/cache_read/cache_create: ${cost.totalInputTokens}/${cost.totalOutputTokens}/${cost.totalCacheReadTokens}/${cost.totalCacheCreationTokens}`,
      `model calls: sonnet=${cost.sonnetCalls} opus=${cost.opusCalls}`,
      `escalations: ${escalations.length === 0 ? "none" : escalations.join("; ")}`,
    ];
    await sb
      .from("agent_sessions")
      .update({
        meeting_id: meetingDbId,
        finished_at: new Date().toISOString(),
        status: "success",
        items_processed: persisted,
        notes: noteLines.join(" | "),
      })
      .eq("id", sessionId);

    console.log(`[T-13] DONE meeting=${meetingDbId} persisted=${persisted}`);
    console.log(`[T-13] cost: ${noteLines.slice(1).join(" | ")}`);
  } catch (err) {
    await sb
      .from("agent_sessions")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        notes: `${phaseTag} ingest failed: ${(err as Error).message}`,
      })
      .eq("id", sessionId);
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
