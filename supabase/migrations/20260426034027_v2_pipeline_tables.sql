-- Session 5 / T-15+T-17+T-18: v2 pipeline tables.
-- Four tables: fingerprints, verification_reports, briefing_items, briefings.
-- users + drafts + feedback_events still deferred (T-21 / T-23).
--
-- All tables have RLS enabled with no policies — service-role bypasses RLS.
-- Policies for end-user access ship alongside T-23 (auth).

-- fingerprints: one per user. user_id is a hand-chosen handle ('maya','jason')
-- for v1; T-23 adds a users table + FK in a follow-up migration.
CREATE TABLE fingerprints (
  user_id TEXT PRIMARY KEY,
  fingerprint JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fingerprints ENABLE ROW LEVEL SECURITY;

-- verification_reports: pure-function output of the verification skill.
-- One row per (candidate_item_id, verified_at) — re-verification appends.
-- The full verification_report record lives in `report` JSONB; shadow columns
-- mirror the rollup fields for fast queries.
CREATE TABLE verification_reports (
  id BIGSERIAL PRIMARY KEY,
  candidate_item_id BIGINT NOT NULL REFERENCES candidate_items(id),
  item_id TEXT NOT NULL,
  item_source_hash TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL,
  verifier_version TEXT NOT NULL,
  overall_verdict TEXT NOT NULL,
  report JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (candidate_item_id, verified_at)
);
ALTER TABLE verification_reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_verification_reports_candidate ON verification_reports (candidate_item_id);
CREATE INDEX idx_verification_reports_verdict ON verification_reports (overall_verdict);

-- briefing_items: per-(user, candidate_item, briefing_date) scored row.
-- Written by T-17. Read by T-18 (top-K compose) and T-27 (trust pane).
-- `score` JSONB carries the full relevance-score record + synthesis_resolutions[].
CREATE TABLE briefing_items (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES fingerprints(user_id),
  candidate_item_id BIGINT NOT NULL REFERENCES candidate_items(id),
  verification_report_id BIGINT NOT NULL REFERENCES verification_reports(id),
  briefing_date DATE NOT NULL,
  rank INTEGER,
  pre_score NUMERIC(5,4) NOT NULL,
  post_score NUMERIC(5,4) NOT NULL,
  surfaced BOOLEAN NOT NULL,
  surface_reason TEXT NOT NULL,
  why_this TEXT NOT NULL,
  score JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, candidate_item_id, briefing_date)
);
ALTER TABLE briefing_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_briefing_items_user_date ON briefing_items (user_id, briefing_date);
CREATE INDEX idx_briefing_items_surfaced ON briefing_items (user_id, briefing_date, surfaced);

-- briefings: one row per (user, briefing_date) with denormalized payload
-- snapshot for one-query email rendering and trace surfaces.
CREATE TABLE briefings (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES fingerprints(user_id),
  briefing_date DATE NOT NULL,
  payload JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, briefing_date)
);
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_briefings_user_date ON briefings (user_id, briefing_date);
