// Entry point for the T-21 adversarial draft loop. Usage:
//   tsx src/draft/draft.ts --candidate <id> --user <maya|jason>
//   tsx src/draft/draft.ts --candidate <id> --user <fp> --dry-run

import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Fingerprint, Item, VerificationReport } from "@revere/shared";
import { supabase } from "../lib/supabase.js";
import { runDraftLoop, loopVersion } from "./loop.js";
import { persistDrafts } from "./persist.js";
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
  candidateId: number;
  userId: string;
  dryRun: boolean;
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
  const cidRaw = args.get("candidate");
  const userId = args.get("user");
  if (!cidRaw || !userId) {
    throw new Error("expected --candidate <id> --user <maya|jason>");
  }
  return {
    candidateId: Number.parseInt(cidRaw, 10),
    userId,
    dryRun: flags.has("dry-run"),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const sb = supabase();
  const startedAt = new Date().toISOString();

  // Open agent_sessions row for the trace surface.
  const sessionInsert = await sb
    .from("agent_sessions")
    .insert({
      jurisdiction_id: "austin-city-council",
      meeting_id: null,
      runtime: "drafter",
      started_at: startedAt,
      status: "running",
      items_processed: 0,
      notes: `T-21 draft candidate=${args.candidateId} user=${args.userId}`,
    })
    .select("id")
    .single();
  if (sessionInsert.error || !sessionInsert.data) {
    throw new Error(`agent_sessions insert: ${sessionInsert.error?.message}`);
  }
  const sessionId = sessionInsert.data.id as number;

  try {
    // 1. Load candidate item.
    const candRes = await sb
      .from("candidate_items")
      .select("id, item")
      .eq("id", args.candidateId)
      .single();
    if (candRes.error || !candRes.data) {
      throw new Error(`candidate_items load: ${candRes.error?.message}`);
    }
    const item = candRes.data.item as Item;

    // 2. Load fingerprint.
    const fpRes = await sb
      .from("fingerprints")
      .select("user_id, fingerprint")
      .eq("user_id", args.userId)
      .single();
    if (fpRes.error || !fpRes.data) {
      throw new Error(`fingerprint load: ${fpRes.error?.message}`);
    }
    const fingerprint = fpRes.data.fingerprint as Fingerprint;

    // 3. Load latest verification_report.
    const vrRes = await sb
      .from("verification_reports")
      .select("report")
      .eq("candidate_item_id", args.candidateId)
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (vrRes.error) {
      throw new Error(`verification_report load: ${vrRes.error.message}`);
    }
    if (!vrRes.data) {
      throw new Error(
        `no verification_report for candidate ${args.candidateId} — run verify first`,
      );
    }
    const verification = vrRes.data.report as VerificationReport;

    console.log(
      `[T-21] item=${item.id} user=${args.userId} verified_claims=${verification.claims.filter((c) => c.verdict === "supported").length}`,
    );

    // 4. Run the loop.
    const result = await runDraftLoop({ item, fingerprint, verification });

    // 5. Aggregate cost.
    const cost = aggregate(result.invocations);
    console.log(
      `[T-21] cost: in=${cost.input} out=${cost.output} cache_read=${cost.cache_read} cache_create=${cost.cache_create} calls=${result.invocations.length}`,
    );

    // 6. Print summary.
    for (const v of result.variants) {
      const wordCount = v.text.split(/\s+/).filter(Boolean).length;
      console.log(
        `[T-21] variant=${v.voice} words=${wordCount} refs=${v.references.join(",")} trail=${v.critique_trail.length}`,
      );
    }

    // 7. Persist (unless dry-run).
    if (!args.dryRun) {
      const ids = await persistDrafts({
        sb,
        candidate_item_id: args.candidateId,
        user_id: args.userId,
        variants: result.variants,
        writer_version: "v1",
        loop_version: loopVersion(),
        cost_tokens: cost,
      });
      console.log(`[T-21] persisted draft ids: ${ids.join(",")}`);
    } else {
      console.log("[T-21] dry-run: skipping persist");
    }

    await sb
      .from("agent_sessions")
      .update({
        finished_at: new Date().toISOString(),
        status: "success",
        items_processed: 3,
        notes: `T-21 draft DONE candidate=${args.candidateId} user=${args.userId} | calls=${result.invocations.length} | tokens in/out/cache_read/cache_create: ${cost.input}/${cost.output}/${cost.cache_read}/${cost.cache_create}`,
      })
      .eq("id", sessionId);
  } catch (err) {
    await sb
      .from("agent_sessions")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        notes: `T-21 draft failed: ${(err as Error).message}`,
      })
      .eq("id", sessionId);
    throw err;
  }
}

interface CostTotals {
  input: number;
  output: number;
  cache_read: number;
  cache_create: number;
}

function aggregate(invocations: InvokeResult[]): CostTotals {
  const t = { input: 0, output: 0, cache_read: 0, cache_create: 0 };
  for (const inv of invocations) {
    t.input += inv.inputTokens;
    t.output += inv.outputTokens;
    t.cache_read += inv.cacheReadTokens;
    t.cache_create += inv.cacheCreationTokens;
  }
  return t;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
