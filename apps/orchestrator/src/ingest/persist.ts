// Supabase persistence for candidate_items. Upsert on the dedup key from the
// T-12 migration: (jurisdiction_id, legistar_item_id, legistar_item_guid).
// The full item.json record lives in the `item` JSONB column; shadow columns
// mirror frequently-queried fields.

import type { Item } from "@revere/shared";
import { supabase } from "../lib/supabase.js";

export interface PersistArgs {
  meetingDbId: number; // FK into meetings.id
  item: Item;
}

export async function upsertCandidateItem(args: PersistArgs): Promise<{ id: number }> {
  const { item } = args;
  const sb = supabase();
  const { data, error } = await sb
    .from("candidate_items")
    .upsert(
      {
        jurisdiction_id: item.jurisdiction,
        meeting_id: args.meetingDbId,
        legistar_item_id: item.legistar_item_id,
        legistar_item_guid: item.legistar_item_guid,
        item_file_id: item.id,
        type: item.type,
        status: item.status,
        topics: item.topics,
        council_district: item.location?.council_district ?? null,
        source_hash: item.source_hash,
        scraped_at: item.scraped_at,
        item: item,
      },
      {
        onConflict: "jurisdiction_id,legistar_item_id,legistar_item_guid",
      },
    )
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`failed to upsert candidate_item ${item.id}: ${error?.message}`);
  }
  return { id: data.id as number };
}
