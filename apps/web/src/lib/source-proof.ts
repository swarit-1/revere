// Picks the strongest single claim from a verification_report to render in
// the source-proof modal. Priority order: zoning sub-fields > extracted >
// quoted > structural. The chosen claim's evidence (raw_passage,
// source_locator, source_excerpt) becomes the modal's forensic detail.

import type { ClaimVerdict, VerificationReport } from "@revere/shared";

export interface SourceProofClaim {
  claim_id: string;
  claim_text: string;
  raw_passage: string | null;
  evidence: {
    source_index: number;
    source_locator: string;
    source_excerpt: string;
  } | null;
}

const CLAIM_TYPE_PRIORITY: Record<string, number> = {
  extracted: 0, // zoning sub-fields land here
  quoted: 1,
  cross_referenced: 2,
  structural: 3,
  temporal: 4,
  synthesis: 5,
  predictive: 6,
  editorial: 7,
};

function priorityFor(claim: ClaimVerdict): number {
  // Zoning sub-fields are the highest-signal source-proof claim — bump them.
  if (claim.claim_id.startsWith("zoning.")) return -10;
  if (claim.verdict !== "supported") return 100;
  if (!claim.evidence) return 90;
  return CLAIM_TYPE_PRIORITY[claim.claim_type] ?? 50;
}

export function pickSourceProof(
  report: VerificationReport | null,
): SourceProofClaim | null {
  if (!report || report.claims.length === 0) return null;
  const sorted = [...report.claims].sort((a, b) => priorityFor(a) - priorityFor(b));
  const top = sorted[0];
  if (!top || !top.evidence) {
    // Fall back to any supported claim with raw_passage.
    const fallback = sorted.find(
      (c) => c.verdict === "supported" && c.raw_passage,
    );
    if (!fallback) return null;
    return {
      claim_id: fallback.claim_id,
      claim_text: fallback.claim_text,
      raw_passage: fallback.raw_passage ?? null,
      evidence: fallback.evidence ?? null,
    };
  }
  return {
    claim_id: top.claim_id,
    claim_text: top.claim_text,
    raw_passage: top.raw_passage ?? null,
    evidence: top.evidence ?? null,
  };
}

export function sourceUrlFromItem(
  sources: Array<{ type: string; url: string }>,
  index: number,
): string | null {
  return sources[index]?.url ?? null;
}
