// Anthropic SDK wrapper. Single client; advisor-strategy routing
// (Sonnet 4.6 default, Opus 4.7 escalation on ambiguous outputs).

import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  TextBlockParam,
  Tool,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages.mjs";

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (client) return client;
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY must be set (apps/orchestrator/.env.local).");
  }
  client = new Anthropic({ apiKey: key });
  return client;
}

export const SONNET = "claude-sonnet-4-6";
export const OPUS = "claude-opus-4-7";

// Prompt caching is GA on the Messages API at runtime, but @anthropic-ai/sdk@0.30.1
// only exposes cache_control / cache_*_input_tokens via beta namespaces. We define
// the GA shapes locally so callers stay type-safe; the cast at messages.create() is
// the single boundary where the SDK type gap is bridged.
export type CachedSystemBlock = TextBlockParam & {
  cache_control?: { type: "ephemeral" } | null;
};

export interface InvokeArgs {
  model: string;
  systemBlocks: CachedSystemBlock[]; // each may carry cache_control
  userMessage: string;
  tool: Tool;
  maxTokens?: number;
}

export interface InvokeResult {
  toolInput: unknown;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  model: string;
}

export async function invokeWithTool(args: InvokeArgs): Promise<InvokeResult> {
  const messages: MessageParam[] = [{ role: "user", content: args.userMessage }];
  const res = await anthropic().messages.create({
    model: args.model,
    max_tokens: args.maxTokens ?? 2048,
    // SDK 0.30.1 types don't include cache_control on TextBlockParam (GA-only in
    // newer SDKs). Runtime supports it; cast bridges the type gap.
    system: args.systemBlocks as TextBlockParam[],
    messages,
    tools: [args.tool],
    tool_choice: { type: "tool", name: args.tool.name },
  });

  let toolInput: unknown = null;
  for (const block of res.content) {
    if (block.type === "tool_use") {
      toolInput = (block as ToolUseBlock).input;
      break;
    }
  }
  if (toolInput === null) {
    throw new Error(
      `model ${args.model} returned no tool_use block (stop_reason=${res.stop_reason})`,
    );
  }

  const usage = res.usage as typeof res.usage & {
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  };
  return {
    toolInput,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
    model: args.model,
  };
}
