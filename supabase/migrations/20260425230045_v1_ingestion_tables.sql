-- Session 4 / T-12: v1 ingestion tables.
-- Four tables: jurisdictions, meetings, candidate_items, agent_sessions.
-- Six other tables (users, fingerprints, briefing_items, briefings, drafts,
-- feedback_events) ship in a v2 migration alongside T-17/T-18.
--
-- Dedup policy: upsert on (jurisdiction_id, legistar_*_id, legistar_*_guid).
-- source_hash change is the dirty flag for re-verification.
--
-- All tables have RLS enabled with no policies — service-role bypasses RLS,
-- which is the only role that talks to these tables in v1. Policies for
-- user-facing reads land alongside T-23 (auth).

-- ----------------------------------------------------------------------------
-- updated_at trigger helper
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- jurisdictions: lookup table seeded with austin-city-council, aisd, texas-lege
-- ----------------------------------------------------------------------------

create table public.jurisdictions (
  id text primary key,
  name text not null,
  legistar_base_url text,
  created_at timestamptz not null default now()
);

alter table public.jurisdictions enable row level security;

insert into public.jurisdictions (id, name, legistar_base_url) values
  ('austin-city-council', 'Austin City Council', 'https://austintexas.legistar.com'),
  ('aisd', 'Austin Independent School District', null),
  ('texas-lege', 'Texas Legislature', null)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- meetings: one per ingested meeting; carries metadata + raw scrape artifacts.
-- video_url and raw_transcript are NULL in v1 — T-11.5 populates them.
-- ----------------------------------------------------------------------------

create table public.meetings (
  id bigserial primary key,
  jurisdiction_id text not null references public.jurisdictions(id),
  legistar_meeting_id integer not null,
  legistar_meeting_guid uuid not null,
  meeting_date date not null,
  body text,
  location text,
  agenda_url text,
  agenda_packet_url text,
  video_url text,
  raw_html text,
  raw_packet_text text,
  raw_transcript text,
  scraped_at timestamptz not null,
  source_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meetings_legistar_unique unique (jurisdiction_id, legistar_meeting_id, legistar_meeting_guid)
);

alter table public.meetings enable row level security;

create trigger meetings_set_updated_at
  before update on public.meetings
  for each row execute function public.set_updated_at();

create index meetings_date_idx on public.meetings (meeting_date desc);
create index meetings_jurisdiction_idx on public.meetings (jurisdiction_id);

-- ----------------------------------------------------------------------------
-- candidate_items: structured records emitted by T-13 classifier.
-- Full item.json record lives in the `item` JSONB column; shadow columns
-- mirror frequently-queried fields for indexed access.
-- ----------------------------------------------------------------------------

create table public.candidate_items (
  id bigserial primary key,
  jurisdiction_id text not null references public.jurisdictions(id),
  meeting_id bigint not null references public.meetings(id),
  legistar_item_id integer not null,
  legistar_item_guid uuid not null,
  item_file_id text not null,                                 -- e.g. '26-1501'
  type text not null,
  status text not null,
  topics text[] not null,
  council_district integer,
  source_hash text not null,
  scraped_at timestamptz not null,
  item jsonb not null,                                        -- full item.json
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidate_items_legistar_unique unique (jurisdiction_id, legistar_item_id, legistar_item_guid)
);

alter table public.candidate_items enable row level security;

create trigger candidate_items_set_updated_at
  before update on public.candidate_items
  for each row execute function public.set_updated_at();

create index candidate_items_topics_gin on public.candidate_items using gin (topics);
create index candidate_items_district_idx on public.candidate_items (council_district);
create index candidate_items_meeting_idx on public.candidate_items (meeting_id);
create index candidate_items_file_idx on public.candidate_items (item_file_id);

-- ----------------------------------------------------------------------------
-- agent_sessions: minimal trace log. tool_calls JSONB and cost_cents
-- deferred to a follow-up migration once T-13 reveals what shape the data
-- actually takes. YAGNI on schema columns.
-- ----------------------------------------------------------------------------

create table public.agent_sessions (
  id bigserial primary key,
  jurisdiction_id text not null references public.jurisdictions(id),
  meeting_id bigint references public.meetings(id) on delete set null,
  runtime text not null,                                      -- 'orchestrator' for v1; 'managed_agent' later
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null,                                       -- 'running' | 'success' | 'failed'
  items_processed integer not null default 0,
  notes text
);

alter table public.agent_sessions enable row level security;

create index agent_sessions_meeting_idx on public.agent_sessions (meeting_id);
create index agent_sessions_started_idx on public.agent_sessions (started_at desc);
create index agent_sessions_status_idx on public.agent_sessions (status);
