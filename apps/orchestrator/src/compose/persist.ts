// Upsert briefings rows. Dedup on (user_id, briefing_date).

import { supabase } from "../lib/supabase.js";
import type { BriefingPayload } from "./compose-briefing.js";

export interface UpsertBriefingArgs {
  user_id: string;
  briefing_date: string;
  payload: BriefingPayload;
  generated_at: string;
}

export async function upsertBriefing(args: UpsertBriefingArgs): Promise<{ id: number }> {
  const sb = supabase();
  const { data, error } = await sb
    .from("briefings")
    .upsert(
      {
        user_id: args.user_id,
        briefing_date: args.briefing_date,
        payload: args.payload,
        generated_at: args.generated_at,
      },
      { onConflict: "user_id,briefing_date" },
    )
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(
      `failed to upsert briefing for ${args.user_id} on ${args.briefing_date}: ${error?.message}`,
    );
  }
  return { id: data.id as number };
}
