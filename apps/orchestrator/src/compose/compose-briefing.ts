// Per-(user, briefing_date) composer. Loads surfaced briefing_items joined to
// candidate_items + verification_reports, calls Opus 4.7 once with the full
// per-user context, persists the briefing row + updates briefing_items.rank.

import type { Item, RelevanceScore } from "@revere/shared";
import {
  invokeWithTool,
  OPUS,
  type InvokeResult,
} from "../lib/anthropic.js";
import { supabase } from "../lib/supabase.js";
import { buildComposerSystemBlocks, EMIT_BRIEFING_TOOL } from "./composer-prompt.js";
import { upsertBriefing } from "./persist.js";

const COMPOSER_VERSION = "v1";

interface SurfacedRow {
  briefing_item_id: number;
  candidate_item_id: number;
  verification_report_id: number;
  post_score: number;
  surface_reason: string;
  why_this: string;
  score: RelevanceScore;
  item: Item;
}

interface ComposeArgs {
  user_id: string;
  briefing_date: string;
  fingerprint_version_used: string;
  candidate_items_considered: number;
  verified: number;
}

export interface ComposeResult {
  briefingId: number;
  surfacedCount: number;
  invocation: InvocationOrSkip;
  payload: BriefingPayload;
}

export type InvocationOrSkip =
  | { kind: "skipped"; reason: string }
  | { kind: "invoked"; invocation: InvokeResult };

export interface BriefingPayloadItem {
  rank: number;
  candidate_item_id: number;
  item_id: string;
  headline: string;
  what_happened: string;
  why_this: string;
  post_score: number;
  surface_reason: string;
}

export interface BriefingPayload {
  cover_header: string;
  items: BriefingPayloadItem[];
  coverage: {
    candidate_items_considered: number;
    verified: number;
    surfaced: number;
  };
  fingerprint_version_used: string;
  composer_version: string;
  generated_at: string;
  trace: {
    matcher_session_id?: number | null;
  };
}

export async function loadSurfacedItems(args: {
  user_id: string;
  briefing_date: string;
}): Promise<SurfacedRow[]> {
  const sb = supabase();
  const { data, error } = await sb
    .from("briefing_items")
    .select(
      "id, candidate_item_id, verification_report_id, post_score, surface_reason, why_this, score, candidate_items!inner(item)",
    )
    .eq("user_id", args.user_id)
    .eq("briefing_date", args.briefing_date)
    .eq("surfaced", true)
    .order("post_score", { ascending: false });
  if (error || !data) {
    throw new Error(`failed to load surfaced briefing_items: ${error?.message}`);
  }
  return data.map((r) => ({
    briefing_item_id: r.id as number,
    candidate_item_id: r.candidate_item_id as number,
    verification_report_id: r.verification_report_id as number,
    post_score: r.post_score as number,
    surface_reason: r.surface_reason as string,
    why_this: r.why_this as string,
    score: r.score as RelevanceScore,
    item: (r as unknown as { candidate_items: { item: Item } }).candidate_items.item,
  }));
}

export async function compose(args: ComposeArgs): Promise<ComposeResult> {
  const surfaced = await loadSurfacedItems({
    user_id: args.user_id,
    briefing_date: args.briefing_date,
  });

  const generated_at = new Date().toISOString();

  if (surfaced.length === 0) {
    const payload: BriefingPayload = {
      cover_header: emptyCoverHeader(args.briefing_date),
      items: [],
      coverage: {
        candidate_items_considered: args.candidate_items_considered,
        verified: args.verified,
        surfaced: 0,
      },
      fingerprint_version_used: args.fingerprint_version_used,
      composer_version: COMPOSER_VERSION,
      generated_at,
      trace: {},
    };
    const { id } = await upsertBriefing({
      user_id: args.user_id,
      briefing_date: args.briefing_date,
      payload,
      generated_at,
    });
    return {
      briefingId: id,
      surfacedCount: 0,
      invocation: { kind: "skipped", reason: "no surfaced items" },
      payload,
    };
  }

  const invocation = await invokeWithTool({
    model: OPUS,
    systemBlocks: buildComposerSystemBlocks(),
    userMessage: buildUserMessage({
      user_id: args.user_id,
      briefing_date: args.briefing_date,
      surfaced,
    }),
    tool: EMIT_BRIEFING_TOOL,
    maxTokens: 3000,
  });

  const out = invocation.toolInput as {
    cover_header: string;
    items: BriefingPayloadItem[];
    coverage: {
      candidate_items_considered: number;
      verified: number;
      surfaced: number;
    };
  };

  const payload: BriefingPayload = {
    cover_header: out.cover_header,
    items: out.items,
    coverage: {
      candidate_items_considered: args.candidate_items_considered,
      verified: args.verified,
      surfaced: surfaced.length,
    },
    fingerprint_version_used: args.fingerprint_version_used,
    composer_version: COMPOSER_VERSION,
    generated_at,
    trace: {},
  };

  const { id } = await upsertBriefing({
    user_id: args.user_id,
    briefing_date: args.briefing_date,
    payload,
    generated_at,
  });

  // Update briefing_items.rank for each surfaced item per the composed order.
  await updateRanks(out.items);

  return {
    briefingId: id,
    surfacedCount: surfaced.length,
    invocation: { kind: "invoked", invocation },
    payload,
  };
}

async function updateRanks(items: BriefingPayloadItem[]): Promise<void> {
  const sb = supabase();
  for (const it of items) {
    await sb
      .from("briefing_items")
      .update({ rank: it.rank })
      .eq("candidate_item_id", it.candidate_item_id);
  }
}

function emptyCoverHeader(briefing_date: string): string {
  const d = formatDate(briefing_date);
  return `Revere · ${d} · 0 items for you`;
}

function formatDate(briefing_date: string): string {
  const [y, m, d] = briefing_date.split("-").map((s) => Number.parseInt(s, 10));
  const dt = new Date(Date.UTC(y!, (m! - 1), d!));
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getUTCDay()];
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][dt.getUTCMonth()];
  return `${day} ${mon} ${dt.getUTCDate()}`;
}

interface UserMessageArgs {
  user_id: string;
  briefing_date: string;
  surfaced: SurfacedRow[];
}

function buildUserMessage(args: UserMessageArgs): string {
  const lines: string[] = [];
  lines.push(`user_id: ${args.user_id}`);
  lines.push(`briefing_date: ${args.briefing_date}`);
  lines.push(`expected cover-header date: ${formatDate(args.briefing_date)}`);
  lines.push("");
  lines.push("Surfaced briefing items (post-verification, post-scoring):");
  for (const s of args.surfaced) {
    const it = s.item;
    const body = it.body
      ? it.body.length > 600
        ? `${it.body.slice(0, 600)}…`
        : it.body
      : "";
    lines.push("---");
    lines.push(`candidate_item_id: ${s.candidate_item_id}`);
    lines.push(`item.id: ${it.id}`);
    lines.push(`item.title: ${it.title}`);
    lines.push(`item.location.council_district: ${it.location?.council_district ?? "null"}`);
    lines.push(`item.body: ${body}`);
    lines.push(`post_score: ${s.post_score}`);
    lines.push(`surface_reason: ${s.surface_reason}`);
    lines.push(`why_this: ${s.why_this}`);
  }
  lines.push("");
  lines.push("Emit the briefing via emit_briefing.");
  return lines.join("\n");
}
