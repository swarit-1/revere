// Single critic pass. Receives the current 3 variants, returns 3 Critiques.
// Per critics.ts + loop-protocol.md.

import type { Tool } from "@anthropic-ai/sdk/resources/messages.mjs";
import type {
  Critic,
  CritiqueIssue,
  CriticRemediation,
  Fingerprint,
  Item,
  Voice,
} from "@revere/shared";
import {
  invokeWithTool,
  OPUS,
  type InvokeResult,
  type UserContentBlock,
} from "../lib/anthropic.js";
import { CRITIC_SYSTEM_PROMPTS } from "./critics.js";

const CRITIQUE_TOOL: Tool = {
  name: "emit_critique",
  description: "Return one critique per voice variant (3 total).",
  input_schema: {
    type: "object",
    properties: {
      critiques: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            voice: { type: "string", enum: ["direct", "measured", "persuasive"] },
            issues: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                properties: {
                  severity: { type: "string", enum: ["high", "medium", "low"] },
                  description: { type: "string" },
                  suggested_rewrite: { type: "string" },
                },
                required: ["severity", "description"],
              },
            },
            remediation: {
              type: "string",
              enum: ["accept_some", "accept_all", "defend"],
            },
          },
          required: ["voice", "issues", "remediation"],
        },
      },
    },
    required: ["critiques"],
  },
};

export interface CritiqueOutput {
  voice: Voice;
  issues: CritiqueIssue[];
  remediation: CriticRemediation;
}

export interface CriticArgs {
  critic: Critic;
  variants: Array<{ voice: Voice; text: string }>;
  item: Item;
  fingerprint: Fingerprint;
}

export interface CriticResult {
  critiques: CritiqueOutput[];
  invocation: InvokeResult;
}

export async function runCritic(args: CriticArgs): Promise<CriticResult> {
  const invocation = await invokeWithTool({
    model: OPUS,
    systemBlocks: [
      {
        type: "text",
        text: CRITIC_SYSTEM_PROMPTS[args.critic],
      },
    ],
    userMessage: [
      {
        type: "text",
        text: [
          `Item: ${args.item.id} — ${args.item.title}`,
          "",
          "Variants under review:",
          "",
          ...args.variants.map(
            (v, i) =>
              `--- variant ${i + 1} (voice=${v.voice}) ---\n${v.text}\n`,
          ),
          "",
          "Speaker's fingerprint subset:",
          "```json",
          JSON.stringify(
            {
              location: args.fingerprint.location,
              housing: args.fingerprint.housing,
              priorities: args.fingerprint.priorities,
              anti_priorities: args.fingerprint.anti_priorities,
            },
            null,
            2,
          ),
          "```",
          "",
          "Return critiques in voice order: direct, measured, persuasive. Each must have at least one issue.",
        ].join("\n"),
      },
    ] as UserContentBlock[],
    tool: CRITIQUE_TOOL,
    maxTokens: 3072,
  });

  const out = invocation.toolInput as { critiques: CritiqueOutput[] };
  return { critiques: out.critiques, invocation };
}
