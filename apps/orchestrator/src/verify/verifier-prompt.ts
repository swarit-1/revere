// Loads the verification skill pack and assembles cached system blocks for
// the verifier call. Pattern mirrors classify.ts: per-runtime cache, skill
// pack content goes behind cache_control: ephemeral.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Tool } from "@anthropic-ai/sdk/resources/messages.mjs";
import type { CachedSystemBlock } from "../lib/anthropic.js";

const here = dirname(fileURLToPath(import.meta.url));
const skillPackRoot = join(
  here,
  "..",
  "..",
  "..",
  "..",
  ".claude",
  "skills",
  "verification",
);

function readSkillFile(rel: string): string {
  return readFileSync(join(skillPackRoot, rel), "utf8");
}

let cachedSkillPack: string | null = null;
function loadSkillPack(): string {
  if (cachedSkillPack) return cachedSkillPack;
  const files = [
    "SKILL.md",
    "reference/verifier-prompt.md",
    "reference/claim-typology.md",
    "reference/degradation-policy.md",
    "reference/synthesis-split.md",
  ];
  const blocks = files.map((f) => `=== ${f} ===\n${readSkillFile(f)}`);
  cachedSkillPack = blocks.join("\n\n");
  return cachedSkillPack;
}

const SYSTEM_INSTRUCTIONS = `You are the verifier described in the skill pack below.
Read the skill pack carefully — verifier-prompt.md is the canonical protocol.
The caller will supply (item, sources_map, verified_at) in the user turn.
Emit exactly one verification_report via the emit_verification_report tool.
No prose, no markdown, no apology. Diagnostics over rejection.`;

export function buildVerifierSystemBlocks(): CachedSystemBlock[] {
  return [
    { type: "text", text: SYSTEM_INSTRUCTIONS },
    {
      type: "text",
      text: `=== Verification skill pack (loaded once, cached) ===\n\n${loadSkillPack()}`,
      cache_control: { type: "ephemeral" },
    },
  ];
}

const verdictEnum = [
  "supported",
  "partially_supported",
  "unsupported",
  "contradicted",
  "unverifiable",
];
const remediationEnum = [
  "accept",
  "rewrite",
  "drop",
  "promote_source",
  "defer_to_fingerprint",
  "defer_to_t16_grader",
];
const claimTypeEnum = [
  "structural",
  "extracted",
  "quoted",
  "cross_referenced",
  "temporal",
  "synthesis",
  "predictive",
  "editorial",
];
const fetchStatusEnum = [
  "ok",
  "timeout",
  "http_4xx",
  "http_5xx",
  "hash_mismatch",
  "other_error",
];

export const EMIT_VERIFICATION_REPORT_TOOL: Tool = {
  name: "emit_verification_report",
  description:
    "Emit the verification_report record per the skill pack's output schema.",
  input_schema: {
    type: "object",
    required: [
      "item_id",
      "item_source_hash",
      "verified_at",
      "verifier_version",
      "overall_verdict",
      "freshness_check",
      "coverage",
      "sources_reached",
      "claims",
    ],
    properties: {
      item_id: { type: "string" },
      item_source_hash: { type: "string" },
      verified_at: { type: "string" },
      verifier_version: { type: "string" },
      overall_verdict: {
        type: "string",
        enum: ["pass_clean", "pass_with_caveats", "fail", "halt_stale"],
      },
      freshness_check: {
        type: "object",
        required: ["item_scraped_at", "verified_at", "stale"],
        properties: {
          item_scraped_at: { type: "string" },
          verified_at: { type: "string" },
          stale: { type: "boolean" },
        },
      },
      coverage: {
        type: "object",
        required: [
          "total_claims",
          "supported",
          "partially_supported",
          "unsupported",
          "contradicted",
          "unverifiable",
        ],
        properties: {
          total_claims: { type: "integer", minimum: 0 },
          supported: { type: "integer", minimum: 0 },
          partially_supported: { type: "integer", minimum: 0 },
          unsupported: { type: "integer", minimum: 0 },
          contradicted: { type: "integer", minimum: 0 },
          unverifiable: { type: "integer", minimum: 0 },
        },
      },
      sources_reached: {
        type: "array",
        items: {
          type: "object",
          required: ["index", "url", "fetch_status"],
          properties: {
            index: { type: "integer", minimum: 0 },
            url: { type: "string" },
            fetch_status: { type: "string", enum: fetchStatusEnum },
          },
        },
      },
      claims: {
        type: "array",
        items: {
          type: "object",
          required: [
            "claim_id",
            "claim_type",
            "claim_text",
            "verdict",
            "remediation",
          ],
          properties: {
            claim_id: { type: "string" },
            claim_type: { type: "string", enum: claimTypeEnum },
            claim_text: { type: "string" },
            value: { type: ["string", "integer", "boolean", "null"] },
            raw_passage: { type: ["string", "null"] },
            verdict: { type: "string", enum: verdictEnum },
            evidence: {
              type: ["object", "null"],
              required: ["source_index", "source_locator", "source_excerpt"],
              properties: {
                source_index: { type: "integer", minimum: 0 },
                source_locator: { type: "string" },
                source_excerpt: { type: "string" },
              },
            },
            note: { type: ["string", "null"] },
            remediation: { type: "string", enum: remediationEnum },
          },
        },
      },
    },
  },
};
