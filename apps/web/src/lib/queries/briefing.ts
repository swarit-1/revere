// Server-side briefing queries. Read paths are RLS-gated when called via
// the server client (auth-cookie); the /demo route swaps in the admin
// client to bypass.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item, RelevanceScore, VerificationReport } from "@revere/shared";

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
}

export interface BriefingRow {
  user_id: string;
  briefing_date: string;
  payload: BriefingPayload;
}

export async function loadLatestBriefing(
  sb: SupabaseClient,
  fingerprintUserId: string,
): Promise<BriefingRow | null> {
  const { data, error } = await sb
    .from("briefings")
    .select("user_id, briefing_date, payload")
    .eq("user_id", fingerprintUserId)
    .order("briefing_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`loadLatestBriefing: ${error.message}`);
  return (data as BriefingRow | null) ?? null;
}

export interface BriefingItemDetail {
  candidate_item_id: number;
  item: Item;
  score: RelevanceScore;
  verification_report: VerificationReport;
  payload_item: BriefingPayloadItem;
}

// For the source-proof modal: fetches the candidate_item + verification_report
// joined to the briefing_item record. Service-role bypasses RLS — needed when
// the modal pulls data for a candidate_item the user doesn't have a SELECT
// policy on (candidate_items / verification_reports tables stay
// orchestrator-only in v1).
export async function loadItemDetailWithAdmin(
  admin: SupabaseClient,
  fingerprintUserId: string,
  itemId: string,
  briefingDate: string,
): Promise<BriefingItemDetail | null> {
  const { data: briefingItem, error: biErr } = await admin
    .from("briefing_items")
    .select(
      "candidate_item_id, verification_report_id, score, candidate_items!inner(item), verification_reports!inner(report)",
    )
    .eq("user_id", fingerprintUserId)
    .eq("briefing_date", briefingDate)
    .order("post_score", { ascending: false })
    .limit(50);
  if (biErr || !briefingItem) {
    throw new Error(`loadItemDetail: ${biErr?.message}`);
  }
  type Row = {
    candidate_item_id: number;
    verification_report_id: number;
    score: RelevanceScore;
    candidate_items: { item: Item };
    verification_reports: { report: VerificationReport };
  };
  const rows = briefingItem as unknown as Row[];
  const match = rows.find((r) => r.candidate_items.item.id === itemId);
  if (!match) return null;

  // Pull the matching payload_item from the briefings table for the headline /
  // what_happened / why_this strings the modal renders alongside the proof.
  const { data: briefingRow, error: bErr } = await admin
    .from("briefings")
    .select("payload")
    .eq("user_id", fingerprintUserId)
    .eq("briefing_date", briefingDate)
    .maybeSingle();
  if (bErr) throw new Error(`loadBriefing: ${bErr.message}`);
  const payload = briefingRow?.payload as BriefingPayload | undefined;
  const payloadItem = payload?.items.find((i) => i.candidate_item_id === match.candidate_item_id);

  return {
    candidate_item_id: match.candidate_item_id,
    item: match.candidate_items.item,
    score: match.score,
    verification_report: match.verification_reports.report,
    payload_item:
      payloadItem ?? {
        rank: 0,
        candidate_item_id: match.candidate_item_id,
        item_id: match.candidate_items.item.id,
        headline: match.candidate_items.item.title,
        what_happened: "",
        why_this: match.score.why_this,
        post_score: match.score.post_score,
        surface_reason: match.score.surface_reason,
      },
  };
}
