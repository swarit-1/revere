// Persist 3 rows to drafts (one per voice variant). service-role only.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DraftVariant } from "@revere/shared";

export interface PersistArgs {
  sb: SupabaseClient;
  candidate_item_id: number;
  user_id: string;
  variants: DraftVariant[];
  writer_version: string;
  loop_version: string;
  cost_tokens: {
    input: number;
    output: number;
    cache_read: number;
    cache_create: number;
  };
}

export async function persistDrafts(args: PersistArgs): Promise<number[]> {
  const rows = args.variants.map((v) => ({
    candidate_item_id: args.candidate_item_id,
    user_id: args.user_id,
    voice: v.voice,
    final_text: v.text,
    critique_trail: v.critique_trail,
    writer_version: args.writer_version,
    loop_version: args.loop_version,
    cost_tokens: args.cost_tokens,
  }));

  const { data, error } = await args.sb
    .from("drafts")
    .upsert(rows, { onConflict: "candidate_item_id,user_id,voice,loop_version" })
    .select("id");
  if (error || !data) {
    throw new Error(`drafts upsert failed: ${error?.message}`);
  }
  return data.map((r) => r.id as number);
}
