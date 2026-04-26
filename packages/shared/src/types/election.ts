// Election-mode types. Mirrors the entities in v6 migration:
// election_races / candidates / candidate_promises.
//
// Source-proof on every promise — same trust contract as governance
// items. No partisan scoring. The PromiseAuthority field is the
// load-bearing differentiator: "Can they actually do that?"

import type {
  GovernmentLevel,
  JurisdictionId,
  PromiseAuthority,
  PromiseSpecificity,
} from "./government.js";

// One race on someone's ballot. Identified by `id` (slug — "austin-d3-2026"
// or "txhd-51-2026"). district_label uses the same builder as governance.
export interface ElectionRace {
  id: string;
  jurisdiction_id: JurisdictionId;
  level: GovernmentLevel;
  office_title: string; // "City Council Member, District 3"
  body: string; // "Austin City Council"
  district_label: string; // "D3", "Texas House 51", "AISD Trustee D2"
  district_match: {
    // What fingerprint location field connects the user to this race.
    field:
      | "council_district"
      | "isd_trustee_district"
      | "state_house_district"
      | "state_senate_district"
      | "us_house_district"
      | "county_precinct"
      | "citywide"
      | "countywide"
      | "statewide";
    value?: number | string | null; // present when not "citywide"
  };
  election_date: string; // YYYY-MM-DD
  registration_deadline?: string | null;
  early_voting_window?: { start: string; end: string } | null;
  source_url: string; // canonical jurisdiction page for this race
  notes?: string | null;
}

export interface ElectionCandidate {
  id: string; // slug — "alex-rivera-austin-d3-2026"
  race_id: string;
  display_name: string;
  // We deliberately don't store party labels in the demo. Adding them
  // requires a separate column + UI policy on whether to display.
  campaign_url?: string | null;
  status: "filed" | "withdrew" | "incumbent" | string;
  notes?: string | null;
}

// One sourced statement / commitment from a candidate. The PRD's
// "Can they actually do that?" classification lives here.
export interface ElectionPromise {
  id: string; // slug — "alex-rivera-rent-stabilization"
  candidate_id: string;
  topic: string; // snake_case mapped to user fingerprint vocabulary
  text: string; // ≤ 240 chars; the user-visible promise summary
  source: PromiseSource;
  authority: PromiseAuthority;
  authority_rationale: string; // ≤ 240 chars; sourced explanation
  specificity: PromiseSpecificity;
  topics: string[]; // taxonomy categories: housing, transportation, etc.
}

export interface PromiseSource {
  type:
    | "campaign_site"
    | "interview"
    | "debate"
    | "questionnaire"
    | "social_post"
    | "press_release"
    | "other";
  url: string;
  excerpt: string; // verbatim quote, ≤ 240 chars
  cited_at?: string | null; // ISO8601 if dated
}

// Per-race relevance score for one user. Mirrors RelevanceScore for
// governance items — same shape, election-specific dimensions.
export interface RaceRelevance {
  race_id: string;
  user_id: string;
  scored_at: string;
  scorer_version: string;
  jurisdiction_match: 0 | 1; // does the user's district intersect the race's district?
  topic_overlap: number; // 0..1, sum of weighted overlaps with promises
  action_window_boost: 0 | 1; // election_date within 30 days
  post_score: number; // composed from the dimensions above
  surfaced: boolean;
  why_this: string; // ≤ 200 chars, references fingerprint clauses
}

// Per-(user, promise) relevance — drives ordering of promises within
// a candidate's column on the comparison surface.
export interface PromiseRelevance {
  promise_id: string;
  user_id: string;
  scored_at: string;
  topic_overlap: number;
  matched_priorities: string[]; // fingerprint priority topics that lit up
  authority_factor: number; // 1.0 for direct, 0.6 partial, 0.3 indirect, 0.0 outside, 0.1 vague
  specificity_factor: number; // 1.0 specific, 0.6 general, 0.3 vague
  post_score: number;
  why_this: string;
}
