// Hand-written TS mirror of .claude/skills/fingerprint/output-schemas/relevance-score.json.

export type Channel = "topic_overlap" | "priority_phrase_match" | "no_match";

export type SurfaceReason =
  | "score_above_threshold"
  | "critical_override"
  | "below_threshold"
  | "anti_priority_suppressed";

export type Dimension =
  | "geography_match"
  | "topic_overlap"
  | "priority_phrase_match"
  | "action_window_boost"
  | "anti_priority_hit";

export type TaxonomyCategory =
  | "housing"
  | "transportation"
  | "public-safety"
  | "budget"
  | "land-use"
  | "commercial-regulation";

export interface ScoreBreakdown {
  geography_match: 0 | 1;
  topic_overlap: number; // [0, 1]
  priority_phrase_match: 0 | 1;
  action_window_boost: 0 | 1;
  anti_priority_hit: 0 | 1;
}

export interface TopicOverlapDetail {
  fingerprint_topic: string;
  mapped_taxonomy: TaxonomyCategory | null;
  weight: number;
  contribution: number;
  matched_via: Channel;
}

export interface DefaultsApplied {
  field: string;
  default: unknown;
  reason: "absent" | "sanity_check";
}

export interface FingerprintValidation {
  valid: true;
  missing_fields: string[];
  degraded_dimensions: Dimension[];
  defaults_applied?: DefaultsApplied[];
}

export interface RelevanceScore {
  user_id: string;
  item_id: string;
  scored_at: string;
  scorer_version: string;
  fingerprint_version_used: string;
  pre_score: number;
  post_score: number;
  threshold_used: 0.65 | 0.55 | 0.4;
  slider_value: "strict" | "balanced" | "broad";
  surfaced: boolean;
  surface_reason: SurfaceReason;
  breakdown: ScoreBreakdown;
  topic_overlap_detail: TopicOverlapDetail[];
  why_this: string;
  fingerprint_validation: FingerprintValidation;
}
