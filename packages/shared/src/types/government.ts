// Cross-jurisdiction taxonomy. Lets the rest of the codebase reason about
// "what level of government is this from?" without hard-coding Austin.
//
// `GovernmentLevel` is the abstraction that the briefing UI uses to
// group items in a Mode and that the matcher uses to weight relevance.
//
// `JurisdictionId` stays a string so we can add a new jurisdiction by
// inserting a row into the `jurisdictions` table — no shared-types
// release required. The branded type prevents accidental string mixing.

export type GovernmentLevel =
  | "municipal"
  | "county"
  | "school"
  | "state"
  | "federal";

export type JurisdictionId = string & { readonly __brand: "JurisdictionId" };

export function jurisdictionId(s: string): JurisdictionId {
  return s as JurisdictionId;
}

// What kind of record this is. The `Item` discriminator stays
// "governance" by default for backward-compatibility with v1's Austin
// council ingestion; election items carry `record_kind: "election"`
// and reference `entity_type` + `entity_id` instead of a meeting.
export type RecordKind = "governance" | "election";

// What mode the briefing is composing in. "mixed" lets a single
// briefing weave governance + election items by relevance.
export type BriefingMode = "governance" | "election" | "mixed";

// Authority classification for an election promise. Per the user's
// "Can they actually do that?" demand. Pairs with a sourced rationale.
export type PromiseAuthority =
  | "direct_authority"
  | "partial_authority"
  | "indirect_influence"
  | "outside_office_scope"
  | "too_vague_to_assess";

export const AUTHORITY_LABELS: Record<PromiseAuthority, string> = {
  direct_authority: "Direct authority",
  partial_authority: "Partial authority",
  indirect_influence: "Indirect influence",
  outside_office_scope: "Outside office scope",
  too_vague_to_assess: "Too vague to assess",
};

// Promise specificity — orthogonal to authority. A promise can be
// "specific + outside scope" or "vague + direct authority."
export type PromiseSpecificity = "specific" | "general" | "vague";

// One element of the user's representation ladder — the bodies that
// represent them. Built from the fingerprint's location fields.
export interface RepresentationEntry {
  level: GovernmentLevel;
  body: string; // human-readable: "Austin City Council", "AISD Board", "Texas House", etc.
  district_label: string; // "D3", "Citywide", "Texas House 51", etc.
  jurisdiction_id: JurisdictionId;
}
