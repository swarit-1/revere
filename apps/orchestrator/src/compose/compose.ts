// Entry point for the T-18 briefing composer. Usage:
//   tsx src/compose/compose.ts --user maya --briefing-date 2026-04-09
//   tsx src/compose/compose.ts --all-users --briefing-date 2026-04-09
//
// Per (user, briefing_date), composes a briefings row from surfaced
// briefing_items and updates briefing_items.rank for ordering.

import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { supabase } from "../lib/supabase.js";
import { compose } from "./compose-briefing.js";

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

async function loadFingerprintUsers(allUsers: boolean, userIds: string[]): Promise<{ user_id: string; updated_at: string }[]> {
  const sb = supabase();
  const q = sb.from("fingerprints").select("user_id, updated_at");
  const { data, error } = allUsers ? await q : await q.in("user_id", userIds);
  if (error || !data) {
    throw new Error(`failed to load fingerprints: ${error?.message}`);
  }
  return data.map((r) => ({
    user_id: r.user_id as string,
    updated_at: r.updated_at as string,
  }));
}

async function loadCoverageStats(): Promise<{ candidate_items_considered: number; verified: number }> {
  const sb = supabase();
  const { count: candCount, error: candErr } = await sb
    .from("candidate_items")
    .select("*", { count: "exact", head: true });
  if (candErr) throw new Error(`candidate_items count failed: ${candErr.message}`);
  const { count: verCount, error: verErr } = await sb
    .from("verification_reports")
    .select("*", { count: "exact", head: true })
    .in("overall_verdict", ["pass_clean", "pass_with_caveats"]);
  if (verErr) throw new Error(`verification_reports count failed: ${verErr.message}`);
  return { candidate_items_considered: candCount ?? 0, verified: verCount ?? 0 };
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
      runtime: "composer",
      started_at: startedAt,
      status: "running",
      items_processed: 0,
      notes: `T-18 compose for ${args.allUsers ? "all users" : args.userIds.join(",")} on ${args.briefingDate}`,
    })
    .select("id")
    .single();
  if (sessionErr || !session) {
    throw new Error(`failed to open agent_sessions row: ${sessionErr?.message}`);
  }
  const sessionId = session.id as number;

  try {
    const fps = await loadFingerprintUsers(args.allUsers, args.userIds);
    if (fps.length === 0) {
      throw new Error("no fingerprints matched");
    }
    const coverage = await loadCoverageStats();
    console.log(
      `[T-18] composing for ${fps.length} user(s), coverage ${coverage.verified}/${coverage.candidate_items_considered} verified`,
    );

    let totalIn = 0, totalOut = 0, totalCacheRead = 0, totalCacheCreate = 0, calls = 0;
    let composed = 0;

    for (const fp of fps) {
      const result = await compose({
        user_id: fp.user_id,
        briefing_date: args.briefingDate,
        fingerprint_version_used: fp.updated_at,
        candidate_items_considered: coverage.candidate_items_considered,
        verified: coverage.verified,
      });
      composed += 1;
      if (result.invocation.kind === "invoked") {
        const inv = result.invocation.invocation;
        totalIn += inv.inputTokens;
        totalOut += inv.outputTokens;
        totalCacheRead += inv.cacheReadTokens;
        totalCacheCreate += inv.cacheCreationTokens;
        calls += 1;
      }
      const top = result.payload.items[0];
      console.log(
        `[T-18] ${fp.user_id} → briefing_id=${result.briefingId} surfaced=${result.surfacedCount}${top ? ` top="${top.headline.slice(0, 60)}"` : " (empty)"}`,
      );
    }

    const noteLines = [
      `T-18 compose complete: ${composed} briefings persisted`,
      `tokens in/out/cache_read/cache_create: ${totalIn}/${totalOut}/${totalCacheRead}/${totalCacheCreate}`,
      `opus calls: ${calls}`,
    ];
    await sb
      .from("agent_sessions")
      .update({
        finished_at: new Date().toISOString(),
        status: "success",
        items_processed: composed,
        notes: noteLines.join(" | "),
      })
      .eq("id", sessionId);

    console.log(`[T-18] DONE composed=${composed}`);
    console.log(`[T-18] ${noteLines.join(" | ")}`);
  } catch (err) {
    await sb
      .from("agent_sessions")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        notes: `T-18 compose failed: ${(err as Error).message}`,
      })
      .eq("id", sessionId);
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
