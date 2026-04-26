// First-pass writer. Single Opus 4.7 call emits all three voice variants
// in one tool_use. Per loop-protocol.md.

import type { Tool } from "@anthropic-ai/sdk/resources/messages.mjs";
import type {
  Fingerprint,
  Item,
  VerificationReport,
  Voice,
} from "@revere/shared";
import {
  invokeWithTool,
  OPUS,
  type CachedSystemBlock,
  type InvokeResult,
  type UserContentBlock,
} from "../lib/anthropic.js";
import { VOICE_LIST, VOICE_PROMPTS } from "./voices.js";

const WRITE_DRAFTS_TOOL: Tool = {
  name: "emit_initial_drafts",
  description: "Emit one initial draft per voice (direct, measured, persuasive).",
  input_schema: {
    type: "object",
    properties: {
      variants: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            voice: { type: "string", enum: ["direct", "measured", "persuasive"] },
            text: { type: "string" },
            references: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
            },
          },
          required: ["voice", "text", "references"],
        },
      },
    },
    required: ["variants"],
  },
};

export interface WriterDraft {
  voice: Voice;
  text: string;
  references: string[];
}

export interface WriterArgs {
  item: Item;
  fingerprint: Fingerprint;
  verification: VerificationReport;
}

export interface WriterResult {
  variants: WriterDraft[];
  invocation: InvokeResult;
}

export async function runWriter(args: WriterArgs): Promise<WriterResult> {
  const supportedClaims = args.verification.claims.filter((c) => c.verdict === "supported");

  const systemBlocks: CachedSystemBlock[] = [
    {
      type: "text",
      text: [
        "You are Revere, the user's civic chief of staff drafting a public comment for an Austin City Council item.",
        "",
        "HARD RULES:",
        "  1. Each draft must reference the Legistar item id (e.g. '26-1501') exactly once near the top.",
        "  2. Each draft draws stakes only from the user's fingerprint priorities + supported claims provided below.",
        "     Do NOT invent quotes, statistics, or personal anecdotes the user didn't supply.",
        "  3. Do NOT include the user's name, address, or contact info — those are added at mailto-encoding time.",
        "  4. Each draft must close with the voice-specific closing (see voice spec).",
        "  5. The three drafts must clearly differ in sentence structure (not just word choice).",
        "  6. Reference the council member by title, not name (e.g. 'Council Member', 'Mayor').",
        "",
        "VOICE SPECS:",
        ...VOICE_LIST.map((v) => `\n--- ${v.toUpperCase()} ---\n${VOICE_PROMPTS[v]}`),
        "",
        "Emit all three variants via emit_initial_drafts.",
      ].join("\n"),
      cache_control: { type: "ephemeral" },
    },
  ];

  const userContent: UserContentBlock[] = [
    {
      type: "text",
      text: [
        "ITEM:",
        "```json",
        JSON.stringify(
          {
            id: args.item.id,
            type: args.item.type,
            title: args.item.title,
            body: args.item.body,
            location: args.item.location,
            zoning: args.item.zoning,
            topics: args.item.topics,
            sponsors: args.item.sponsors,
          },
          null,
          2,
        ),
        "```",
        "",
        "FINGERPRINT (subset relevant to drafting):",
        "```json",
        JSON.stringify(
          {
            user_id: args.fingerprint.user_id,
            location: args.fingerprint.location,
            housing: args.fingerprint.housing,
            household: args.fingerprint.household,
            work: args.fingerprint.work,
            priorities: args.fingerprint.priorities,
            anti_priorities: args.fingerprint.anti_priorities,
          },
          null,
          2,
        ),
        "```",
        "",
        "VERIFIED SUPPORTED CLAIMS (use these as the only factual basis):",
        "```json",
        JSON.stringify(
          supportedClaims.slice(0, 12).map((c) => ({
            claim_id: c.claim_id,
            claim_text: c.claim_text,
            value: c.value ?? null,
          })),
          null,
          2,
        ),
        "```",
        "",
        "Emit three initial drafts via emit_initial_drafts.",
      ].join("\n"),
    },
  ];

  const invocation = await invokeWithTool({
    model: OPUS,
    systemBlocks,
    userMessage: userContent,
    tool: WRITE_DRAFTS_TOOL,
    maxTokens: 4096,
  });

  const out = invocation.toolInput as { variants: WriterDraft[] };
  return { variants: out.variants, invocation };
}
