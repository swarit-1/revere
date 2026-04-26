// Pure helpers for the geography label / representation ladder. Lives
// in shared so both apps/web and apps/orchestrator can call without
// duplication.

import type { Fingerprint } from "./fingerprint.js";
import type { ItemLocation } from "./item.js";
import type {
  GovernmentLevel,
  JurisdictionId,
  RepresentationEntry,
} from "./government.js";
import { jurisdictionId } from "./government.js";

// One-line geography label for a generic record. Replaces the
// hardcoded "D3" / "Citywide" rendering in the briefing UI.
//
// Inputs:
//   - The record's level + jurisdiction (e.g. "municipal" + "austin-city-council")
//   - The record's location subset (council_district, etc.)
//   - The user's fingerprint (so we can short-form when match is direct)
//
// Output examples:
//   - "D3" (council district 3 matches user)
//   - "Citywide" (council, no district)
//   - "Texas House 51"
//   - "AISD Trustee D2"
//   - "Travis County"
//   - "US House 35"
export interface GeographyLabelInput {
  level: GovernmentLevel;
  jurisdiction_id: JurisdictionId;
  body?: string | null; // human-readable body for fallback labels
  location?: Partial<
    Pick<ItemLocation, "council_district" | "neighborhood" | "watershed">
  > | null;
  state_house_district?: number | null;
  state_senate_district?: number | null;
  us_house_district?: number | null;
  isd_trustee_district?: number | null;
  county_precinct?: number | null;
  // If true, force the long form (e.g. "Council District 3") even when
  // the short form would do. Useful for the representation ladder.
  long_form?: boolean;
}

export function buildGeographyLabel(input: GeographyLabelInput): string {
  switch (input.level) {
    case "municipal": {
      const d = input.location?.council_district ?? null;
      if (d === null || d === 0) return "Citywide";
      return input.long_form ? `Council District ${d}` : `D${d}`;
    }
    case "school": {
      const d = input.isd_trustee_district ?? null;
      if (d === null) return input.body ?? "School District";
      return input.long_form ? `Trustee District ${d}` : `Trustee D${d}`;
    }
    case "state": {
      const hd = input.state_house_district ?? null;
      const sd = input.state_senate_district ?? null;
      if (hd !== null) return `Texas House ${hd}`;
      if (sd !== null) return `Texas Senate ${sd}`;
      return "Statewide";
    }
    case "county": {
      const p = input.county_precinct ?? null;
      if (p === null) return "Countywide";
      return input.long_form ? `Travis County Pct. ${p}` : `Pct. ${p}`;
    }
    case "federal": {
      const d = input.us_house_district ?? null;
      if (d === null) return "Federal";
      return `US House ${d}`;
    }
  }
}

// The representation ladder for the user — what bodies cover them.
// Built straight from the fingerprint; the UI renders this verbatim.
export function buildRepresentationLadder(
  fp: Fingerprint,
): RepresentationEntry[] {
  const entries: RepresentationEntry[] = [];

  if (fp.location.city) {
    entries.push({
      level: "municipal",
      body: `${fp.location.city} City Council`,
      district_label: buildGeographyLabel({
        level: "municipal",
        jurisdiction_id: jurisdictionId("austin-city-council"),
        location: { council_district: fp.location.council_district },
      }),
      jurisdiction_id: jurisdictionId("austin-city-council"),
    });
  }

  if (fp.location.isd) {
    entries.push({
      level: "school",
      body: fp.location.isd,
      district_label: buildGeographyLabel({
        level: "school",
        jurisdiction_id: jurisdictionId("aisd"),
        body: fp.location.isd,
        // Trustee district isn't in the fingerprint v1 — fall back to
        // the body name. The ladder displays "AISD Board" then.
        isd_trustee_district: null,
      }),
      jurisdiction_id: jurisdictionId("aisd"),
    });
  }

  if (fp.location.county) {
    entries.push({
      level: "county",
      body: `${fp.location.county} County`,
      district_label: buildGeographyLabel({
        level: "county",
        jurisdiction_id: jurisdictionId("travis-county"),
        county_precinct: null, // not in fingerprint v1
      }),
      jurisdiction_id: jurisdictionId("travis-county"),
    });
  }

  if (typeof fp.location.state_house_district === "number") {
    entries.push({
      level: "state",
      body: "Texas House",
      district_label: `Texas House ${fp.location.state_house_district}`,
      jurisdiction_id: jurisdictionId("texas-lege"),
    });
  }
  if (typeof fp.location.state_senate_district === "number") {
    entries.push({
      level: "state",
      body: "Texas Senate",
      district_label: `Texas Senate ${fp.location.state_senate_district}`,
      jurisdiction_id: jurisdictionId("texas-lege"),
    });
  }

  if (typeof fp.location.us_house_district === "number") {
    entries.push({
      level: "federal",
      body: "US House",
      district_label: `US House ${fp.location.us_house_district}`,
      jurisdiction_id: jurisdictionId("us-congress"),
    });
  }

  return entries;
}

// Confidence label derived from the verification report's coverage.
// Replaces the hardcoded "High confidence" text in the UI.
export type ConfidenceTier = "high" | "medium" | "low" | "unknown";

export function deriveConfidenceTier(coverage: {
  total_claims: number;
  supported: number;
  partially_supported: number;
  unsupported: number;
  contradicted: number;
  unverifiable: number;
}): ConfidenceTier {
  const total = coverage.total_claims;
  if (total === 0) return "unknown";
  if (coverage.contradicted > 0 || coverage.unsupported > 0) return "low";
  const verifiedRatio =
    coverage.supported / Math.max(1, total - coverage.unverifiable);
  const unverifiableRatio = coverage.unverifiable / total;
  if (verifiedRatio >= 0.75 && unverifiableRatio <= 0.4) return "high";
  if (verifiedRatio >= 0.5) return "medium";
  return "low";
}

export const CONFIDENCE_LABELS: Record<ConfidenceTier, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Caveats apply",
  unknown: "Unverified",
};
