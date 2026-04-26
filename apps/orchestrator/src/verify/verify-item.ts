// Single-item verification call. Builds sources_map, invokes the verifier
// via Anthropic Messages API + emit_verification_report tool, returns a
// VerificationReport plus the InvokeResult for cost tracking.
//
// Cost-control strategy (per Session 5 plan revision):
// - Sonnet 4.6 instead of Opus 4.7 for bulk verification. The 2 successful
//   smoke-test reports under Opus showed pass_with_caveats with 17/20 and
//   15/19 supported claims; quality is in extraction, not creative reasoning.
//   PRD §15 names Opus for verification but CLAUDE.md ranks "cheapest model
//   that clears the quality bar" higher. T-15 ships Sonnet; if the gate
//   shows quality regression, escalate to Opus and re-budget.
// - Agenda PDF (35K chars; same across all 56 items) goes in a cache_control'd
//   user-content block. After the first call, every subsequent call reads it
//   at 10% of fresh-input price.
// - Per-source byte cap (12K chars) prevents any single attachment from
//   blowing the budget.
// - Server-side overall_verdict rollup defense: if the model returns null,
//   recompute from coverage per the prompt's Step 6 rules.

import type { Item, OverallVerdict, VerificationReport } from "@revere/shared";
import {
  invokeWithTool,
  SONNET,
  type InvokeResult,
  type UserContentBlock,
} from "../lib/anthropic.js";
import { buildVerifierSystemBlocks, EMIT_VERIFICATION_REPORT_TOOL } from "./verifier-prompt.js";
import { buildSourcesMap, type SourceFetchResult } from "./sources.js";

const VERIFIER_VERSION = "v1";
const AGENDA_PDF_CHAR_CAP = 50_000; // covers most Austin packets; truncates rare giants

export interface VerifyItemArgs {
  item: Item;
  agendaPdfText: string | null;
  verifiedAt?: string;
}

export interface VerifyItemResult {
  report: VerificationReport;
  invocation: InvokeResult;
  fetch_results: SourceFetchResult[];
  drift_detected: boolean;
}

export async function verifyItem(args: VerifyItemArgs): Promise<VerifyItemResult> {
  const verifiedAt = args.verifiedAt ?? new Date().toISOString();
  const { item } = args;

  const ctx = await buildSourcesMap({
    item,
    agendaPdfText: args.agendaPdfText,
  });

  const userContent = buildUserContent({
    item,
    sources_map: ctx.sources_map,
    agendaPdfText: args.agendaPdfText,
    verified_at: verifiedAt,
  });

  const invocation = await invokeWithTool({
    model: SONNET,
    systemBlocks: buildVerifierSystemBlocks(),
    userMessage: userContent,
    tool: EMIT_VERIFICATION_REPORT_TOOL,
    // 8192: large zoning items (28+ claims with raw_passage excerpts) exceeded
    // the prior 4096 cap and arrived with claims:[] but coverage filled in.
    maxTokens: 8192,
  });

  const reportRaw = invocation.toolInput as Partial<VerificationReport> & {
    overall_verdict?: OverallVerdict | null;
  };

  const overall =
    reportRaw.overall_verdict ?? rollupFromCoverage(reportRaw.coverage);

  const report: VerificationReport = {
    item_id: reportRaw.item_id ?? item.id,
    item_source_hash: reportRaw.item_source_hash ?? item.source_hash,
    verified_at: verifiedAt,
    verifier_version: VERIFIER_VERSION,
    overall_verdict: overall,
    freshness_check: reportRaw.freshness_check ?? {
      item_scraped_at: item.scraped_at,
      verified_at: verifiedAt,
      stale: false,
    },
    coverage: reportRaw.coverage ?? {
      total_claims: 0,
      supported: 0,
      partially_supported: 0,
      unsupported: 0,
      contradicted: 0,
      unverifiable: 0,
    },
    sources_reached: reportRaw.sources_reached ?? [],
    claims: reportRaw.claims ?? [],
  };

  return {
    report,
    invocation,
    fetch_results: ctx.fetch_results,
    drift_detected: ctx.drift_detected,
  };
}

function rollupFromCoverage(
  coverage: VerificationReport["coverage"] | undefined,
): OverallVerdict {
  if (!coverage || coverage.total_claims === 0) return "fail";
  if (coverage.contradicted > 0 || coverage.unsupported > 0) return "fail";
  if (coverage.partially_supported > 0 || coverage.unverifiable > 0)
    return "pass_with_caveats";
  return "pass_clean";
}

interface UserContentArgs {
  item: Item;
  sources_map: Record<number, string>;
  agendaPdfText: string | null;
  verified_at: string;
}

function buildUserContent(args: UserContentArgs): UserContentBlock[] {
  const agendaIdx = args.item.sources.findIndex((s) => s.type === "agenda_pdf");
  const agendaText = args.agendaPdfText ?? "";
  const agendaTrimmed =
    agendaText.length > AGENDA_PDF_CHAR_CAP
      ? `${agendaText.slice(0, AGENDA_PDF_CHAR_CAP)}\n…[truncated ${agendaText.length - AGENDA_PDF_CHAR_CAP} chars]`
      : agendaText;

  const blocks: UserContentBlock[] = [];

  if (agendaIdx >= 0 && agendaTrimmed.length > 0) {
    blocks.push({
      type: "text",
      text: [
        "=== Shared meeting context (cached across items) ===",
        "",
        `Agenda packet text (item.sources[${agendaIdx}], type "agenda_pdf"). The same agenda PDF is referenced by every item in this meeting. When verifying claims that cite source_index ${agendaIdx}, treat THIS block as that source's text.`,
        "",
        "BEGIN agenda packet text",
        agendaTrimmed,
        "END agenda packet text",
      ].join("\n"),
      cache_control: { type: "ephemeral" },
    });
  }

  blocks.push({
    type: "text",
    text: [
      "=== Per-item input ===",
      "",
      `verified_at: ${args.verified_at}`,
      "",
      `Note: sources_map below excludes the agenda_pdf source (provided in the cached block above). For all other source indices that appear in item.sources but are absent from sources_map, treat as "could not be reached" per the verifier-prompt's degradation rules.`,
      "",
      "item:",
      "```json",
      JSON.stringify(args.item, null, 2),
      "```",
      "",
      "sources_map:",
      "```json",
      JSON.stringify(args.sources_map, null, 2),
      "```",
      "",
      "Emit the verification_report via emit_verification_report.",
    ].join("\n"),
  });

  return blocks;
}
