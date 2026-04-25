// Entry point for T-11 / T-13. Usage:
//   tsx src/ingest/austin-council.ts --meeting-url <url>
//   tsx src/ingest/austin-council.ts --meeting-id <id> --meeting-guid <guid>
//
// T-11 scope (this file as committed at T-11): fetches MeetingDetail HTML,
// fetches agenda packet PDF text (when present), persists ONE meetings
// row + one agent_sessions row. Does NOT classify items — that's T-13.

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
import type { MeetingRef } from "./legistar/types.js";

// Look for .env.local at the orchestrator package root (./apps/orchestrator/)
// first, then the repo root (../../). Either location works; whichever is
// found first is loaded. This script lives at
// apps/orchestrator/src/ingest/austin-council.ts.
const here = dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  resolve(here, "..", "..", ".env.local"),                  // apps/orchestrator/.env.local
  resolve(here, "..", "..", "..", "..", ".env.local"),      // repo root .env.local
];
for (const p of envCandidates) {
  if (existsSync(p)) {
    loadEnv({ path: p });
    break;
  }
}

interface Args {
  ref: MeetingRef;
}

function parseArgs(argv: string[]): Args {
  const args = new Map<string, string>();
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    if (!flag?.startsWith("--")) continue;
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`flag ${flag} expects a value`);
    }
    args.set(flag.slice(2), value);
    i++;
  }

  const url = args.get("meeting-url");
  if (url) return { ref: parseMeetingRefFromUrl(url) };

  const id = args.get("meeting-id");
  const guid = args.get("meeting-guid");
  if (id && guid) {
    const idNum = Number.parseInt(id, 10);
    if (!Number.isFinite(idNum)) throw new Error(`--meeting-id must be a number, got ${id}`);
    return { ref: { id: idNum, guid } };
  }

  throw new Error(
    "expected --meeting-url <url> OR --meeting-id <id> --meeting-guid <guid>",
  );
}

async function main(): Promise<void> {
  const { ref } = parseArgs(process.argv);
  const sb = supabase();
  const startedAt = new Date().toISOString();

  // Open agent session (status: running). We update finished_at + status at end.
  const { data: session, error: sessionErr } = await sb
    .from("agent_sessions")
    .insert({
      jurisdiction_id: "austin-city-council",
      meeting_id: null,
      runtime: "orchestrator",
      started_at: startedAt,
      status: "running",
      items_processed: 0,
      notes: `T-11 raw ingest for meeting ${ref.id}`,
    })
    .select("id")
    .single();
  if (sessionErr || !session) {
    throw new Error(`failed to open agent_sessions row: ${sessionErr?.message}`);
  }
  const sessionId = session.id as number;

  try {
    const meetingUrl = buildMeetingUrl(ref);
    console.log(`[T-11] fetching ${meetingUrl}`);
    const html = await fetchText(meetingUrl);
    const parsed = parseMeetingHtml(html, ref);
    console.log(
      `[T-11] parsed: ${parsed.body} on ${parsed.meeting_date}, ${parsed.items.length} items`,
    );

    let raw_packet_text: string | null = null;
    if (parsed.agenda_packet_url) {
      console.log(`[T-11] fetching agenda packet PDF: ${parsed.agenda_packet_url}`);
      const pdfBytes = await fetchBuffer(parsed.agenda_packet_url);
      raw_packet_text = await extractPdfText(pdfBytes);
      console.log(`[T-11] extracted ${raw_packet_text.length} chars from packet`);
    } else if (parsed.agenda_url) {
      // Fallback: the agenda URL ?M=A also serves the packet on most meetings
      console.log(`[T-11] no packet URL; falling back to agenda URL: ${parsed.agenda_url}`);
      try {
        const pdfBytes = await fetchBuffer(parsed.agenda_url);
        raw_packet_text = await extractPdfText(pdfBytes);
        console.log(`[T-11] extracted ${raw_packet_text.length} chars from agenda`);
      } catch (err) {
        console.warn(`[T-11] agenda fetch/parse failed: ${(err as Error).message}`);
      }
    } else {
      console.log(`[T-11] no agenda or packet URL on this meeting`);
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
    console.log(`[T-11] persisted meeting row id=${meetingDbId}`);

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
  } catch (err) {
    await sb
      .from("agent_sessions")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        notes: `T-11 raw ingest failed: ${(err as Error).message}`,
      })
      .eq("id", sessionId);
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
