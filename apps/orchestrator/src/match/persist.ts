// Upsert briefing_items rows. Dedup on (user_id, candidate_item_id, briefing_date).

import type { RelevanceScore } from "@revere/shared";
import { supabase } from "../lib/supabase.js";

export interface PersistArgs {
  user_id: string;
  candidate_item_id: number;
  verification_report_id: number;
  briefing_date: string; // YYYY-MM-DD
  score: RelevanceScore;
}

export async function upsertBriefingItem(args: PersistArgs): Promise<{ id: number }> {
  const sb = supabase();
  const { data, error } = await sb
    .from("briefing_items")
    .upsert(
      {
        user_id: args.user_id,
        candidate_item_id: args.candidate_item_id,
        verification_report_id: args.verification_report_id,
        briefing_date: args.briefing_date,
        rank: null,
        pre_score: args.score.pre_score,
        post_score: args.score.post_score,
        surfaced: args.score.surfaced,
        surface_reason: args.score.surface_reason,
        why_this: args.score.why_this,
        score: args.score,
      },
      {
        onConflict: "user_id,candidate_item_id,briefing_date",
      },
    )
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(
      `failed to upsert briefing_item for ${args.user_id}/${args.candidate_item_id}: ${error?.message}`,
    );
  }
  return { id: data.id as number };
}
