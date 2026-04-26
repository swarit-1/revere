// Entry point for the T-17 fingerprint matcher. Usage:
//   tsx src/match/match.ts --user maya --briefing-date 2026-04-09
//   tsx src/match/match.ts --all-users --briefing-date 2026-04-09
//
// For each (user, candidate_item with a verification_report), runs the LLM
// judgment call, applies the scoring rubric, persists a briefing_items row.
// Filters out candidates whose latest verification_report has overall_verdict
// = fail or halt_stale.

import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Fingerprint, Item } from "@revere/shared";
import { supabase } from "../lib/supabase.js";
import { judgeItem } from "./judgments.js";
import { scoreItem } from "./scoring.js";
import { upsertBriefingItem } from "./persist.js";
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
  userIds: string[];
  briefingDate: string;
  allUsers: boolean;
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
  const briefingDate = args.get("briefing-date");
  if (!briefingDate || !/^\d{4}-\d{2}-\d{2}$/.test(briefingDate)) {
    throw new Error("expected --briefing-date YYYY-MM-DD");
  }
  const userArg = args.get("user");
  const allUsers = flags.has("all-users");
  if (!userArg && !allUsers) {
    throw new Error("expected --user <id> OR --all-users");
  }
  return {
    userIds: userArg ? [userArg] : [],
    briefingDate,
    allUsers,
  };
}

interface FingerprintRow {
  user_id: string;
  fingerprint: Fingerprint;
  updated_at: string;
}

async function loadFingerprints(args: Args): Promise<FingerprintRow[]> {
  const sb = supabase();
  const q = sb.from("fingerprints").select("user_id, fingerprint, updated_at");
  const { data, error } = args.allUsers
    ? await q
    : await q.in("user_id", args.userIds);
  if (error || !data) {
    throw new Error(`failed to load fingerprints: ${error?.message}`);
  }
  return data.map((r) => ({
    user_id: r.user_id as string,
    fingerprint: r.fingerprint as Fingerprint,
    updated_at: r.updated_at as string,
  }));
}

interface VerifiedCandidate {
  candidate_item_id: number;
  verification_report_id: number;
  item: Item;
}

async function loadVerifiedCandidates(): Promise<VerifiedCandidate[]> {
  // Pick the latest verification_report per candidate_item; drop fail / halt_stale.
  const sb = supabase();
  const { data, error } = await sb
    .from("verification_reports")
    .select("id, candidate_item_id, overall_verdict, verified_at, candidate_items!inner(id, item)")
    .in("overall_verdict", ["pass_clean", "pass_with_caveats"])
    .order("verified_at", { ascending: false });
  if (error || !data) {
    throw new Error(`failed to load verified candidates: ${error?.message}`);
  }
  // Dedup: keep latest per candidate_item_id.
  const byCandidate = new Map<number, VerifiedCandidate>();
  for (const row of data) {
    const cid = row.candidate_item_id as number;
    if (byCandidate.has(cid)) continue;
    const item = (row as unknown as { candidate_items: { item: Item } }).candidate_items.item;
    byCandidate.set(cid, {
      candidate_item_id: cid,
      verification_report_id: row.id as number,
      item,
    });
  }
  return [...byCandidate.values()];
}

interface CostAccumulator {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  calls: number;
}

const newCost = (): CostAccumulator => ({
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCacheReadTokens: 0,
  totalCacheCreationTokens: 0,
  calls: 0,
});

function accumulate(c: CostAccumulator, inv: InvokeResult): void {
  c.totalInputTokens += inv.inputTokens;
  c.totalOutputTokens += inv.outputTokens;
  c.totalCacheReadTokens += inv.cacheReadTokens;
  c.totalCacheCreationTokens += inv.cacheCreationTokens;
  c.calls += 1;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const sb = supabase();
  const startedAt = new Date().toISOString();

  const { data: session, error: sessionErr } = await sb
    .from("agent_sessions")
    .insert({
      jurisdiction_id: "austin-city-council",
      meeting_id: null,
      runtime: "matcher",
      started_at: startedAt,
      status: "running",
      items_processed: 0,
      notes: `T-17 match for ${args.allUsers ? "all users" : args.userIds.join(",")} on ${args.briefingDate}`,
    })
    .select("id")
    .single();
  if (sessionErr || !session) {
    throw new Error(`failed to open agent_sessions row: ${sessionErr?.message}`);
  }
  const sessionId = session.id as number;

  try {
    const fps = await loadFingerprints(args);
    if (fps.length === 0) {
      throw new Error(
        `no fingerprints matched (${args.allUsers ? "--all-users" : args.userIds.join(",")})`,
      );
    }
    const candidates = await loadVerifiedCandidates();
    console.log(
      `[T-17] ${fps.length} users × ${candidates.length} verified candidates = ${fps.length * candidates.length} (user,item) pairs`,
    );

    const cost = newCost();
    let persisted = 0;
    const surfaceCounts: Record<string, { surfaced: number; total: number }> = {};

    for (const fp of fps) {
      surfaceCounts[fp.user_id] = { surfaced: 0, total: 0 };
      for (const cand of candidates) {
        try {
          const judgeResult = await judgeItem({
            fingerprint: fp.fingerprint,
            item: cand.item,
          });
          accumulate(cost, judgeResult.invocation);
          const score = scoreItem({
            fingerprint: fp.fingerprint,
            item: cand.item,
            judgments: judgeResult.judgments,
            fingerprint_version_used: fp.updated_at,
            scored_at: new Date().toISOString(),
            // Anchor action_window calculations to the briefing_date the user
            // is constructing — not real-now. The rubric's action_window_boost
            // models "decision-imminent for THIS briefing"; computing it
            // against today would zero the boost on any meeting we ingested
            // more than a week ago, even if the briefing_date is the meeting
            // date itself.
            verified_at: `${args.briefingDate}T00:00:00Z`,
          });
          await upsertBriefingItem({
            user_id: fp.user_id,
            candidate_item_id: cand.candidate_item_id,
            verification_report_id: cand.verification_report_id,
            briefing_date: args.briefingDate,
            score,
          });
          persisted += 1;
          surfaceCounts[fp.user_id]!.total += 1;
          if (score.surfaced) surfaceCounts[fp.user_id]!.surfaced += 1;
          if (persisted % 10 === 0 || score.surfaced) {
            console.log(
              `[T-17] (${persisted}) ${fp.user_id} × ${cand.item.id} → post=${score.post_score.toFixed(2)} ${score.surface_reason}${score.surfaced ? " ✓" : ""}`,
            );
          }
        } catch (err) {
          console.warn(
            `[T-17] ${fp.user_id} × ${cand.item.id} FAILED: ${(err as Error).message}`,
          );
        }
      }
    }

    const surfaceLine = Object.entries(surfaceCounts)
      .map(([u, c]) => `${u}=${c.surfaced}/${c.total}`)
      .join(" ");
    const noteLines = [
      `T-17 match complete: ${persisted} briefing_items persisted`,
      `surfaced: ${surfaceLine}`,
      `tokens in/out/cache_read/cache_create: ${cost.totalInputTokens}/${cost.totalOutputTokens}/${cost.totalCacheReadTokens}/${cost.totalCacheCreationTokens}`,
      `sonnet calls: ${cost.calls}`,
    ];
    await sb
      .from("agent_sessions")
      .update({
        finished_at: new Date().toISOString(),
        status: "success",
        items_processed: persisted,
        notes: noteLines.join(" | "),
      })
      .eq("id", sessionId);
    console.log(`[T-17] DONE persisted=${persisted}`);
    console.log(`[T-17] ${noteLines.join(" | ")}`);
  } catch (err) {
    await sb
      .from("agent_sessions")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        notes: `T-17 match failed: ${(err as Error).message}`,
      })
      .eq("id", sessionId);
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
