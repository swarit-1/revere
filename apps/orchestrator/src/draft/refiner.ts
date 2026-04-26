// Refiner — single Opus 4.7 call that takes 3 variants + 3 Critiques and
// emits 3 refined variants + a one-line response per variant. Per
// loop-protocol.md.

import type { Tool } from "@anthropic-ai/sdk/resources/messages.mjs";
import type {
  Critic,
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
import { VOICE_LIST, VOICE_PROMPTS } from "./voices.js";
import type { CritiqueOutput } from "./critic.js";

const REFINE_TOOL: Tool = {
  name: "emit_refined_drafts",
  description: "Emit refined drafts (3 variants), one response_to_critique per variant.",
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
            response_to_critique: { type: "string" },
          },
          required: ["voice", "text", "references", "response_to_critique"],
        },
      },
    },
    required: ["variants"],
  },
};

export interface RefinerVariant {
  voice: Voice;
  text: string;
  references: string[];
  response_to_critique: string;
}

export interface RefinerArgs {
  current: Array<{ voice: Voice; text: string; references: string[] }>;
  critiques: CritiqueOutput[];
  critic: Critic;
  item: Item;
  fingerprint: Fingerprint;
}

export interface RefinerResult {
  variants: RefinerVariant[];
  invocation: InvokeResult;
}

export async function runRefiner(args: RefinerArgs): Promise<RefinerResult> {
  const invocation = await invokeWithTool({
    model: OPUS,
    systemBlocks: [
      {
        type: "text",
        text: [
          "You are the refiner in Revere's adversarial draft loop.",
          "You receive 3 voice variants + a critique per variant from one critic.",
          "Your job: accept VALID critiques, defend against weak ones, strengthen the argument.",
          "  • Accept high-severity issues unless they would push the variant out of its voice register.",
          "  • Accept medium issues if the rewrite is faithful to the voice.",
          "  • Defend low-severity issues that the critic raised on style — don't over-soften.",
          "  • PRESERVE each voice's register. The Direct variant stays short and unhedged. The Measured stays balanced. The Persuasive keeps its rhetorical move.",
          "  • Each variant still cites the Legistar item id at the top.",
          "  • Each variant's response_to_critique is one short sentence: 'Accepted: X. Defended: Y.'",
          "",
          "VOICE SPECS (preserve these across refinement):",
          ...VOICE_LIST.map((v) => `\n--- ${v.toUpperCase()} ---\n${VOICE_PROMPTS[v]}`),
        ].join("\n"),
      },
    ],
    userMessage: [
      {
        type: "text",
        text: [
          `Item: ${args.item.id} — ${args.item.title}`,
          `Critic just attacked: ${args.critic}`,
          "",
          "Current variants + their critiques:",
          ...args.current.map((v) => {
            const crit = args.critiques.find((c) => c.voice === v.voice);
            return [
              "",
              `--- ${v.voice.toUpperCase()} ---`,
              "Current text:",
              v.text,
              "",
              `Critic remediation: ${crit?.remediation ?? "—"}`,
              "Issues:",
              ...(crit?.issues ?? []).map(
                (iss, k) =>
                  `  ${k + 1}. [${iss.severity}] ${iss.description}${iss.suggested_rewrite ? `\n     ↳ suggested: ${iss.suggested_rewrite}` : ""}`,
              ),
            ].join("\n");
          }),
          "",
          "Speaker fingerprint subset:",
          "```json",
          JSON.stringify(
            {
              location: args.fingerprint.location,
              housing: args.fingerprint.housing,
              priorities: args.fingerprint.priorities,
            },
            null,
            2,
          ),
          "```",
          "",
          "Emit 3 refined variants via emit_refined_drafts.",
        ].join("\n"),
      },
    ] as UserContentBlock[],
    tool: REFINE_TOOL,
    maxTokens: 4096,
  });

  const out = invocation.toolInput as { variants: RefinerVariant[] };
  return { variants: out.variants, invocation };
}
