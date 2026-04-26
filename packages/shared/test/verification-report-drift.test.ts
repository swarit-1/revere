// Drift test: confirms .claude/skills/verification/output-schemas/
// verification-report.json and packages/shared/src/types/verification-report.ts
// agree on the shape of a verification report.
//
// A synthesized minimal report for 26-1501 is embedded as a typed
// `: VerificationReport` literal so TS rejects type drift at compile time;
// AJV then validates the same record against the JSON schema.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { VerificationReport } from "../src/types/verification-report.js";

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(
  here,
  "..",
  "..",
  "..",
  ".claude",
  "skills",
  "verification",
  "output-schemas",
  "verification-report.json",
);

const sampleReport: VerificationReport = {
  item_id: "26-1501",
  item_source_hash:
    "5bb6e9498b2c0b3d9e7e6f4a5d8c1e2b3f7a8d9c0e1f2a3b4c5d6e7f8a9b0c1d",
  verified_at: "2026-04-26T03:45:00Z",
  verifier_version: "v1",
  overall_verdict: "pass_clean",
  freshness_check: {
    item_scraped_at: "2026-04-25T22:30:00Z",
    verified_at: "2026-04-26T03:45:00Z",
    stale: false,
  },
  coverage: {
    total_claims: 1,
    supported: 1,
    partially_supported: 0,
    unsupported: 0,
    contradicted: 0,
    unverifiable: 0,
  },
  sources_reached: [
    {
      index: 0,
      url: "https://austintexas.legistar.com/LegislationDetail.aspx?ID=7962865&GUID=86EA5612-F32D-4555-B234-2FAD60D7AF26",
      fetch_status: "ok",
    },
  ],
  claims: [
    {
      claim_id: "zoning.current",
      claim_type: "extracted",
      claim_text: "Current zoning is CS-MU-CO-NP",
      value: "CS-MU-CO-NP",
      raw_passage:
        "Current Zoning: CS-MU-CO-NP (general commercial services-mixed use-conditional overlay-neighborhood plan)",
      verdict: "supported",
      evidence: {
        source_index: 0,
        source_locator: "item_detail, line containing 'Current Zoning:'",
        source_excerpt:
          "Current Zoning: CS-MU-CO-NP (general commercial services-mixed use-conditional overlay-neighborhood plan)",
      },
      note: null,
      remediation: "accept",
    },
  ],
};

describe("verification-report drift", () => {
  it("validates against verification-report.json schema", () => {
    const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const ok = validate(sampleReport);
    if (!ok) {
      throw new Error(
        `verification-report.json validation failed:\n${JSON.stringify(validate.errors, null, 2)}`,
      );
    }
    expect(ok).toBe(true);
  });

  it("preserves enum values across type and schema", () => {
    expect(sampleReport.overall_verdict).toBe("pass_clean");
    expect(sampleReport.claims[0]?.verdict).toBe("supported");
    expect(sampleReport.claims[0]?.remediation).toBe("accept");
  });
});
