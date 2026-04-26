// Pure-function election relevance scoring per .claude/skills/elections/SKILL.md.
// Race relevance + promise relevance are separate; the UI uses both —
// race score for ordering races, promise score for ordering promises
// within a candidate's column.

import type {
  ElectionCandidate,
  ElectionPromise,
  ElectionRace,
  Fingerprint,
  PromiseAuthority,
  PromiseRelevance,
  PromiseSpecificity,
  RaceRelevance,
} from "@revere/shared";

const SCORER_VERSION = "v1";

const AUTHORITY_FACTOR: Record<PromiseAuthority, number> = {
  direct_authority: 1.0,
  partial_authority: 0.6,
  indirect_influence: 0.3,
  outside_office_scope: 0.0,
  too_vague_to_assess: 0.1,
};

const SPECIFICITY_FACTOR: Record<PromiseSpecificity, number> = {
  specific: 1.0,
  general: 0.6,
  vague: 0.3,
};

const ACTION_WINDOW_DAYS = 30;

// Maps fingerprint topic strings → taxonomy categories used on
// election promises. Mirrors apps/orchestrator/src/match/topic-vocabulary.ts
// but kept here so elections doesn't import the governance scorer's internals.
const FINGERPRINT_TOPIC_TAXONOMY: Record<string, string[]> = {
  housing_cost: ["housing", "land-use"],
  rent_stabilization: ["housing"],
  property_taxes: ["budget"],
  school_quality: ["budget"],
  childcare_access: ["budget"],
  transit_reliability: ["transportation"],
  small_business_permitting: ["commercial-regulation"],
  commercial_zoning: ["land-use", "commercial-regulation"],
  tabc_rules: ["commercial-regulation"],
  downtown_safety: ["public-safety"],
  police_accountability: ["public-safety"],
};

// District-match function: does the user's district line up with the race's?
function jurisdictionMatch(fp: Fingerprint, race: ElectionRace): 0 | 1 {
  const m = race.district_match;
  switch (m.field) {
    case "council_district":
      return fp.location.council_district === m.value ? 1 : 0;
    case "isd_trustee_district":
      // Fingerprint doesn't have isd_trustee_district yet; fall back
      // to ISD body match (any AISD parent matches D2 for the demo).
      return fp.location.isd?.toLowerCase().includes("austin") ? 1 : 0;
    case "state_house_district":
      return fp.location.state_house_district === m.value ? 1 : 0;
    case "state_senate_district":
      return fp.location.state_senate_district === m.value ? 1 : 0;
    case "us_house_district":
      return fp.location.us_house_district === m.value ? 1 : 0;
    case "county_precinct":
      return 0; // not in fingerprint v1
    case "citywide":
      return fp.location.city ? 1 : 0;
    case "countywide":
      return fp.location.county ? 1 : 0;
    case "statewide":
      return fp.location.state ? 1 : 0;
    default:
      return 0;
  }
}

// Topic overlap = sum over user-priority topics of weight * matching contribution.
// Unlike governance scoring (which used a 0..1 normalized overlap), this is
// uncapped — a promise that perfectly matches a high-weight priority gets a
// strong push.
function promiseTopicOverlap(
  fp: Fingerprint,
  promise: ElectionPromise,
): { score: number; matched: string[] } {
  const matched: string[] = [];
  let total = 0;
  for (const pri of fp.priorities) {
    const taxonomy = FINGERPRINT_TOPIC_TAXONOMY[pri.topic];
    if (!taxonomy) continue;
    const hits = promise.topics.some((t) => taxonomy.includes(t));
    const directTopicMatch = promise.topic === pri.topic;
    if (directTopicMatch) {
      // Strongest signal — promise.topic exactly matches a fingerprint priority.
      total += pri.weight * 1.0;
      matched.push(pri.topic);
    } else if (hits) {
      total += pri.weight * 0.5;
      matched.push(pri.topic);
    }
  }
  return { score: Math.min(total, 1.5), matched };
}

// Per-promise relevance — drives ordering of promises within one
// candidate column on the comparison surface.
export function scorePromise(
  fp: Fingerprint,
  promise: ElectionPromise,
  scoredAt: string = new Date().toISOString(),
): PromiseRelevance {
  const overlap = promiseTopicOverlap(fp, promise);
  const authorityFactor = AUTHORITY_FACTOR[promise.authority];
  const specFactor = SPECIFICITY_FACTOR[promise.specificity];
  const compositeFactor = (authorityFactor + specFactor) / 2;
  const post_score =
    overlap.score === 0 ? 0 : Math.round(overlap.score * compositeFactor * 1000) / 1000;

  const why_lines: string[] = [];
  if (overlap.matched.length > 0) {
    why_lines.push(
      `priorities[${overlap.matched.join(",")}].weight match`,
    );
  } else {
    why_lines.push("no fingerprint priority match");
  }
  why_lines.push(`authority=${promise.authority}`);
  why_lines.push(`specificity=${promise.specificity}`);

  return {
    promise_id: promise.id,
    user_id: fp.user_id,
    scored_at: scoredAt,
    topic_overlap: Math.round(overlap.score * 1000) / 1000,
    matched_priorities: overlap.matched,
    authority_factor: authorityFactor,
    specificity_factor: specFactor,
    post_score,
    why_this: why_lines.join(" + ").slice(0, 200),
  };
}

// Race-level relevance — drives ordering of races on /ballot.
export function scoreRace(
  fp: Fingerprint,
  race: ElectionRace,
  candidates: ElectionCandidate[],
  promises: ElectionPromise[],
  scoredAt: string = new Date().toISOString(),
): RaceRelevance {
  const j = jurisdictionMatch(fp, race);
  // Topic overlap for the race = max promise overlap across all
  // candidates' promises in the race.
  const candidateIds = new Set(
    candidates.filter((c) => c.race_id === race.id).map((c) => c.id),
  );
  const racePromises = promises.filter((p) => candidateIds.has(p.candidate_id));
  let topicOverlap = 0;
  for (const p of racePromises) {
    const o = promiseTopicOverlap(fp, p);
    if (o.score > topicOverlap) topicOverlap = o.score;
  }
  topicOverlap = Math.round(topicOverlap * 1000) / 1000;

  // Action window: election within 30 days?
  const electionDate = new Date(race.election_date + "T00:00:00Z");
  const today = new Date(scoredAt);
  const days = Math.ceil(
    (electionDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  const actionWindow: 0 | 1 = days <= ACTION_WINDOW_DAYS && days >= 0 ? 1 : 0;

  // Composite. Jurisdiction is a hard gate — out-of-district races
  // never surface. Topic overlap + action window add to the score.
  let post_score = 0;
  if (j === 1) {
    post_score = 0.4 + topicOverlap * 0.5 + actionWindow * 0.1;
    post_score = Math.min(1.0, Math.round(post_score * 1000) / 1000);
  }

  const why_parts: string[] = [];
  why_parts.push(
    j === 1 ? `jurisdiction:${race.district_label}=match` : "jurisdiction=no_match",
  );
  if (topicOverlap > 0) why_parts.push(`topic_overlap=${topicOverlap}`);
  if (actionWindow === 1) why_parts.push("action_window=urgent");

  return {
    race_id: race.id,
    user_id: fp.user_id,
    scored_at: scoredAt,
    scorer_version: SCORER_VERSION,
    jurisdiction_match: j,
    topic_overlap: topicOverlap,
    action_window_boost: actionWindow,
    post_score,
    surfaced: post_score > 0,
    why_this: why_parts.join(" + ").slice(0, 200),
  };
}
