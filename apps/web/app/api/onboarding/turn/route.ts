// POST /api/onboarding/turn
//
// One turn of the T-29 onboarding conversation. Caller sends:
//   { messages: Array<{ role: "user" | "assistant", content: string }> }
//
// Server:
//   1. Authenticates via supabase server client.
//   2. Calls Opus 4.7 with the locked system prompt + emit_fingerprint tool.
//   3. Returns one of:
//        { kind: "say", text: "..." }                 — Claude is asking next
//        { kind: "done", summary, fingerprint }       — wrap-up: tool was called
//
// Persistence is NOT done here. The client confirms the fingerprint via
// /api/onboarding/finalize. This split lets the user reject the
// summary and continue the conversation.

import { NextResponse } from "next/server";
import type { MessageParam, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages.mjs";
import type { Fingerprint } from "@revere/shared";
import { anthropic, OPUS } from "@/lib/onboarding/anthropic";
import { ONBOARDING_SYSTEM_PROMPT } from "@/lib/onboarding/system-prompt";
import { EMIT_FINGERPRINT_TOOL } from "@/lib/onboarding/fingerprint-tool";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

interface IncomingBody {
  messages: IncomingMessage[];
}

const MAX_TURNS = 16; // PRD §8.3 / system-prompt cap.

export async function POST(request: Request) {
  // Auth gate — must be signed in to onboard.
  const sb = await supabaseServer();
  const { data: { user }, error: userErr } = await sb.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  let body: IncomingBody;
  try {
    body = (await request.json()) as IncomingBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: "messages must be array" }, { status: 400 });
  }

  // Drop any prior messages with empty content; cap at MAX_TURNS user
  // messages so a malicious client can't bloat the prompt.
  const cleaned = body.messages
    .filter((m) => m.role && typeof m.content === "string" && m.content.trim().length > 0)
    .map<MessageParam>((m) => ({ role: m.role, content: m.content }));

  const userTurnCount = cleaned.filter((m) => m.role === "user").length;
  if (userTurnCount > MAX_TURNS) {
    return NextResponse.json(
      { error: `conversation length capped at ${MAX_TURNS} user turns` },
      { status: 400 },
    );
  }

  // If this is the very first call, the messages array is empty — Claude
  // will produce the opening turn. We seed a synthetic user message so
  // the API has something to respond to.
  const messages: MessageParam[] =
    cleaned.length === 0
      ? [{ role: "user", content: "Hello." }]
      : cleaned;

  try {
    const res = await anthropic().messages.create({
      model: OPUS,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: ONBOARDING_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" } as never,
        } as never,
      ],
      messages,
      tools: [EMIT_FINGERPRINT_TOOL],
      // Let Claude decide between text and tool — wrap-up is the only
      // time tool_use should fire.
      tool_choice: { type: "auto" },
    });

    // Two paths: tool_use (wrap-up) OR text only (next question).
    let toolBlock: ToolUseBlock | null = null;
    let text = "";
    for (const block of res.content) {
      if (block.type === "tool_use") {
        toolBlock = block as ToolUseBlock;
      } else if (block.type === "text") {
        text += (text ? "\n\n" : "") + block.text;
      }
    }

    if (toolBlock) {
      const input = toolBlock.input as {
        summary?: string;
        fingerprint?: Fingerprint;
      };
      if (!input.summary || !input.fingerprint) {
        return NextResponse.json(
          { error: "emit_fingerprint missing summary or fingerprint" },
          { status: 502 },
        );
      }
      return NextResponse.json({
        kind: "done",
        text: text || input.summary, // assistant final prose
        summary: input.summary,
        fingerprint: input.fingerprint,
      });
    }

    if (!text) {
      return NextResponse.json(
        { error: `model returned no text (stop_reason=${res.stop_reason})` },
        { status: 502 },
      );
    }

    return NextResponse.json({
      kind: "say",
      text,
      turn: userTurnCount + 1,
      max_turns: MAX_TURNS,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `anthropic call failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
