// Sonnet-driven semantic judgments for the scoring rubric:
//  - priority_phrase_match: any priority phrase semantically matches title/body
//  - anti_priority_hit + anti_priority_tag: any anti-tag semantically matches
//  - geography_via_commute: when item district != user district, does any
//    commute_route_keyword overlap the item's body/location?
//  - geography_extension: when item is citywide (D0), does it have direct
//    downstream effect on the user's district?
//
// Pattern mirrors classify.ts: Anthropic Messages API, tool-forced output
// for structured judgment, prompt caching on the per-user fingerprint context.

import type { Tool } from "@anthropic-ai/sdk/resources/messages.mjs";
import type { Fingerprint, Item } from "@revere/shared";
import {
  invokeWithTool,
  SONNET,
  type CachedSystemBlock,
  type InvokeResult,
} from "../lib/anthropic.js";
import type { ScoringJudgments } from "./scoring.js";

const SYSTEM_INSTRUCTIONS = `You are a fingerprint-matching judge. You receive ONE Austin City Council agenda item (title + body + location) and a user's civic fingerprint. You emit four boolean judgments via the emit_judgments tool. No prose, no editorializing.

JUDGMENT RULES:
1. priority_phrase_match — set TRUE iff any priority phrase semantically matches the item's title or body. Examples: "housing_cost" matches "rent stabilization" or "tenant relocation"; "small_business_permitting" matches "TABC license review"; "school_quality" matches "AISD bond proposal." Mere topic overlap (e.g., a budget item ≠ "property_taxes" unless the item is specifically about taxation) does NOT count. When in doubt, FALSE.
2. anti_priority_hit + anti_priority_tag — set TRUE iff any anti-priority phrase semantically matches the item. The tag is the matched anti string. Examples: "dog_parks" matches "approve dog park expansion" but NOT "downtown park improvement"; "sister_city_proclamations" matches "proclamation honoring sister city Toulouse." Match is per-item; one match suffices.
3. geography_via_commute — set TRUE iff the item is in a council district DIFFERENT from the user's, but the user's commute_route_keywords overlap the item's body/title. Example: user has commute keyword "E 6th" and item is in D9 about a 6th Street corridor.
4. geography_extension — set TRUE iff the item is CITYWIDE (council_district=0) AND has a direct downstream effect on the user's district per its own body text. Most citywide items do NOT meet this bar.

Match is semantic, not literal substring. Be conservative.`;

const EMIT_JUDGMENTS_TOOL: Tool = {
  name: "emit_judgments",
  description: "Emit the four scoring judgments for this (user × item) pair.",
  input_schema: {
    type: "object",
    required: [
      "priority_phrase_match",
      "anti_priority_hit",
      "anti_priority_tag",
      "geography_via_commute",
      "geography_extension",
    ],
    properties: {
      priority_phrase_match: { type: "boolean" },
      anti_priority_hit: { type: "boolean" },
      anti_priority_tag: { type: ["string", "null"] },
      geography_via_commute: { type: "boolean" },
      geography_extension: { type: "boolean" },
    },
  },
};

function buildSystemBlocks(fp: Fingerprint): CachedSystemBlock[] {
  const fpDigest = JSON.stringify(
    {
      user_id: fp.user_id,
      location: {
        council_district: fp.location.council_district,
      },
      work: {
        commute_route_keywords: fp.work.commute_route_keywords,
      },
      priorities: fp.priorities,
      anti_priorities: fp.anti_priorities,
    },
    null,
    2,
  );
  return [
    { type: "text", text: SYSTEM_INSTRUCTIONS },
    {
      type: "text",
      text: `=== Fingerprint context (cached across this user's items) ===\n\n${fpDigest}`,
      cache_control: { type: "ephemeral" },
    },
  ];
}

function buildUserMessage(item: Item): string {
  const lines = [
    `item.id: ${item.id}`,
    `item.location.council_district: ${item.location?.council_district ?? "null"}`,
    `item.title: ${item.title}`,
  ];
  if (item.body && item.body.trim().length > 0) {
    const body = item.body.length > 2000 ? `${item.body.slice(0, 2000)}…` : item.body;
    lines.push(`item.body: ${body}`);
  }
  lines.push("");
  lines.push("Emit the four judgments via emit_judgments.");
  return lines.join("\n");
}

export interface JudgmentResult {
  judgments: ScoringJudgments;
  invocation: InvokeResult;
}

export async function judgeItem(args: {
  fingerprint: Fingerprint;
  item: Item;
}): Promise<JudgmentResult> {
  const result = await invokeWithTool({
    model: SONNET,
    systemBlocks: buildSystemBlocks(args.fingerprint),
    userMessage: buildUserMessage(args.item),
    tool: EMIT_JUDGMENTS_TOOL,
    maxTokens: 256,
  });
  const out = result.toolInput as {
    priority_phrase_match: boolean;
    anti_priority_hit: boolean;
    anti_priority_tag: string | null;
    geography_via_commute: boolean;
    geography_extension: boolean;
  };
  return {
    judgments: {
      priority_phrase_match: !!out.priority_phrase_match,
      anti_priority_hit: !!out.anti_priority_hit,
      anti_priority_tag: out.anti_priority_tag ?? null,
      geography_via_commute: !!out.geography_via_commute,
      geography_extension: !!out.geography_extension,
    },
    invocation: result,
  };
}
