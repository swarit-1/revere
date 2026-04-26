// Computes election scores for a fingerprint and persists briefing_items
// rows of record_kind='election'. Each surfaced race becomes one
// briefing_item with entity_type='race' + entity_id=race.id.
//
//   pnpm elections:score --user maya --briefing-date 2026-04-09
//   pnpm elections:score --user jason --briefing-date 2026-04-09

import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type {
  ElectionCandidate,
  ElectionPromise,
  ElectionRace,
  Fingerprint,
  PromiseSource,
} from "@revere/shared";
import { jurisdictionId } from "@revere/shared";
import { supabase } from "../lib/supabase.js";
import { scoreRace, scorePromise } from "./score.js";

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
  userId: string;
  briefingDate: string;
}

function parseArgs(argv: string[]): Args {
  const args = new Map<string, string>();
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    if (!flag?.startsWith("--")) continue;
    const value = argv[i + 1];
    if (!value) continue;
    args.set(flag.slice(2), value);
    i++;
  }
  const userId = args.get("user");
  const briefingDate = args.get("briefing-date");
  if (!userId || !briefingDate) {
    throw new Error("expected --user <id> --briefing-date YYYY-MM-DD");
  }
  return { userId, briefingDate };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const sb = supabase();
  const startedAt = new Date().toISOString();

  const sessionInsert = await sb
    .from("agent_sessions")
    .insert({
      jurisdiction_id: "austin-city-council", // placeholder; multi-juris race below
      meeting_id: null,
      runtime: "election-scorer",
      started_at: startedAt,
      status: "running",
      items_processed: 0,
      notes: `T-37 election scorer user=${args.userId} date=${args.briefingDate}`,
      subject_type: "user",
      subject_id: args.userId,
      user_id: args.userId,
      briefing_date: args.briefingDate,
    })
    .select("id")
    .single();
  if (sessionInsert.error || !sessionInsert.data) {
    throw new Error(`agent_sessions insert: ${sessionInsert.error?.message}`);
  }
  const sessionId = sessionInsert.data.id as number;

  try {
    // Load fingerprint
    const fpRes = await sb
      .from("fingerprints")
      .select("user_id, fingerprint")
      .eq("user_id", args.userId)
      .single();
    if (fpRes.error || !fpRes.data) {
      throw new Error(`fingerprint load: ${fpRes.error?.message}`);
    }
    const fingerprint = fpRes.data.fingerprint as Fingerprint;

    // Load races + candidates + promises
    const [racesRes, candsRes, promRes] = await Promise.all([
      sb.from("election_races").select("*"),
      sb.from("candidates").select("*"),
      sb.from("candidate_promises").select("*"),
    ]);
    if (racesRes.error) throw new Error(`races load: ${racesRes.error.message}`);
    if (candsRes.error) throw new Error(`cands load: ${candsRes.error.message}`);
    if (promRes.error) throw new Error(`prom load: ${promRes.error.message}`);

    const races: ElectionRace[] = (racesRes.data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      jurisdiction_id: jurisdictionId(r.jurisdiction_id as string),
      level: r.level as ElectionRace["level"],
      office_title: r.office_title as string,
      body: r.body as string,
      district_label: r.district_label as string,
      district_match: r.district_match as ElectionRace["district_match"],
      election_date: r.election_date as string,
      registration_deadline: (r.registration_deadline as string | null) ?? null,
      early_voting_window:
        r.early_voting_start && r.early_voting_end
          ? {
              start: r.early_voting_start as string,
              end: r.early_voting_end as string,
            }
          : null,
      source_url: r.source_url as string,
      notes: (r.notes as string | null) ?? null,
    }));
    const candidates = (candsRes.data ?? []) as unknown as ElectionCandidate[];
    const promises = ((promRes.data ?? []) as unknown as Array<
      ElectionPromise & { source: PromiseSource }
    >).map((p) => p as ElectionPromise);

    console.log(
      `[elections-score] user=${args.userId} races=${races.length} candidates=${candidates.length} promises=${promises.length}`,
    );

    // Score each race + persist a briefing_items row of record_kind='election'.
    let surfacedRaces = 0;
    const trace: Array<{ race_id: string; post_score: number; surfaced: boolean }> = [];
    for (const race of races) {
      const rel = scoreRace(fingerprint, race, candidates, promises, startedAt);
      trace.push({
        race_id: race.id,
        post_score: rel.post_score,
        surfaced: rel.surfaced,
      });
      console.log(
        `[elections-score] ${race.id} → post=${rel.post_score} surfaced=${rel.surfaced}`,
      );
      if (!rel.surfaced) continue;

      // Persist briefing_items row (idempotent via composite unique constraint
      // on user/cid/date — but cid is null here, so we use a manual upsert
      // by deleting any prior race row and inserting fresh).
      await sb
        .from("briefing_items")
        .delete()
        .eq("user_id", args.userId)
        .eq("briefing_date", args.briefingDate)
        .eq("record_kind", "election")
        .eq("entity_type", "race")
        .eq("entity_id", race.id);

      const { error: insErr } = await sb.from("briefing_items").insert({
        user_id: args.userId,
        candidate_item_id: null,
        verification_report_id: null,
        briefing_date: args.briefingDate,
        rank: null,
        pre_score: rel.post_score,
        post_score: rel.post_score,
        surfaced: true,
        surface_reason: "score_above_threshold",
        why_this: rel.why_this,
        score: rel,
        record_kind: "election",
        entity_type: "race",
        entity_id: race.id,
      });
      if (insErr) throw new Error(`briefing_items election insert: ${insErr.message}`);
      surfacedRaces += 1;

      // Score each promise on this race so the per-promise UI ordering
      // is also persisted. We store these in the same briefing_items
      // table for consistency (entity_type='promise').
      const racePromiseRows = promises.filter((p) =>
        candidates.some((c) => c.id === p.candidate_id && c.race_id === race.id),
      );
      for (const promise of racePromiseRows) {
        const pRel = scorePromise(fingerprint, promise, startedAt);
        await sb
          .from("briefing_items")
          .delete()
          .eq("user_id", args.userId)
          .eq("briefing_date", args.briefingDate)
          .eq("record_kind", "election")
          .eq("entity_type", "promise")
          .eq("entity_id", promise.id);
        const { error: pErr } = await sb.from("briefing_items").insert({
          user_id: args.userId,
          candidate_item_id: null,
          verification_report_id: null,
          briefing_date: args.briefingDate,
          rank: null,
          pre_score: pRel.post_score,
          post_score: pRel.post_score,
          surfaced: pRel.post_score > 0,
          surface_reason:
            pRel.post_score > 0 ? "score_above_threshold" : "below_threshold",
          why_this: pRel.why_this,
          score: pRel,
          record_kind: "election",
          entity_type: "promise",
          entity_id: promise.id,
        });
        if (pErr) throw new Error(`briefing_items promise insert: ${pErr.message}`);
      }
    }

    const summary = `T-37 score DONE user=${args.userId} surfaced_races=${surfacedRaces}/${races.length}`;
    console.log(`[elections-score] ${summary}`);

    await sb
      .from("agent_sessions")
      .update({
        finished_at: new Date().toISOString(),
        status: "success",
        items_processed: surfacedRaces,
        notes: `${summary} | trace=${JSON.stringify(trace)}`,
      })
      .eq("id", sessionId);
  } catch (err) {
    await sb
      .from("agent_sessions")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        notes: `T-37 score failed: ${(err as Error).message}`,
      })
      .eq("id", sessionId);
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
