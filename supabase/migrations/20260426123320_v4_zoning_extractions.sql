-- Session 7 / T-26: zoning map extractions.
-- Pre-extracted by the orchestrator's two-stage Opus 4.7 vision pipeline.
-- Stage 1 finds the page in the Staff Report PDF that contains the parcel
-- diagram. Stage 2 returns the parcel's bbox in pixel coordinates on that
-- page. Modal renders the page image with an SVG overlay client-side.
--
-- service_role bypasses by design — the modal route uses signed URLs minted
-- via the admin client, never directly serving from this table to
-- authenticated clients. RLS stays enabled with no policy.

create table public.zoning_map_extractions (
  id bigserial primary key,
  candidate_item_id bigint not null references public.candidate_items(id),
  source_index integer not null,            -- which item.sources[i] is the source PDF
  page_index integer,                       -- 1-indexed; nullable when no map page found
  page_image_path text,                     -- supabase storage path: <cid>/<page>.png
  page_image_width integer,                 -- pixel dimensions for the SVG overlay
  page_image_height integer,
  bbox jsonb,                               -- {x, y, w, h} in pixels, OR null on low confidence
  confidence text not null,                 -- 'high' | 'medium' | 'low'
  extractor_version text not null,          -- 'v1' for the two-stage pipeline
  extracted_at timestamptz not null default now(),
  notes text,                               -- raw_passage / smoke-test annotations
  unique (candidate_item_id, extractor_version)
);
alter table public.zoning_map_extractions enable row level security;
create index idx_zoning_extractions_candidate on public.zoning_map_extractions (candidate_item_id);

-- Storage bucket for rendered Staff Report pages. service_role-only; the
-- web app mints 24h-TTL signed URLs server-side. No public read.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('zoning-maps', 'zoning-maps', false, 5242880, array['image/png']::text[])
on conflict (id) do nothing;
