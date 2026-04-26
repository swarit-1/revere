// Map between fingerprint topic strings and the Session 1 taxonomy enum.
// Mirrors .claude/skills/fingerprint/reference/topic-vocabulary-map.md exactly.
// Don't fork — when the markdown changes, update this table in the same commit.

import type { TaxonomyCategory } from "@revere/shared";

export const TOPIC_VOCABULARY_MAP: Record<string, TaxonomyCategory | null> = {
  housing_cost: "housing",
  rent_burden: "housing",
  affordability: "housing",
  displacement: "housing",
  homelessness: "housing",
  commercial_zoning: "commercial-regulation",
  tabc_rules: "commercial-regulation",
  liquor_licensing: "commercial-regulation",
  outdoor_seating: "commercial-regulation",
  small_business_permitting: "commercial-regulation",
  signage_rules: "commercial-regulation",
  transit_reliability: "transportation",
  bike_infrastructure: "transportation",
  walkability: "transportation",
  parking_policy: "transportation",
  mobility: "transportation",
  police_accountability: "public-safety",
  apd_oversight: "public-safety",
  body_camera_policy: "public-safety",
  emergency_response: "public-safety",
  downtown_safety: "public-safety",
  property_taxes: "budget",
  tax_rate: "budget",
  homestead_exemption: "budget",
  utility_rates: "budget",
  parkland: "land-use",
  historic_preservation: "land-use",
  tree_protection: "land-use",
  watershed: "land-use",
  school_quality: null,
  childcare_access: null,
  library_funding: null,
  parks_programming: null,
  senior_services: null,
};

export interface VocabularyLookup {
  taxonomy: TaxonomyCategory | null;
  unknown: boolean; // true when topic isn't in the map at all
}

export function lookupTopic(topic: string): VocabularyLookup {
  if (Object.prototype.hasOwnProperty.call(TOPIC_VOCABULARY_MAP, topic)) {
    return { taxonomy: TOPIC_VOCABULARY_MAP[topic] ?? null, unknown: false };
  }
  // Unknown topic → treat as null (live for priority_phrase_match) per the
  // skill pack's lookup protocol. Caller logs into degraded_dimensions.
  return { taxonomy: null, unknown: true };
}
