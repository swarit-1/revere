// Entry point for the T-15 verification loop. Usage:
//   tsx src/verify/verify.ts --meeting <meeting_db_id>
//   tsx src/verify/verify.ts --all-unverified
//
// Iterates candidate_items, builds sources_map per item, invokes the verifier
// via Anthropic Messages API, persists verification_reports rows. Tracks
// per-run cost in agent_sessions.notes.

import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Item, OverallVerdict } from "@revere/shared";
import { supabase } from "../lib/supabase.js";
import { verifyItem } from "./verify-item.js";
import { insertVerificationReport } from "./persist.js";
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
  meetingDbId: number | null;
  allUnverified: boolean;
  itemLimit: number | null;
  itemFileIds: string[] | null; // subset of file_ids to re-verify (e.g. truncated reports)
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

  const meetingRaw = args.get("meeting");
  const meetingDbId = meetingRaw ? Number.parseInt(meetingRaw, 10) : null;
  const limitRaw = args.get("limit");
  const itemLimit = limitRaw ? Number.parseInt(limitRaw, 10) : null;
  const allUnverified = flags.has("all-unverified");
  const itemsRaw = args.get("items");
  const itemFileIds = itemsRaw ? itemsRaw.split(",").map((s) => s.trim()).filter(Boolean) : null;

  if (!meetingDbId && !allUnverified) {
    throw new Error("expected --meeting <db_id> OR --all-unverified");
  }
  return { meetingDbId, allUnverified, itemLimit, itemFileIds };
}

interface CostAccumulator {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  opusCalls: number;
}

const newCost = (): CostAccumulator => ({
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCacheReadTokens: 0,
  totalCacheCreationTokens: 0,
  opusCalls: 0,
});

function accumulate(c: CostAccumulator, inv: InvokeResult): void {
  c.totalInputTokens += inv.inputTokens;
  c.totalOutputTokens += inv.outputTokens;
  c.totalCacheReadTokens += inv.cacheReadTokens;
  c.totalCacheCreationTokens += inv.cacheCreationTokens;
  c.opusCalls += 1;
}

interface CandidateRow {
  id: number;
  item: Item;
}

async function loadCandidates(args: Args): Promise<{ rows: CandidateRow[]; agendaPdfText: string | null }> {
  const sb = supabase();
  if (args.meetingDbId !== null) {
    const { data: meetingRow, error: meetingErr } = await sb
      .from("meetings")
      .select("raw_packet_text")
      .eq("id", args.meetingDbId)
      .single();
    if (meetingErr || !meetingRow) {
      throw new Error(`meeting ${args.meetingDbId} not found: ${meetingErr?.message}`);
    }
    const { data, error } = await sb
      .from("candidate_items")
      .select("id, item")
      .eq("meeting_id", args.meetingDbId)
      .order("item_file_id", { ascending: true });
    if (error || !data) {
      throw new Error(`failed to load candidate_items: ${error?.message}`);
    }
    return {
      rows: data.map((r) => ({ id: r.id as number, item: r.item as Item })),
      agendaPdfText: (meetingRow.raw_packet_text as string | null) ?? null,
    };
  }

  // --all-unverified: candidate_items lacking a verification_reports row.
  const { data, error } = await sb.rpc("noop_unverified_query");
  if (error) {
    // Simple alternative if no RPC: fetch all candidates, then filter on
    // missing reports client-side.
    const { data: cands, error: candErr } = await sb
      .from("candidate_items")
      .select("id, item, meeting_id")
      .order("id", { ascending: true });
    if (candErr || !cands) throw new Error(`failed to load candidates: ${candErr?.message}`);
    const ids = cands.map((c) => c.id as number);
    const { data: reports, error: repErr } = await sb
      .from("verification_reports")
      .select("candidate_item_id")
      .in("candidate_item_id", ids);
    if (repErr || !reports) throw new Error(`failed to load reports: ${repErr?.message}`);
    const verified = new Set(reports.map((r) => r.candidate_item_id as number));
    const unverified = cands.filter((c) => !verified.has(c.id as number));
    // No single agenda PDF when scanning across meetings; would need per-row lookup.
    // For v1 --all-unverified is best-effort; T-19 wraps a per-meeting loop.
    return {
      rows: unverified.map((r) => ({ id: r.id as number, item: r.item as Item })),
      agendaPdfText: null,
    };
  }
  return { rows: (data as CandidateRow[]) ?? [], agendaPdfText: null };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const sb = supabase();
  const startedAt = new Date().toISOString();

  const { data: session, error: sessionErr } = await sb
    .from("agent_sessions")
    .insert({
      jurisdiction_id: "austin-city-council",
      meeting_id: args.meetingDbId,
      runtime: "verifier",
      started_at: startedAt,
      status: "running",
      items_processed: 0,
      notes: `T-15 verify ${args.meetingDbId ? `meeting ${args.meetingDbId}` : "--all-unverified"}`,
    })
    .select("id")
    .single();
  if (sessionErr || !session) {
    throw new Error(`failed to open agent_sessions row: ${sessionErr?.message}`);
  }
  const sessionId = session.id as number;

  try {
    const { rows, agendaPdfText } = await loadCandidates(args);
    let items = args.itemLimit ? rows.slice(0, args.itemLimit) : rows;
    if (args.itemFileIds) {
      const wanted = new Set(args.itemFileIds);
      items = items.filter((r) => wanted.has(r.item.id));
    }
    console.log(`[T-15] verifying ${items.length} candidate_items`);

    const cost = newCost();
    const verdictCounts: Record<OverallVerdict, number> = {
      pass_clean: 0,
      pass_with_caveats: 0,
      fail: 0,
      halt_stale: 0,
    };
    let driftCount = 0;
    let failures = 0;

    for (let i = 0; i < items.length; i++) {
      const row = items[i]!;
      const fileId = row.item.id;
      try {
        const result = await verifyItem({
          item: row.item,
          agendaPdfText,
        });
        accumulate(cost, result.invocation);
        verdictCounts[result.report.overall_verdict] += 1;
        if (result.drift_detected) driftCount += 1;
        await insertVerificationReport({
          candidate_item_id: row.id,
          report: result.report,
        });
        console.log(
          `[T-15] (${i + 1}/${items.length}) ${fileId} → ${result.report.overall_verdict} (${result.report.coverage.total_claims} claims)`,
        );
      } catch (err) {
        failures += 1;
        console.warn(
          `[T-15] item ${fileId} FAILED: ${(err as Error).message}`,
        );
      }
    }

    const noteLines = [
      `T-15 verify complete: ${items.length - failures}/${items.length} reports persisted, ${failures} failures`,
      `verdicts: pass_clean=${verdictCounts.pass_clean} pass_with_caveats=${verdictCounts.pass_with_caveats} fail=${verdictCounts.fail} halt_stale=${verdictCounts.halt_stale}`,
      `drift_detected: ${driftCount}`,
      `tokens in/out/cache_read/cache_create: ${cost.totalInputTokens}/${cost.totalOutputTokens}/${cost.totalCacheReadTokens}/${cost.totalCacheCreationTokens}`,
      `opus calls: ${cost.opusCalls}`,
    ];

    await sb
      .from("agent_sessions")
      .update({
        finished_at: new Date().toISOString(),
        status: "success",
        items_processed: items.length - failures,
        notes: noteLines.join(" | "),
      })
      .eq("id", sessionId);

    console.log(`[T-15] DONE persisted=${items.length - failures}`);
    console.log(`[T-15] ${noteLines.join(" | ")}`);
  } catch (err) {
    await sb
      .from("agent_sessions")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        notes: `T-15 verify failed: ${(err as Error).message}`,
      })
      .eq("id", sessionId);
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
