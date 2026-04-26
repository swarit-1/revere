// Mirror of .claude/skills/jurisdictions/austin-city-council/output-schemas/item.json.
// Hand-written; drift between schema and type is caught by
// packages/shared/test/schema-drift.test.ts.
//
// Jurisdiction was once a literal "austin-city-council" — now string,
// because real ingest paths cross municipal/school/state/federal. The
// `RecordKind` discriminator (in types/government.ts) lets the UI
// branch on governance vs election items without a runtime type guard.

export type Jurisdiction = string;

export type ItemType =
  | "motion"
  | "public_hearing"
  | "staff_report"
  | "consent"
  | "proclamation";

export type ItemStatus =
  | "Agenda Ready"
  | "Approved"
  | "Denied"
  | "Postponed"
  | "Withdrawn"
  | "Enacted";

export type Topic =
  | "housing"
  | "transportation"
  | "public-safety"
  | "budget"
  | "land-use"
  | "commercial-regulation";

export type Confidence = "high" | "medium" | "low" | null;

export type Recommendation = "approve" | "deny" | "other" | null;

export interface ExtractedString {
  value: string | null;
  confidence: Confidence;
  raw_passage: string | null;
}

export interface ExtractedRecommendation {
  value: Recommendation;
  confidence: Confidence;
  raw_passage: string | null;
}

export interface ExtractedBoolean {
  value: boolean | null;
  confidence: Confidence;
  raw_passage: string | null;
}

export interface ItemLocation {
  address?: string | null;
  council_district?: number | null;
  neighborhood?: string | null;
  watershed?: string | null;
}

export interface HearingDetails {
  comment_deadline?: string | null;
  in_person_time?: string | null;
}

export interface StaffReportDetails {
  authoring_department?: string | null;
}

export interface ZoningSubObject {
  current: ExtractedString;
  proposed: ExtractedString;
  staff_recommendation: ExtractedRecommendation;
  planning_commission_recommendation: ExtractedRecommendation;
  opposition_petition_filed: ExtractedBoolean;
}

export type SourceRef =
  | { type: "agenda_pdf"; url: string; page?: number }
  | { type: "item_detail"; url: string }
  | { type: "staff_report"; url: string; title?: string }
  | { type: "ordinance"; url: string; title?: string }
  | { type: "exhibit"; url: string; title?: string }
  | { type: "map"; url: string; title?: string }
  | { type: "public_comment"; url: string; title?: string }
  | { type: "video"; url: string; timestamp_seconds?: number }
  | { type: "other"; url: string; title?: string };

export interface VideoRef {
  youtube_url: string;
  start_seconds?: number;
}

export interface Item {
  id: string;
  jurisdiction: Jurisdiction;
  // record_kind discriminates governance vs election. Defaults to
  // "governance" if missing — keeps v1-v5 candidate_items rows
  // backward-compatible.
  record_kind?: "governance" | "election";
  meeting_id: number;
  meeting_date: string;
  legistar_item_id: number;
  legistar_item_guid: string;
  agenda_item_number: number;
  type: ItemType;
  status: ItemStatus;
  title: string;
  body?: string | null;
  sponsors: string[];
  applicants?: string[] | null;
  location?: ItemLocation | null;
  hearing_details?: HearingDetails | null;
  staff_report_details?: StaffReportDetails | null;
  zoning?: ZoningSubObject | null;
  topics: [Topic, ...Topic[]];
  sources: [SourceRef, ...SourceRef[]];
  video?: VideoRef | null;
  scraped_at: string;
  source_hash: string;
}
