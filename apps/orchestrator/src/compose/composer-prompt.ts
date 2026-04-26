// Composer prompt + tool schema. T-18 calls Opus 4.7 once per (user, briefing_date)
// with all surfaced briefing_items as input. The model emits a briefing payload
// via emit_briefing.

import type { Tool } from "@anthropic-ai/sdk/resources/messages.mjs";
import type { CachedSystemBlock } from "../lib/anthropic.js";

const SYSTEM_INSTRUCTIONS = `You are the Revere morning-briefing composer. You receive a user's civic fingerprint and a set of pre-scored, pre-verified briefing items for a single date. You emit one structured briefing payload via the emit_briefing tool.

HARD RULES:
1. Order items by post_score descending. Tiebreak by surface_reason priority: critical_override > score_above_threshold. Then by item.id ascending.
2. Top out at 5 items. If more than 5 surfaced, keep the top 5; the rest are visible only via the in-app feed (T-25).
3. Cover header format: "Revere · {Day} {Mon} {D} · {N} items for you" where N is the count you're about to render. Day/Mon are abbreviated English (e.g. "Thu Apr 9"). N must equal the length of the items[] array you emit.
4. Per-item "headline" is one declarative sentence under 100 chars derived from the item's title — strip Legistar boilerplate ("Approve", trailing parenthetical), keep substance.
5. Per-item "why_this" comes verbatim from the input briefing_item — DO NOT rewrite. The fingerprint-tie-back already contains the trust receipt.
6. Per-item "what_happened" is a 1–2 sentence neutral summary derived from item.title and item.body. No editorializing. Strip "Council District N" repetition (already implied by location pill).
7. No prose, no markdown wrapping the JSON. Emit via the tool.`;

export const EMIT_BRIEFING_TOOL: Tool = {
  name: "emit_briefing",
  description: "Emit the composed briefing payload for one (user, date).",
  input_schema: {
    type: "object",
    required: ["cover_header", "items", "coverage"],
    properties: {
      cover_header: { type: "string" },
      items: {
        type: "array",
        items: {
          type: "object",
          required: [
            "rank",
            "candidate_item_id",
            "item_id",
            "headline",
            "what_happened",
            "why_this",
            "post_score",
            "surface_reason",
          ],
          properties: {
            rank: { type: "integer", minimum: 1 },
            candidate_item_id: { type: "integer" },
            item_id: { type: "string" },
            headline: { type: "string", maxLength: 140 },
            what_happened: { type: "string", maxLength: 600 },
            why_this: { type: "string", maxLength: 200 },
            post_score: { type: "number", minimum: 0, maximum: 1 },
            surface_reason: {
              type: "string",
              enum: [
                "score_above_threshold",
                "critical_override",
                "below_threshold",
                "anti_priority_suppressed",
              ],
            },
          },
        },
      },
      coverage: {
        type: "object",
        required: ["candidate_items_considered", "verified", "surfaced"],
        properties: {
          candidate_items_considered: { type: "integer", minimum: 0 },
          verified: { type: "integer", minimum: 0 },
          surfaced: { type: "integer", minimum: 0 },
        },
      },
    },
  },
};

export function buildComposerSystemBlocks(): CachedSystemBlock[] {
  return [
    {
      type: "text",
      text: SYSTEM_INSTRUCTIONS,
      cache_control: { type: "ephemeral" },
    },
  ];
}
