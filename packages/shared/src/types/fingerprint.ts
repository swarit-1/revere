export type RelevanceSlider = "strict" | "balanced" | "broad";

export type CommuteMode = "car" | "bus" | "bike" | "walk" | "remote";

export type HousingStatus = "renter" | "owner";

export type BuildingType = "market_rate" | "income_restricted" | "owned";

export type HouseholdRole = "self" | "partner" | "child" | "parent" | "other";

export interface HouseholdMember {
  role: HouseholdRole;
  age_bracket?: string;
  age?: number;
  school?: string;
}

export interface Priority {
  topic: string;
  weight: number;
}

export interface FingerprintLocation {
  city: string;
  county: string;
  state: string;
  council_district: number;
  isd: string;
  school_zone?: string;
  state_house_district: number;
  state_senate_district: number;
  us_house_district: number;
}

export interface FingerprintHousing {
  status: HousingStatus;
  unit_type: string;
  approximate_rent?: number;
  building_type?: BuildingType;
}

export interface FingerprintWork {
  commute_mode: CommuteMode;
  commute_route_keywords: string[];
  sector: string;
}

export type FeedbackEvent = "thumb_up" | "thumb_down" | "edit" | "dismiss";

export interface FeedbackHistoryEntry {
  at: string;
  event: FeedbackEvent;
  target_item_id?: string;
}

export interface Fingerprint {
  user_id: string;
  location: FingerprintLocation;
  housing: FingerprintHousing;
  household: HouseholdMember[];
  work: FingerprintWork;
  priorities: Priority[];
  anti_priorities: string[];
  relevance_slider: RelevanceSlider;
  learned_voice_style: Record<string, unknown>;
  feedback_history: FeedbackHistoryEntry[];
}
