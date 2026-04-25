// Drift test: confirms .claude/skills/jurisdictions/austin-city-council/
// output-schemas/item.json and packages/shared/src/types/item.ts agree on
// the shape of an Austin item record.
//
// The T-06 record (the real File #26-1501 ingestion from Session 1) is
// embedded below as a literal typed `: Item`, so TS rejects type drift at
// compile time. The same record is then validated against item.json with
// AJV, so JSON-Schema drift is caught at test time. Both checks pass = the
// type and the schema agree.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { Item } from "../src/types/item.js";

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(
  here,
  "..",
  "..",
  "..",
  ".claude",
  "skills",
  "jurisdictions",
  "austin-city-council",
  "output-schemas",
  "item.json",
);

// Verbatim from docs/verification/t-06-classification.md.
const t06Record: Item = {
  id: "26-1501",
  jurisdiction: "austin-city-council",
  meeting_id: 1362247,
  meeting_date: "2026-04-09",
  legistar_item_id: 7962865,
  legistar_item_guid: "86EA5612-F32D-4555-B234-2FAD60D7AF26",
  agenda_item_number: 56,
  type: "motion",
  status: "Agenda Ready",
  title: "C14-2025-0080 - 1811 East Cesar Chavez rezoning request",
  body: null,
  sponsors: [],
  applicants: ["Lodhia Investments LLC", "G N Exim Corporation Inc."],
  location: {
    address: "1811 East Cesar Chavez Street",
    council_district: 3,
    neighborhood: null,
    watershed: "Lady Bird Lake Watershed",
  },
  hearing_details: { comment_deadline: null, in_person_time: null },
  staff_report_details: null,
  zoning: {
    current: {
      value: "CS-MU-CO-NP",
      confidence: "high",
      raw_passage:
        "Current Zoning: CS-MU-CO-NP (general commercial services-mixed use-conditional overlay-neighborhood plan)",
    },
    proposed: {
      value: "CS-1-CO-NP",
      confidence: "high",
      raw_passage:
        "Proposed Zoning: CS-1-CO-NP (commercial-liquor sales-conditional overlay-neighborhood plan)",
    },
    staff_recommendation: {
      value: "deny",
      confidence: "high",
      raw_passage: "Staff Recommendation: To deny the rezoning to CS-1-CO-NP zoning",
    },
    planning_commission_recommendation: {
      value: "approve",
      confidence: "high",
      raw_passage:
        "Planning Commission Recommendation: To grant the CS-1-CO-NP zoning designation",
    },
    opposition_petition_filed: {
      value: true,
      confidence: "high",
      raw_passage: "A valid petition has been filed against this rezoning request",
    },
  },
  topics: ["housing", "commercial-regulation"],
  sources: [
    {
      type: "item_detail",
      url: "https://austintexas.legistar.com/LegislationDetail.aspx?ID=7962865&GUID=86EA5612-F32D-4555-B234-2FAD60D7AF26",
    },
    {
      type: "staff_report",
      url: "https://austintexas.legistar.com/View.ashx?M=F&ID=15343428&GUID=3C743B37-11FA-4882-8246-060FE23FB36C",
      title: "Staff Report",
    },
    {
      type: "ordinance",
      url: "https://austintexas.legistar.com/View.ashx?M=F&ID=15343429&GUID=5135F405-F4AC-4C16-B5E2-688EA3B86E3C",
      title: "Draft Ordinance",
    },
    {
      type: "other",
      url: "https://austintexas.legistar.com/View.ashx?M=F&ID=15343662&GUID=46DE5BC7-0E08-4FF3-98E4-5DDD0C3E4688",
      title: "Recommendation for Action",
    },
  ],
  video: null,
  scraped_at: "2026-04-24T02:17:48Z",
  source_hash: "f5ccf03626cf6779e8eded2f101e5290d806f14d201c6e6ca06c895f9235277c",
};

describe("item.json schema drift", () => {
  const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as object;
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  it("T-06 record validates against item.json", () => {
    const valid = validate(t06Record);
    if (!valid) {
      // eslint-disable-next-line no-console
      console.error("AJV errors:", validate.errors);
    }
    expect(valid).toBe(true);
  });

  it("T-06 record carries the demo-critical zoning sub-object", () => {
    expect(t06Record.id).toBe("26-1501");
    expect(t06Record.topics).toContain("housing");
    expect(t06Record.topics).toContain("commercial-regulation");
    expect(t06Record.zoning?.staff_recommendation.value).toBe("deny");
    expect(t06Record.zoning?.planning_commission_recommendation.value).toBe("approve");
    expect(t06Record.zoning?.opposition_petition_filed.value).toBe(true);
  });
});
