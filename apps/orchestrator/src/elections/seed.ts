// Seeds the election fixtures into Supabase. Idempotent — upserts on
// the primary keys, so re-running is safe. Logs an agent_sessions
// row of runtime='election-seed' so the trace surface shows the seed
// run alongside other ingestion sessions.
//
//   pnpm elections:seed

import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { supabase } from "../lib/supabase.js";
import { FIXTURE_RACES, FIXTURE_CANDIDATES, FIXTURE_PROMISES } from "./fixtures.js";

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

async function main(): Promise<void> {
  const sb = supabase();
  const startedAt = new Date().toISOString();

  const sessionInsert = await sb
    .from("agent_sessions")
    .insert({
      jurisdiction_id: "austin-city-council",
      meeting_id: null,
      runtime: "election-seed",
      started_at: startedAt,
      status: "running",
      items_processed: 0,
      notes: "elections fixture seed: 3 races, 6 candidates, ~30 promises",
      subject_type: "election-seed",
      subject_id: null,
    })
    .select("id")
    .single();
  if (sessionInsert.error || !sessionInsert.data) {
    throw new Error(`agent_sessions insert: ${sessionInsert.error?.message}`);
  }
  const sessionId = sessionInsert.data.id as number;

  try {
    console.log(`[elections-seed] inserting ${FIXTURE_RACES.length} races`);
    for (const r of FIXTURE_RACES) {
      const { error } = await sb
        .from("election_races")
        .upsert({
          id: r.id,
          jurisdiction_id: r.jurisdiction_id,
          level: r.level,
          office_title: r.office_title,
          body: r.body,
          district_label: r.district_label,
          district_match: r.district_match,
          election_date: r.election_date,
          registration_deadline: r.registration_deadline,
          early_voting_start: r.early_voting_window?.start ?? null,
          early_voting_end: r.early_voting_window?.end ?? null,
          source_url: r.source_url,
          notes: r.notes ?? null,
        });
      if (error) throw new Error(`races upsert ${r.id}: ${error.message}`);
    }

    console.log(`[elections-seed] inserting ${FIXTURE_CANDIDATES.length} candidates`);
    for (const c of FIXTURE_CANDIDATES) {
      const { error } = await sb.from("candidates").upsert({
        id: c.id,
        race_id: c.race_id,
        display_name: c.display_name,
        campaign_url: c.campaign_url ?? null,
        status: c.status,
        notes: c.notes ?? null,
      });
      if (error) throw new Error(`candidates upsert ${c.id}: ${error.message}`);
    }

    console.log(`[elections-seed] inserting ${FIXTURE_PROMISES.length} promises`);
    for (const p of FIXTURE_PROMISES) {
      const { error } = await sb.from("candidate_promises").upsert({
        id: p.id,
        candidate_id: p.candidate_id,
        topic: p.topic,
        text: p.text,
        source: p.source,
        authority: p.authority,
        authority_rationale: p.authority_rationale,
        specificity: p.specificity,
        topics: p.topics,
      });
      if (error) throw new Error(`promises upsert ${p.id}: ${error.message}`);
    }

    const summary = `seed complete: races=${FIXTURE_RACES.length} candidates=${FIXTURE_CANDIDATES.length} promises=${FIXTURE_PROMISES.length}`;
    console.log(`[elections-seed] ${summary}`);

    await sb
      .from("agent_sessions")
      .update({
        finished_at: new Date().toISOString(),
        status: "success",
        items_processed:
          FIXTURE_RACES.length +
          FIXTURE_CANDIDATES.length +
          FIXTURE_PROMISES.length,
        notes: summary,
      })
      .eq("id", sessionId);
  } catch (err) {
    await sb
      .from("agent_sessions")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        notes: `elections seed failed: ${(err as Error).message}`,
      })
      .eq("id", sessionId);
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
