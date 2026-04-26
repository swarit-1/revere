// Loads the pre-extracted zoning-map row for a candidate_item and mints a
// signed URL for the rendered Staff Report page. service_role only — the
// table and bucket both stay service-role-only by design (see v4 migration
// header for reasoning).

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ZoningExtraction {
  page_index: number | null;
  page_image_url: string | null;
  page_image_width: number | null;
  page_image_height: number | null;
  bbox: { x: number; y: number; w: number; h: number } | null;
  confidence: "high" | "medium" | "low";
  source_index: number;
}

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24; // 24 hours

export async function loadZoningExtractionWithAdmin(
  admin: SupabaseClient,
  candidateItemId: number,
): Promise<ZoningExtraction | null> {
  const { data, error } = await admin
    .from("zoning_map_extractions")
    .select(
      "page_index, page_image_path, page_image_width, page_image_height, bbox, confidence, source_index",
    )
    .eq("candidate_item_id", candidateItemId)
    .eq("extractor_version", "v1")
    .maybeSingle();
  if (error) throw new Error(`zoning extraction query failed: ${error.message}`);
  if (!data) return null;

  let signedUrl: string | null = null;
  if (data.page_image_path) {
    const { data: signed, error: signErr } = await admin.storage
      .from("zoning-maps")
      .createSignedUrl(data.page_image_path as string, SIGNED_URL_TTL_SECONDS);
    if (signErr) throw new Error(`signed url failed: ${signErr.message}`);
    signedUrl = signed?.signedUrl ?? null;
  }

  return {
    page_index: (data.page_index as number | null) ?? null,
    page_image_url: signedUrl,
    page_image_width: (data.page_image_width as number | null) ?? null,
    page_image_height: (data.page_image_height as number | null) ?? null,
    bbox: (data.bbox as ZoningExtraction["bbox"]) ?? null,
    confidence: data.confidence as ZoningExtraction["confidence"],
    source_index: data.source_index as number,
  };
}
