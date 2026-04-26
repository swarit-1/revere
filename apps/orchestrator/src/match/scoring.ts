// Pure-function implementation of the fingerprint scoring rubric.
// Mirrors .claude/skills/fingerprint/reference/scoring-rubric.md exactly.
//
// LLM judgments (priority_phrase_match, anti_priority_hit, geography
// extension for citywide downstream effect) are passed in as inputs —
// this function is deterministic arithmetic. The caller (match.ts)
// produces those judgments via Sonnet and feeds them in.

import type {
  Fingerprint,
  Item,
  RelevanceScore,
  ScoreBreakdown,
  SurfaceReason,
  TaxonomyCategory,
  TopicOverlapDetail,
} from "@revere/shared";
import { lookupTopic } from "./topic-vocabulary.js";

const SCORER_VERSION = "v1";
const THRESHOLDS = { strict: 0.65, balanced: 0.55, broad: 0.4 } as const;

export interface ScoringJudgments {
  // True iff any priority phrase semantically matches item title or body.
  priority_phrase_match: boolean;
  // True iff any anti_priorities[] entry semantically matches.
  anti_priority_hit: boolean;
  // Optional: which anti tag triggered, for the why_this acknowledgment.
  anti_priority_tag?: string | null;
  // Citywide-with-direct-downstream-effect override for geography_match.
  // True only when item is citywide AND the LLM judged direct effect on
  // user's district. False is the default.
  geography_extension?: boolean;
  // True when geography matched via commute_route_keywords overlap with
  // item's district (per T-09 fixture transcript Jason × F2 case).
  geography_via_commute?: boolean;
}

export interface ScoreArgs {
  fingerprint: Fingerprint;
  item: Item;
  judgments: ScoringJudgments;
  fingerprint_version_used: string;
  scored_at: string;
  verified_at: string;
}

const clip = (x: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, x));

function geographyMatch(args: ScoreArgs): {
  value: 0 | 1;
  via: "district_eq" | "commute" | "extended_downstream" | "none";
  unscored: boolean;
} {
  const userD = args.fingerprint.location.council_district;
  const itemD = args.item.location?.council_district ?? null;
  if (userD === null || userD === undefined) {
    return { value: 0, via: "none", unscored: true };
  }
  if (itemD === userD) return { value: 1, via: "district_eq", unscored: false };
  if (args.judgments.geography_via_commute) {
    return { value: 1, via: "commute", unscored: false };
  }
  if (itemD === 0 && args.judgments.geography_extension) {
    return { value: 1, via: "extended_downstream", unscored: false };
  }
  return { value: 0, via: "none", unscored: false };
}

function topicOverlap(args: ScoreArgs): {
  value: number;
  detail: TopicOverlapDetail[];
  degraded: boolean;
} {
  const priorities = args.fingerprint.priorities;
  if (priorities.length === 0) {
    return { value: 0, detail: [], degraded: true };
  }
  const itemTopics = new Set<TaxonomyCategory>(
    args.item.topics as TaxonomyCategory[],
  );
  const totalWeight = priorities.reduce((s, p) => s + p.weight, 0);
  let matched = 0;
  const detail: TopicOverlapDetail[] = [];
  for (const p of priorities) {
    const lookup = lookupTopic(p.topic);
    if (lookup.taxonomy && itemTopics.has(lookup.taxonomy)) {
      matched += p.weight;
      detail.push({
        fingerprint_topic: p.topic,
        mapped_taxonomy: lookup.taxonomy,
        weight: p.weight,
        contribution: p.weight / totalWeight,
        matched_via: "topic_overlap",
      });
    } else if (lookup.taxonomy === null) {
      // Live for priority_phrase_match channel (free-text).
      detail.push({
        fingerprint_topic: p.topic,
        mapped_taxonomy: null,
        weight: p.weight,
        contribution: 0,
        matched_via: "priority_phrase_match",
      });
    } else {
      detail.push({
        fingerprint_topic: p.topic,
        mapped_taxonomy: lookup.taxonomy,
        weight: p.weight,
        contribution: 0,
        matched_via: "no_match",
      });
    }
  }
  return { value: totalWeight === 0 ? 0 : matched / totalWeight, detail, degraded: false };
}

function actionWindowBoost(args: ScoreArgs): 0 | 1 {
  const meetingDate = new Date(`${args.item.meeting_date}T00:00:00Z`);
  const verifiedAt = new Date(args.verified_at);
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const fortyEightHoursMs = 48 * 60 * 60 * 1000;
  const dt = Math.abs(meetingDate.getTime() - verifiedAt.getTime());
  if (dt <= sevenDaysMs) return 1;
  const deadline = args.item.hearing_details?.comment_deadline;
  if (deadline) {
    const d = new Date(deadline).getTime();
    if (Math.abs(d - verifiedAt.getTime()) <= fortyEightHoursMs) return 1;
  }
  if (args.item.status === "Agenda Ready" && dt <= sevenDaysMs) return 1;
  return 0;
}

function buildWhyThis(args: {
  surface_reason: SurfaceReason;
  fingerprint: Fingerprint;
  item: Item;
  detail: TopicOverlapDetail[];
  judgments: ScoringJudgments;
  geography_via: "district_eq" | "commute" | "extended_downstream" | "none";
  geography_unscored: boolean;
  pre_score: number;
  post_score: number;
}): string {
  const parts: string[] = [];

  if (args.surface_reason === "critical_override") {
    const tag = args.judgments.anti_priority_tag ?? "(unknown)";
    const signals: string[] = [];
    if (args.geography_via === "district_eq") {
      signals.push(`location.council_district=${args.fingerprint.location.council_district}`);
    } else if (args.geography_via === "commute") {
      signals.push("work.commute_route_keywords overlap");
    } else if (args.geography_via === "extended_downstream") {
      signals.push("extended downstream effect");
    }
    const matched = args.detail.filter((d) => d.matched_via === "topic_overlap");
    if (matched.length > 0) {
      const m = matched[0]!;
      signals.push(`priorities[${m.fingerprint_topic}].weight=${m.weight}`);
    }
    if (args.judgments.priority_phrase_match) signals.push("priority_phrase_match");
    return `critical_override despite anti_priorities[${tag}] — ${signals.join(" + ") || "(weak signals)"} (pre_score=${args.pre_score.toFixed(2)})`;
  }

  if (args.geography_unscored) {
    parts.push("(geography unscored — district unknown)");
  } else if (args.geography_via === "district_eq") {
    parts.push(`location.council_district=${args.fingerprint.location.council_district}`);
  } else if (args.geography_via === "commute") {
    parts.push("work.commute_route_keywords overlap");
  }

  const matched = args.detail.filter((d) => d.matched_via === "topic_overlap");
  if (matched.length > 0) {
    const m = matched[0]!;
    parts.push(`priorities[${m.fingerprint_topic}].weight=${m.weight}`);
  } else if (args.judgments.priority_phrase_match) {
    const ppm = args.detail.find((d) => d.matched_via === "priority_phrase_match" || d.mapped_taxonomy === null);
    if (ppm) parts.push(`priority_phrase_match on priorities[${ppm.fingerprint_topic}]`);
    else parts.push("priority_phrase_match");
  } else if (args.surface_reason === "anti_priority_suppressed") {
    parts.push(`anti_priorities[${args.judgments.anti_priority_tag ?? "(unknown)"}]`);
  } else if (args.surface_reason === "below_threshold") {
    parts.push(`post_score=${args.post_score.toFixed(2)}`);
    if (args.fingerprint.priorities.length > 0) {
      parts.push(`priorities[${args.fingerprint.priorities[0]!.topic}]`);
    }
  }

  let s = parts.join(" + ");
  if (s.length === 0) {
    s = `priorities[${args.fingerprint.priorities[0]?.topic ?? "none"}] (no signal matched)`;
  }
  if (s.length > 200) s = s.slice(0, 197) + "...";
  return s;
}

export function scoreItem(args: ScoreArgs): RelevanceScore {
  const slider = args.fingerprint.relevance_slider ?? "balanced";
  const threshold = THRESHOLDS[slider];

  const geo = geographyMatch(args);
  const topic = topicOverlap(args);
  const ppm = args.judgments.priority_phrase_match ? 1 : 0;
  const awb = actionWindowBoost(args);
  const anti = args.judgments.anti_priority_hit ? 1 : 0;

  const pre_score = clip(0.3 * geo.value + 0.3 * topic.value + 0.25 * ppm + 0.15 * awb);
  const post_score = clip(pre_score - 0.4 * anti);

  let surfaced = false;
  let surface_reason: SurfaceReason;
  if (anti === 0 && post_score >= threshold) {
    surfaced = true;
    surface_reason = "score_above_threshold";
  } else if (anti === 1 && pre_score >= 0.85) {
    surfaced = true;
    surface_reason = "critical_override";
  } else if (anti === 1) {
    surfaced = false;
    surface_reason = "anti_priority_suppressed";
  } else {
    surfaced = false;
    surface_reason = "below_threshold";
  }

  const breakdown: ScoreBreakdown = {
    geography_match: geo.value,
    topic_overlap: topic.value,
    priority_phrase_match: ppm,
    action_window_boost: awb,
    anti_priority_hit: anti,
  };

  const degraded: RelevanceScore["fingerprint_validation"]["degraded_dimensions"] = [];
  if (geo.unscored) degraded.push("geography_match");
  if (topic.degraded) degraded.push("topic_overlap");

  const why_this = buildWhyThis({
    surface_reason,
    fingerprint: args.fingerprint,
    item: args.item,
    detail: topic.detail,
    judgments: args.judgments,
    geography_via: geo.via,
    geography_unscored: geo.unscored,
    pre_score,
    post_score,
  });

  return {
    user_id: args.fingerprint.user_id,
    item_id: args.item.id,
    scored_at: args.scored_at,
    scorer_version: SCORER_VERSION,
    fingerprint_version_used: args.fingerprint_version_used,
    pre_score: round4(pre_score),
    post_score: round4(post_score),
    threshold_used: threshold,
    slider_value: slider,
    surfaced,
    surface_reason,
    breakdown,
    topic_overlap_detail: topic.detail,
    why_this,
    fingerprint_validation: {
      valid: true,
      missing_fields: [],
      degraded_dimensions: degraded,
    },
  };
}

const round4 = (n: number): number => Math.round(n * 10000) / 10000;
