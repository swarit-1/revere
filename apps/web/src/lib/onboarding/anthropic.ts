// Anthropic SDK singleton for the web app. Server-only — never import
// from a client component. Throws if ANTHROPIC_API_KEY is missing.

import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (client) return client;
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY must be set (apps/web/.env.local).");
  }
  client = new Anthropic({ apiKey: key });
  return client;
}

export const OPUS = "claude-opus-4-7";
export const SONNET = "claude-sonnet-4-6";
