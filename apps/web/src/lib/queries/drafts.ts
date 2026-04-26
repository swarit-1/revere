// Loads the 3 variants for (user_id, candidate_item_id) in stable voice
// order (direct, measured, persuasive). service-role only — drafts table
// stays admin-only in v1, matching the verification_reports pattern.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CritiqueEntry, Voice } from "@revere/shared";

export interface DraftRow {
  id: number;
  voice: Voice;
  final_text: string;
  critique_trail: CritiqueEntry[];
  generated_at: string;
}

const VOICE_ORDER: Voice[] = ["direct", "measured", "persuasive"];

export async function loadDraftsWithAdmin(
  admin: SupabaseClient,
  userId: string,
  candidateItemId: number,
): Promise<DraftRow[]> {
  const { data, error } = await admin
    .from("drafts")
    .select("id, voice, final_text, critique_trail, generated_at")
    .eq("user_id", userId)
    .eq("candidate_item_id", candidateItemId)
    .eq("loop_version", "v1");
  if (error) throw new Error(`drafts query failed: ${error.message}`);
  if (!data) return [];
  const rows = data as unknown as DraftRow[];
  return rows.sort((a, b) => VOICE_ORDER.indexOf(a.voice) - VOICE_ORDER.indexOf(b.voice));
}
