// Uploads the rendered Staff Report page to the zoning-maps Supabase
// Storage bucket and writes the extraction row. service_role only;
// the bucket is service-role-only by design (see v4 migration comment).

import type { SupabaseClient } from "@supabase/supabase-js";

export interface PersistArgs {
  sb: SupabaseClient;
  candidate_item_id: number;
  source_index: number;
  page_index: number | null;
  page_image_bytes: Buffer | null;
  page_image_width: number | null;
  page_image_height: number | null;
  bbox: { x: number; y: number; w: number; h: number } | null;
  confidence: "high" | "medium" | "low";
  notes: string;
  extractor_version?: string;
}

export interface PersistResult {
  extractionId: number;
  pageImagePath: string | null;
}

export async function persistExtraction(args: PersistArgs): Promise<PersistResult> {
  const version = args.extractor_version ?? "v1";

  let pageImagePath: string | null = null;
  if (args.page_image_bytes && args.page_index !== null) {
    pageImagePath = `${args.candidate_item_id}/${args.page_index}.png`;
    const { error: upErr } = await args.sb.storage
      .from("zoning-maps")
      .upload(pageImagePath, args.page_image_bytes, {
        contentType: "image/png",
        upsert: true,
      });
    if (upErr) throw new Error(`storage upload failed: ${upErr.message}`);
  }

  const row = {
    candidate_item_id: args.candidate_item_id,
    source_index: args.source_index,
    page_index: args.page_index,
    page_image_path: pageImagePath,
    page_image_width: args.page_image_width,
    page_image_height: args.page_image_height,
    bbox: args.bbox,
    confidence: args.confidence,
    extractor_version: version,
    notes: args.notes,
  };

  const { data, error } = await args.sb
    .from("zoning_map_extractions")
    .upsert(row, { onConflict: "candidate_item_id,extractor_version" })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`zoning_map_extractions insert failed: ${error?.message}`);
  }
  return { extractionId: data.id as number, pageImagePath };
}
