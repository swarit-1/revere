// Ballot mode queries. Loads races + candidates + promises and joins
// them to per-user PromiseRelevance rows persisted in briefing_items
// (record_kind='election', entity_type='promise').

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ElectionCandidate,
  ElectionPromise,
  ElectionRace,
  PromiseRelevance,
  PromiseSource,
  RaceRelevance,
} from "@revere/shared";
import { jurisdictionId } from "@revere/shared";

export interface BallotRace {
  race: ElectionRace;
  // Per-user race relevance (sorts the list).
  relevance: RaceRelevance | null;
  // Two columns of candidates with their per-user-scored promises.
  columns: BallotCandidateColumn[];
}

export interface BallotCandidateColumn {
  candidate: ElectionCandidate;
  promises: BallotPromise[];
}

export interface BallotPromise {
  promise: ElectionPromise;
  relevance: PromiseRelevance | null;
}

interface RaceRow {
  id: string;
  jurisdiction_id: string;
  level: ElectionRace["level"];
  office_title: string;
  body: string;
  district_label: string;
  district_match: ElectionRace["district_match"];
  election_date: string;
  registration_deadline: string | null;
  early_voting_start: string | null;
  early_voting_end: string | null;
  source_url: string;
  notes: string | null;
}

function rowToRace(r: RaceRow): ElectionRace {
  return {
    id: r.id,
    jurisdiction_id: jurisdictionId(r.jurisdiction_id),
    level: r.level,
    office_title: r.office_title,
    body: r.body,
    district_label: r.district_label,
    district_match: r.district_match,
    election_date: r.election_date,
    registration_deadline: r.registration_deadline,
    early_voting_window:
      r.early_voting_start && r.early_voting_end
        ? { start: r.early_voting_start, end: r.early_voting_end }
        : null,
    source_url: r.source_url,
    notes: r.notes,
  };
}

export async function loadBallotForUser(
  admin: SupabaseClient,
  userId: string,
  briefingDate: string,
): Promise<BallotRace[]> {
  // 1. Load all races / candidates / promises (small fixture set).
  const [racesRes, candsRes, promRes] = await Promise.all([
    admin.from("election_races").select("*").order("election_date", { ascending: true }),
    admin.from("candidates").select("*"),
    admin.from("candidate_promises").select("*"),
  ]);
  if (racesRes.error) throw new Error(`ballot races: ${racesRes.error.message}`);
  if (candsRes.error) throw new Error(`ballot candidates: ${candsRes.error.message}`);
  if (promRes.error) throw new Error(`ballot promises: ${promRes.error.message}`);

  const races = (racesRes.data ?? []).map((r) => rowToRace(r as RaceRow));
  const candidates = (candsRes.data ?? []) as unknown as ElectionCandidate[];
  const promises = ((promRes.data ?? []) as unknown as Array<
    ElectionPromise & { source: PromiseSource }
  >).map((p) => p as ElectionPromise);

  // 2. Load per-user election briefing_items (race + promise relevance).
  const { data: rels, error: relErr } = await admin
    .from("briefing_items")
    .select("entity_type, entity_id, score, post_score, surfaced")
    .eq("user_id", userId)
    .eq("briefing_date", briefingDate)
    .eq("record_kind", "election");
  if (relErr) throw new Error(`ballot relevance: ${relErr.message}`);

  const raceRelevance = new Map<string, RaceRelevance>();
  const promiseRelevance = new Map<string, PromiseRelevance>();
  for (const r of (rels ?? []) as Array<{
    entity_type: string;
    entity_id: string;
    score: RaceRelevance | PromiseRelevance;
  }>) {
    if (r.entity_type === "race") raceRelevance.set(r.entity_id, r.score as RaceRelevance);
    else if (r.entity_type === "promise")
      promiseRelevance.set(r.entity_id, r.score as PromiseRelevance);
  }

  // 3. Assemble.
  const ballots: BallotRace[] = races.map((race) => {
    const raceCandidates = candidates.filter((c) => c.race_id === race.id);
    const columns: BallotCandidateColumn[] = raceCandidates.map((c) => {
      const cPromises = promises
        .filter((p) => p.candidate_id === c.id)
        .map((p) => ({
          promise: p,
          relevance: promiseRelevance.get(p.id) ?? null,
        }))
        .sort((a, b) => {
          const ar = a.relevance?.post_score ?? -1;
          const br = b.relevance?.post_score ?? -1;
          if (br !== ar) return br - ar;
          return 0;
        });
      return { candidate: c, promises: cPromises };
    });
    return { race, relevance: raceRelevance.get(race.id) ?? null, columns };
  });

  // Sort races by relevance desc; then by election_date asc as tiebreak.
  ballots.sort((a, b) => {
    const ar = a.relevance?.post_score ?? 0;
    const br = b.relevance?.post_score ?? 0;
    if (br !== ar) return br - ar;
    return a.race.election_date.localeCompare(b.race.election_date);
  });

  return ballots;
}
