-- Session 10 / T-37 + multi-jurisdiction generalization. v6 adds:
--   * election_races, candidates, candidate_promises (election-mode entities)
--   * jurisdictions metadata extension (level)
--   * briefings.mode discriminator
--   * briefing_items generalization columns (record_kind, entity_type, entity_id)
--
-- All new tables: RLS enabled, service-role only in v1 — same posture as
-- candidate_items / verification_reports. Authenticated read paths land
-- via /briefing's admin-client side-fetch (existing pattern).

-- 1. Generalize jurisdictions: add level + metadata.
alter table public.jurisdictions
  add column if not exists level text;
alter table public.jurisdictions
  add column if not exists state text default 'TX';

-- Backfill the seeded rows.
update public.jurisdictions set level = 'municipal' where id = 'austin-city-council';
update public.jurisdictions set level = 'school' where id = 'aisd';
update public.jurisdictions set level = 'state' where id = 'texas-lege';

-- Seed two new jurisdictions for the multi-level demo:
insert into public.jurisdictions (id, name, level, state, legistar_base_url) values
  ('travis-county', 'Travis County, TX', 'county', 'TX', null),
  ('us-congress', 'United States Congress', 'federal', 'US', null)
on conflict (id) do nothing;

-- 2. Election entities.
create table public.election_races (
  id text primary key,                                       -- 'austin-d3-2026'
  jurisdiction_id text not null references public.jurisdictions(id),
  level text not null,                                       -- governance level enum
  office_title text not null,                                -- 'City Council Member, District 3'
  body text not null,                                        -- 'Austin City Council'
  district_label text not null,                              -- 'D3'
  district_match jsonb not null,                             -- { field, value }
  election_date date not null,
  registration_deadline date,
  early_voting_start date,
  early_voting_end date,
  source_url text not null,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.election_races enable row level security;
create index election_races_date_idx on public.election_races (election_date desc);
create index election_races_juris_idx on public.election_races (jurisdiction_id);

create table public.candidates (
  id text primary key,                                       -- 'alex-rivera-austin-d3-2026'
  race_id text not null references public.election_races(id),
  display_name text not null,
  campaign_url text,
  status text not null default 'filed',                      -- filed | withdrew | incumbent
  notes text,
  created_at timestamptz not null default now()
);
alter table public.candidates enable row level security;
create index candidates_race_idx on public.candidates (race_id);

create table public.candidate_promises (
  id text primary key,                                       -- 'alex-rivera-rent-stabilization'
  candidate_id text not null references public.candidates(id),
  topic text not null,                                       -- snake_case
  text text not null,                                        -- ≤ 240 chars
  source jsonb not null,                                     -- PromiseSource
  authority text not null,                                   -- direct_authority | partial_authority | etc.
  authority_rationale text not null,
  specificity text not null,                                 -- specific | general | vague
  topics text[] not null,                                    -- taxonomy categories
  created_at timestamptz not null default now()
);
alter table public.candidate_promises enable row level security;
create index candidate_promises_cand_idx on public.candidate_promises (candidate_id);
create index candidate_promises_topic_idx on public.candidate_promises (topic);

-- 3. briefings.mode discriminator.
alter table public.briefings
  add column if not exists mode text not null default 'governance';

-- 4. briefing_items generalization. record_kind says whether it's a
--    governance candidate_item or an election entity (race/candidate/
--    promise). entity_type + entity_id give a generic foreign key
--    that doesn't depend on candidate_item_id always being set.
--
--    Backward-compatibility: rows with record_kind='governance' must
--    still reference candidate_item_id. Rows with record_kind='election'
--    set entity_type ∈ {race, candidate, promise} and entity_id to the
--    matching string id; candidate_item_id is null for those rows.
alter table public.briefing_items
  add column if not exists record_kind text not null default 'governance';
alter table public.briefing_items
  add column if not exists entity_type text;                 -- race | candidate | promise (election only)
alter table public.briefing_items
  add column if not exists entity_id text;                    -- string id for election entities
alter table public.briefing_items
  alter column candidate_item_id drop not null;
alter table public.briefing_items
  alter column verification_report_id drop not null;

-- Constraint: governance rows must have candidate_item_id; election
-- rows must have entity_type + entity_id.
alter table public.briefing_items
  add constraint briefing_items_record_kind_check
  check (
    (record_kind = 'governance' and candidate_item_id is not null) or
    (record_kind = 'election' and entity_type is not null and entity_id is not null)
  );

create index briefing_items_entity_idx
  on public.briefing_items (record_kind, entity_type, entity_id);

-- 5. agent_sessions tightening — add subject_type + subject_id + user_id.
--    The old (jurisdiction_id, meeting_id, runtime) tuple is still
--    sufficient for governance, but election sessions and per-user
--    sessions need extra dimensions for the trace UI.
alter table public.agent_sessions
  add column if not exists subject_type text;                -- meeting | race | candidate | user
alter table public.agent_sessions
  add column if not exists subject_id text;                  -- ID in the appropriate space
alter table public.agent_sessions
  add column if not exists user_id text;                     -- when the run is per-user (matcher, composer)
alter table public.agent_sessions
  add column if not exists briefing_date date;

create index agent_sessions_subject_idx
  on public.agent_sessions (subject_type, subject_id);
create index agent_sessions_user_date_idx
  on public.agent_sessions (user_id, briefing_date);
