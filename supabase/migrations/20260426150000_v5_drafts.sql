-- Session 8 / T-21: drafts table.
-- One row per (candidate_item_id, user_id, voice, loop_version). Three rows
-- per draft request — one per voice variant (direct/measured/persuasive).
-- service_role bypasses RLS by design (matches verification_reports and
-- briefing_items in v1; per-user read paths land alongside a T-23 follow-up).

create table public.drafts (
  id bigserial primary key,
  candidate_item_id bigint not null references public.candidate_items(id),
  user_id text not null references public.fingerprints(user_id),
  voice text not null,                    -- 'direct' | 'measured' | 'persuasive'
  final_text text not null,
  critique_trail jsonb not null,          -- array of 3 critique entries
  writer_version text not null,           -- 'v1'
  loop_version text not null,             -- 'v1'
  cost_tokens jsonb,                      -- {input, output, cache_read, cache_create}
  generated_at timestamptz not null default now(),
  unique (candidate_item_id, user_id, voice, loop_version)
);
alter table public.drafts enable row level security;
create index idx_drafts_user_item on public.drafts (user_id, candidate_item_id);
