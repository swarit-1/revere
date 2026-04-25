# Session 4 — Ingestion: schema + scraper + classifier (T-12, T-11, T-13)

## Context

Skills phase ended Session 3. Verification, fingerprint, and Austin
classification all pass against real public-record data. Session 4
crosses into running code: Supabase migration (T-12), Austin scraper
(T-11), per-item classifier (T-13). Three PRD-distinct tasks; three
gate moments; three commits in one session (Path C). End state:
`candidate_items` populated for one real meeting.

Largest dependency surface so far. Pre-flight discipline applies.

## Divergences from PRD (matches Session 1/2/3 table format)

All locked in Phase 1.

| Divergence | PRD says | Session 4 ships | Why |
|---|---|---|---|
| Path-C task discipline | §20.4 lists T-11, T-12, T-13 as separate tasks | Three commits, three gate moments, one session — no merging | Preserves PRD task IDs; git log stays a status board; demo can point cleanly at scraper vs. classifier. |
| T-11 gate phrasing | "raw video + captions + agenda text in Supabase" | Relaxed to **"raw HTML + agenda PDF text in Supabase"** | Video discovery is its own subsystem (yt-dlp + ATXN matching). Item.json schema tolerates `video: null`; demo's source-proof beat works on Legistar URL + agenda PDF page refs. Booked as **T-11.5** below. |
| T-13 runtime | "austin-council-v1 Managed Agent: agent config + environment spec with least-privilege allowed-hosts" | Local TypeScript service in `apps/orchestrator/src/ingest/`. Same skill pack, same I/O contract; harness-agnostic by design. | Per Session 0 outcome: T-02 research-preview applications were deferred and will not be done. Coupling architecture to MA access would gate the demo on something we don't control. |
| Orchestrator framing | "Cloud Run, Node/Python" | Node + TS only (locked in T-04) | "Node/Python" was a hedge in the PRD; we picked Node + TS in T-04 and stuck. |
| `item.ts` derivation | n/a | Hand-written mirror of `item.json` schema + fixture-based drift test at `packages/shared/test/schema-drift.test.ts` | Auto-gen would produce verbose `oneOf` types for the discriminated `sources[]` array. Drift test catches schema/type drift without forcing a build step. |
| Schema migration mechanism | Not specified | Raw `.sql` files under `supabase/migrations/`, applied via `supabase db push`. No ORM. | Smaller dep surface, transparent at migration time, matches Supabase's documented workflow. |
| `agent_sessions` shape | "jurisdiction, session_id, status, duration, tool calls, cost" (§12.4) | T-12 ships **minimal**: id, jurisdiction, meeting_id, runtime, started_at, finished_at, status, items_processed, notes. `tool_calls JSONB` and `cost_cents` deferred to a follow-up migration once T-13 reveals the actual shape. | YAGNI on schema columns. T-13 will tell us what fields the data actually has. |
| Dedup policy | Not specified | Upsert on `(jurisdiction_id, legistar_item_id, legistar_item_guid)` for both `meetings` and `candidate_items`. `source_hash` change is the dirty flag (verification skill's freshness gate handles re-verification). | Lets the scraper re-run any number of times during demo prep without polluting the table. Gives T-27 trust pane a "last verified vs. last scraped" diagnostic. |

## New tasks named (added to project backlog)

- **T-11.5** — Video discovery + transcript extraction. Scope: ATXN YouTube channel match by date/title; yt-dlp caption pull; populate `meetings.video_url`, `meetings.raw_transcript`, and `sources[type="video"]` on classified items. Stretch; not in Session 4. Lands in BACKLOG.md.
- **T-11.6** — Agenda packet PDF vision-extraction for `body`. Scope: Opus 4.7 vision over agenda packet PDF pages; populate `item.body` text; preserve page locator. Stretch; not in Session 4. Lands in BACKLOG.md.

## Pre-flight checklist (Step 0 — runs before any gate work)

If any of these fail, halt and surface — do not work around.

1. **Supabase project link.** From repo root:
   ```
   supabase init   # creates supabase/ directory + config.toml; safe to re-run
   supabase link --project-ref exuqzhnbffpsxxhkcciq
   ```
   Expected: `supabase status` reports the project is linked. Project region is West US (Oregon).

2. **`apps/orchestrator/.env.local`** with three keys (gitignored — `.gitignore` already covers `.env.local`):
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   SUPABASE_URL=https://exuqzhnbffpsxxhkcciq.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...   # service-role, not anon
   ```
   Source values from the Supabase project's API settings + the Anthropic Console key created in T-01.

3. **Connection verification.**
   ```
   supabase db remote commit --dry-run
   ```
   Or, equivalently: `psql $(supabase status -o json | jq -r .api.url) -c 'SELECT 1'` (this proves we can reach the DB; the real migration push happens in T-12).

   Expected: clean exit. Any auth/network failure → halt, surface, fix.

## Three gate moments

### T-12 — Schema migration

**Files shipped:**
- `supabase/migrations/0001_ingestion_tables.sql` (the four-table v1 migration)
- `packages/shared/src/types/item.ts` (hand-written TS mirror of `item.json`)
- `packages/shared/src/source-hash.ts` (`sha256Hex(input: string | Uint8Array): string`)
- `packages/shared/test/schema-drift.test.ts` (loads T-06 record, validates against item.json AND asserts TS type satisfies)
- `packages/shared/src/index.ts` (export item types + sourceHash + existing fingerprint)
- Updated `packages/shared/package.json` if needed (test deps: `vitest`, `ajv`)

**Migration shape (the four tables):**

```sql
-- jurisdictions: lookup, seeded with austin-city-council, aisd, texas-lege
CREATE TABLE jurisdictions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  legistar_base_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- meetings: one per ingested meeting; carries metadata + raw scrape artifacts
CREATE TABLE meetings (
  id BIGSERIAL PRIMARY KEY,
  jurisdiction_id TEXT NOT NULL REFERENCES jurisdictions(id),
  legistar_meeting_id INTEGER NOT NULL,
  legistar_meeting_guid UUID NOT NULL,
  meeting_date DATE NOT NULL,
  body TEXT,                                 -- e.g. 'City Council'
  location TEXT,
  agenda_url TEXT,
  agenda_packet_url TEXT,
  video_url TEXT,                            -- NULL for v1; T-11.5 populates
  raw_html TEXT,                             -- MeetingDetail page HTML
  raw_packet_text TEXT,                      -- agenda packet PDF text
  raw_transcript TEXT,                       -- NULL for v1; T-11.5 populates
  scraped_at TIMESTAMPTZ NOT NULL,
  source_hash TEXT NOT NULL,                 -- sha256 of raw_html
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (jurisdiction_id, legistar_meeting_id, legistar_meeting_guid)
);

-- candidate_items: structured records emitted by classifier; full item.json
-- in `item` JSONB plus shadow columns for indexed queries.
CREATE TABLE candidate_items (
  id BIGSERIAL PRIMARY KEY,
  jurisdiction_id TEXT NOT NULL REFERENCES jurisdictions(id),
  meeting_id BIGINT NOT NULL REFERENCES meetings(id),
  legistar_item_id INTEGER NOT NULL,
  legistar_item_guid UUID NOT NULL,
  item_file_id TEXT NOT NULL,                -- e.g. '26-1501'
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  topics TEXT[] NOT NULL,
  council_district INTEGER,                  -- 0..10 nullable
  source_hash TEXT NOT NULL,
  scraped_at TIMESTAMPTZ NOT NULL,
  item JSONB NOT NULL,                       -- full item.json
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (jurisdiction_id, legistar_item_id, legistar_item_guid)
);

CREATE INDEX idx_candidate_items_topics ON candidate_items USING GIN (topics);
CREATE INDEX idx_candidate_items_district ON candidate_items (council_district);
CREATE INDEX idx_candidate_items_meeting ON candidate_items (meeting_id);

-- agent_sessions: minimal trace log; YAGNI on tool_calls + cost
CREATE TABLE agent_sessions (
  id BIGSERIAL PRIMARY KEY,
  jurisdiction_id TEXT NOT NULL REFERENCES jurisdictions(id),
  meeting_id BIGINT REFERENCES meetings(id),
  runtime TEXT NOT NULL,                     -- 'orchestrator' for v1
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL,                      -- 'running' | 'success' | 'failed'
  items_processed INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

INSERT INTO jurisdictions (id, name, legistar_base_url) VALUES
  ('austin-city-council', 'Austin City Council', 'https://austintexas.legistar.com'),
  ('aisd', 'Austin Independent School District', NULL),
  ('texas-lege', 'Texas Legislature', NULL)
ON CONFLICT (id) DO NOTHING;
```

**Gate evidence for T-12:**
- `supabase db push` exits clean.
- `supabase db diff` reports no drift.
- All four tables visible in Supabase Console under the project's `public` schema.
- `pnpm --filter @revere/shared test` passes the schema-drift test (T-06's emitted JSON validates against `item.json` AND satisfies `Item` type from `item.ts`).
- `pnpm typecheck` clean across all workspaces.

**Commit:** `T-12: Supabase schema migration + item.ts + source-hash helper`.

### T-11 — Austin Council scraper (raw artifacts)

**Files shipped:**
- `apps/orchestrator/src/ingest/legistar/calendar.ts` — fetch Calendar.aspx, parse current-month meetings, return latest-regular-meeting URL.
- `apps/orchestrator/src/ingest/legistar/meeting.ts` — fetch MeetingDetail, parse agenda items table, return list of `{file_id, legistar_item_id, legistar_item_guid, item_url}`.
- `apps/orchestrator/src/ingest/legistar/item.ts` — fetch LegislationDetail, return raw HTML + structured field map (label-value extraction per the skill pack's scrapers/legistar-agenda.md).
- `apps/orchestrator/src/ingest/legistar/types.ts` — internal scraper types.
- `apps/orchestrator/src/ingest/austin-council.ts` — entry point with `--meeting-url <url>` argv. Fetches the meeting + each item; persists `meetings` row with `raw_html` + `raw_packet_text`. Does NOT classify yet.
- `apps/orchestrator/src/lib/supabase.ts` — service-role client helper.
- `apps/orchestrator/test-fixtures/austin/26-1501-item.html` — vendored real Legistar HTML response for File #26-1501. Hash recorded below.
- `apps/orchestrator/test-fixtures/austin/meeting-1362247.html` — vendored real MeetingDetail page HTML for the April 9 meeting.
- `apps/orchestrator/test-fixtures/austin/agenda-packet-1362247.txt` — extracted text of the agenda packet PDF.
- `apps/orchestrator/test/ingest/legistar.test.ts` — unit tests against the fixtures (URL chain extraction, label-value parsing, attachment URL extraction, source-hash computation).
- `apps/orchestrator/package.json` — adds `cheerio`, `pdf-parse`, `vitest`, `@types/node-fetch` if needed.

**Fixture hash recorded in plan** (computed at fixture vendoring time; goes into the commit message):
- `26-1501-item.html`: TBD at vendoring time
- `meeting-1362247.html`: TBD
- `agenda-packet-1362247.txt`: TBD

**Live-vs-fixture testing:**
- Unit tests run against the fixture (deterministic, regression-stable).
- A `pnpm --filter @revere/orchestrator test:integration` script runs against the live page (called manually, gated on env var `RUN_LIVE_TESTS=1`).
- Demo path: rehearsal happens against the fixture replay; live demo against live page; if conference Wi-Fi fails, fallback to the fixture replay. Three layers of robustness from one fixture commit.

**Gate evidence for T-11:**
- Run `apps/orchestrator/src/ingest/austin-council.ts --meeting-url <April-9-LegistarURL>` against live Legistar.
- Verify in Supabase: one row in `meetings` with `legistar_meeting_id=1362247`, `meeting_date='2026-04-09'`, `raw_html` non-empty (50K+ chars), `raw_packet_text` non-empty (likely 100K+ chars), `source_hash` 64-char hex matching `sha256(raw_html)`.
- Unit tests pass against fixtures (8+ tests covering URL chain, label-value, attachments, hash).
- `agent_sessions` row recorded with `runtime='orchestrator'`, `status='success'`, `items_processed=0` (T-13 will bump this).
- `candidate_items` table is **still empty** — that's T-13's job.

**Commit:** `T-11: Austin Council scraper persists raw artifacts to Supabase`.

### T-13 — Per-item classifier (candidate_items populated)

**Files shipped:**
- `apps/orchestrator/src/ingest/classify.ts` — per-item classifier. Loads the Austin skill pack (file reads from `.claude/skills/jurisdictions/austin-city-council/`), constructs system prompt with prompt caching enabled (`cache_control: {type: "ephemeral"}` on skill pack content blocks), calls Anthropic Messages API per item.
- `apps/orchestrator/src/ingest/persist.ts` — upsert candidate_items per the dedup policy; update `agent_sessions.items_processed`.
- `apps/orchestrator/src/lib/anthropic.ts` — client helper with advisor-strategy routing: Sonnet 4.6 default, Opus 4.7 fallback for items the topic-overlap signal flags as ambiguous (e.g. classifier's first pass returns `confidence: low` on any zoning sub-field, OR returns 3+ topics on a single item).
- `apps/orchestrator/src/ingest/austin-council.ts` — extended to call classify.ts + persist.ts after the scrape phase.
- Test: `apps/orchestrator/test/ingest/classify.test.ts` — unit test against the fixture for item 26-1501. Asserts classifier produces a record matching the T-06 ground truth (housing + commercial-regulation topics, all 5 zoning sub-fields with `confidence: high`, etc.).

**Advisor strategy routing rule:**
- Default: Sonnet 4.6.
- Escalate to Opus 4.7 if any of: (a) classifier's Sonnet pass returns `confidence: "low"` on any zoning sub-field; (b) returns 3+ topics for a single item (signals ambiguity); (c) returns no topics at all (signals classifier failure — Opus retry might recover).
- Each item runs through Sonnet first; ~10% expected to escalate to Opus on the April 9 fixture meeting.

**Cost budget for T-13** (one full ingestion of April 9 meeting, 56 items):

| Phase | Model | Items | Per-item input | Per-item output | Subtotal |
|---|---|---|---|---|---|
| Bulk classify | Sonnet 4.6 ($3/M in, $15/M out) | ~50 (90%) | ~3.3K | ~0.5K | $0.50 in + $0.38 out = $0.88 |
| Escalation | Opus 4.7 ($5/M in, $25/M out) | ~6 (10%) | ~3.3K | ~0.5K | $0.10 in + $0.08 out = $0.18 |
| Meeting orchestration | Sonnet 4.6 | 1 | ~5K | ~1K | $0.02 + $0.02 = $0.04 |
| **Subtotal (no caching)** | | | | | **~$1.10** |
| Prompt caching savings (skill pack ~3K tokens cached, 56 items) | -50% on bulk classify input | | | | **~−$0.25** |
| **Estimated total per meeting** | | | | | **~$0.85** |

For demo-prep iteration (~10 reruns during T-13 development): ~$8.50.
Nightly runs over a week (3 jurisdictions × 7 nights = 21 sessions): ~$18 if all jurisdictions hit similar volume. Well within the $1000 hackathon budget.

**Halt-and-flag if:** total spend on T-13 development exceeds $20 — that signals the prompt or escalation rule needs tuning before continuing.

**Gate evidence for T-13:**
- Run the same `austin-council.ts --meeting-url <April-9-URL>` (or `--meeting-id 1362247`) end-to-end.
- Verify in Supabase: ≥20 rows in `candidate_items` for `meeting_id=<the row>`, each with valid `item` JSONB matching item.json schema, `topics` array non-empty, `source_hash` populated.
- The `26-1501` item present, with topics `["housing", "commercial-regulation"]` and the full zoning sub-object populated (matches T-06 ground truth).
- `agent_sessions` row updated with `items_processed=56` (or whatever the count was), `status='success'`.
- Unit test classifying the fixture 26-1501 passes.
- Re-run the same command. Verify dedup: same row count (no duplicates), `updated_at` advances on changed rows, `source_hash` change triggers row refresh.

**Commit:** `T-13: Austin orchestrator classifies meeting into candidate_items`.

## Risk register (3 watch-fors during execution)

1. **Live Legistar will surface something the scraper note didn't anticipate.** Could be cookies, redirects, User-Agent blocks, HTML drift in a column we didn't sample. **Rule:** when this happens, the scraper note (`scrapers/legistar-agenda.md`) gets updated as part of the same commit as the fix. Don't let undocumented scraper tweaks sneak in.

2. **Token cost on the 56-item meeting will surprise.** Advisor strategy applies aggressively: Sonnet 4.6 for bulk classification, Opus 4.7 only on ambiguous items. Prompt caching on skill pack content cuts ~50% of repeated input. Budget set at ~$0.85/meeting; halt if T-13 dev iteration exceeds $20 cumulative.

3. **`agent_sessions` schema reveals itself during T-13.** Don't try to fully spec it in T-12. Land minimum columns; add `tool_calls JSONB` and `cost_cents` in a follow-up migration once T-13 actually populates the table and we know what shape the data takes.

## Execute order (Phase 3)

Each step ends with a commit. Halt on any gate failure.

0. **Pre-flight** — supabase init/link, `.env.local`, connection verification. No commit (no code changes); just gates.
1. **T-12** — write migration + `item.ts` + `source-hash.ts` + drift test. `supabase db push`. Run `pnpm --filter @revere/shared test` + `pnpm typecheck`. Commit: `T-12: Supabase schema migration + item.ts + source-hash helper`.
2. **T-11** — write scraper modules + entry point + fixtures + unit tests. Run `pnpm --filter @revere/orchestrator test`. Run live ingestion against the April 9 meeting. Verify `meetings` row in Supabase + `agent_sessions` row. Commit: `T-11: Austin Council scraper persists raw artifacts to Supabase`.
3. **T-13** — write classifier + persist + advisor-strategy router. Run unit test against fixture. Run live classification against the same meeting. Verify `candidate_items` ≥ 20 rows, `26-1501` matches T-06 ground truth, dedup on re-run. Commit: `T-13: Austin orchestrator classifies meeting into candidate_items`.

After step 3, report final state: row counts in `meetings` / `candidate_items` / `agent_sessions`, total token spend on T-13 dev, time-to-classify per item.

Halt at end of step 3. Do NOT touch T-07 (AISD), T-10 (drafting), T-14 (other jurisdictions' agents), T-15 (verification loop), or anything past T-13.

## Session-scope rules

- Sonnet 4.6 for boilerplate code (Supabase client wrapper, Cheerio selectors, fixture loading, test scaffolding).
- Opus 4.7 for judgment-heavy code: the classifier's prompt construction, the advisor-strategy escalation rule, the dedup-on-source_hash logic, the schema migration's column choices.
- If a code file trends past ~200 lines, split before shipping (Session 1/2/3 pattern).
- If anything in pre-flight fails, halt — do not work around. Re-run after fix.
- Anything not required by the three gates lands in BACKLOG (T-11.5, T-11.6, the agent_sessions follow-up migration, prompt-caching tuning, etc.).
- Commit-per-gate with the right `T-XX:` prefix.
- If token spend on T-13 dev iteration exceeds $20, halt and re-tune before continuing.
