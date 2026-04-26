// Hand-written TS mirror of .claude/skills/verification/output-schemas/verification-report.json.
// Drift test in test/verification-report-drift.test.ts catches schema/type drift.

export type Verdict =
  | "supported"
  | "partially_supported"
  | "unsupported"
  | "contradicted"
  | "unverifiable";

export type OverallVerdict =
  | "pass_clean"
  | "pass_with_caveats"
  | "fail"
  | "halt_stale";

export type ClaimType =
  | "structural"
  | "extracted"
  | "quoted"
  | "cross_referenced"
  | "temporal"
  | "synthesis"
  | "predictive"
  | "editorial";

export type Remediation =
  | "accept"
  | "rewrite"
  | "drop"
  | "promote_source"
  | "defer_to_fingerprint"
  | "defer_to_t16_grader";

export type FetchStatus =
  | "ok"
  | "timeout"
  | "http_4xx"
  | "http_5xx"
  | "hash_mismatch"
  | "other_error";

export interface SourceReach {
  index: number;
  url: string;
  fetch_status: FetchStatus;
}

export interface ClaimEvidence {
  source_index: number;
  source_locator: string;
  source_excerpt: string;
}

export interface ClaimVerdict {
  claim_id: string;
  claim_type: ClaimType;
  claim_text: string;
  value?: null | string | number | boolean;
  raw_passage?: string | null;
  verdict: Verdict;
  evidence?: ClaimEvidence | null;
  note?: string | null;
  remediation: Remediation;
}

export interface FreshnessCheck {
  item_scraped_at: string;
  verified_at: string;
  stale: boolean;
}

export interface Coverage {
  total_claims: number;
  supported: number;
  partially_supported: number;
  unsupported: number;
  contradicted: number;
  unverifiable: number;
}

export interface VerificationReport {
  item_id: string;
  item_source_hash: string;
  verified_at: string;
  verifier_version: string;
  overall_verdict: OverallVerdict;
  freshness_check: FreshnessCheck;
  coverage: Coverage;
  sources_reached: SourceReach[];
  claims: ClaimVerdict[];
}
