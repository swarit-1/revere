// Jurisdiction lookup table — maps the string id stored on a record
// (Item.jurisdiction or election_races.jurisdiction_id) to the
// human-readable body name + GovernmentLevel. Sourced from the
// `jurisdictions` Supabase table; we cache here statically because the
// list is short and changes only via migration.
//
// If a jurisdiction id is missing from this map, the resolver falls
// back to "municipal" + the raw id — better to render an honest
// fallback than crash.

import type { GovernmentLevel } from "@revere/shared";

export interface JurisdictionMeta {
  id: string;
  body: string;
  level: GovernmentLevel;
  // For governance items, the orchestrator already produced
  // localityish labels. Use this when the raw id is too terse.
  short_name: string;
}

export const JURISDICTIONS: Record<string, JurisdictionMeta> = {
  "austin-city-council": {
    id: "austin-city-council",
    body: "Austin City Council",
    level: "municipal",
    short_name: "Austin Council",
  },
  aisd: {
    id: "aisd",
    body: "Austin ISD Board",
    level: "school",
    short_name: "AISD",
  },
  "texas-lege": {
    id: "texas-lege",
    body: "Texas Legislature",
    level: "state",
    short_name: "Texas Lege",
  },
  "travis-county": {
    id: "travis-county",
    body: "Travis County Commissioners Court",
    level: "county",
    short_name: "Travis County",
  },
  "us-congress": {
    id: "us-congress",
    body: "United States Congress",
    level: "federal",
    short_name: "US Congress",
  },
};

export function lookupJurisdiction(id: string): JurisdictionMeta {
  return (
    JURISDICTIONS[id] ?? {
      id,
      body: id,
      level: "municipal" as GovernmentLevel,
      short_name: id,
    }
  );
}
