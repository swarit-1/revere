# Session 5 — Pipeline: verification + matching + synthesis (T-15, T-17, T-18)

## Context

Session 4 closed with `candidate_items` populated for the 2026-04-09
City Council meeting (56 rows; 26-1501 matching T-06 ground truth
exactly). Skills phase done; ingestion phase done. Session 5 connects
them through to a finished briefing per persona.

Three PRD-distinct tasks; three gate moments; one bundled-task gate
that mechanically demonstrates the demo's central claim — same
meeting, two personas, two visibly different briefings.

T-15 reads candidate_items and emits verification_reports. T-17 reads
verified items + a fingerprint and emits relevance-scored
briefing_items. T-18 composes per-user briefings into the briefings
table. Sequential within the session; together they cover the
ingestion-to-render path end-to-end.

## Divergences from PRD (matches Session 1–4 table format)

All locked in Phase 1.

| Divergence | PRD says | Session 5 ships | Why |
|---|---|---|---|
| `verification_reports` table | Not in §12.4 (PRD nests verification status into `briefing_items`) | Standalone table; one report per (candidate_item, verified_at) so re-verification produces an audit trail | Keeps verification a pure-function output with stable shape; supports T-27 trust pane queries; lets us re-verify without overwriting history. |
| T-15 runtime | "Per-claim source-check via Messages API (Opus 4.7, effort: xhigh)" | Local TS service in `apps/orchestrator/src/verify/`. Manual batch entry point. Same skill pack, same I/O contract; harness-agnostic. | Same Session 4 reasoning: T-02 research-preview deferred. Coupling to MA gates the demo on something we don't control. |
| T-15 source-fetching | Not specified | `item_detail` → re-fetch URL + hash check (halt_stale on drift); `agenda_pdf` → pull from `meetings.raw_packet_text`; `staff_report` / `ordinance` / `exhibit` PDFs → fetch + `extractPdfText`; `map`/image sources → emit `unverifiable + remediation: promote_source` (T-15.5 stretch). | The verification skill is pure-function ("sources_map supplied by caller"). Runtime owns fetch + freshness. Vision verification is its own subsystem; deferring keeps the gate reachable. |
| Maya/Jason identity | "users — auth, email, plan tier" (§12.4) | `user_id TEXT` handles ('maya', 'jason') in `fingerprints.user_id` PK; no `users` table yet | T-23 (auth) is the right place for the users table + FK. Plain string handles let T-15/T-17/T-18 ship without auth. |
| T-17 escalation | "If item is partially_supported or confidence < 0.7 → Opus 4.7" (§15) | Sonnet 4.6 only. Scoring is mechanical (the rubric is fully specified in `scoring-rubric.md`). No model call needed for the math; Sonnet only invokes the synthesis-resolver and the why_this composer. | The rubric is deterministic arithmetic. Escalation triggers on judgment-heavy outputs, not arithmetic. Synthesis resolution is the only judgment piece in T-17, and the v1 fixture tests don't surface it. |
| T-17/T-18 split | PRD describes T-17 (matching) and T-18 (synthesis) as separate tasks but doesn't draw the data boundary | T-17 writes per-(user, candidate_item, briefing_date) `briefing_items` rows including `score jsonb`, `surface_reason`, `why_this`. T-18 reads above-threshold briefing_items + writes one `briefings` row per (user, briefing_date) with the denormalized `payload` + cover header. | Clean writer-per-table contract. T-17 is mechanical; T-18 is the judgment-heavy composer (Opus). |
| Synthesis-resolution shape | Verification skill emits split `item_atom`/`join_atom` claims; fingerprint skill resolves join atoms via `synthesis-resolution.json` | v1: embed resolution records inside `briefing_items.score.synthesis_resolutions[]` rather than a standalone table | Resolutions are tightly coupled to the score record they explain. Standalone table is justified only when cross-item analytics arrive (post-hackathon). |
| `RelevanceSlider` type | n/a | Fix `packages/shared/src/types/fingerprint.ts:1`: `"loose"` → `"broad"` to align with the locked schema (`scoring-rubric.md`, `relevance-score.json`) | Drift surfaced at orient time. T-17 is the first consumer; fix in the same commit that adds T-17 code so the slider value flows clean from the seed JSON through the rubric to the score record. |
| `fingerprint` JSONB at root | "fingerprints — one per user, JSON column" (§12.4) | Same shape — `fingerprints.fingerprint` is the JSONB column carrying the full structure (location, household, work, priorities, anti_priorities, relevance_slider, learned_voice_style, feedback_history). Row-level scalars: `user_id`, `updated_at`, `created_at` only. | Matches the PRD; lets T-29 (voice onboarding) write directly without re-modeling. |

## New tasks named (added to BACKLOG)

- **T-15.5** — Vision verification of map / exhibit sources. Scope: pass image bytes to Opus 4.7 vision; verify spatial claims (parcel highlight, district boundary). Stretch; not in Session 5. The plain-PDF path covers ~80% of T-15 sources.
- **T-17.5** — Cross-meeting briefing dedup. Same item can land in multiple meetings (postponed → re-listed). Briefing composer should not show the same `item.id` twice across recent days. Stretch; not in Session 5. Comes alive once we have ≥2 meetings ingested.
- **T-18.5** — Coverage stats persistence. PRD §9 implies "we considered X, surfaced Y" cover-header stats. v1 ships them inside `briefings.payload.coverage`; promoting to indexed columns waits until T-25 needs them.

## Pre-flight checklist (Step 0 — runs before any gate work)

If any of these fail, halt and surface — do not work around.

1. **Confirm Session 4 state intact.**
   ```
   git log --oneline -3                  # T-13 / T-11 / T-12 visible
   ```
   Plus a single Supabase REST call confirming `candidate_items` count = 56.

2. **Skill packs unchanged.** `git status .claude/skills/` reports clean.
   Re-running them mid-session would invalidate the T-09 fixture
   transcript that T-17's gate reproduces.

3. **`apps/orchestrator/.env.local` keys still resolve.**
   `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
   One smoke call (e.g. fetch the existing candidate_items count) is
   enough.

4. **`scripts/` directory absent.** Confirm it doesn't exist; we'll
   create it in step 1 of execute order. (Other monorepo scripts may
   live elsewhere — Session 4 didn't need any.)

## v2 schema migration (lands as part of T-15)

Four new tables in one migration file
`supabase/migrations/20260426034027_v2_pipeline_tables.sql`. Same
mechanism as T-12 (raw `.sql`, `supabase db push`, no ORM).

```sql
-- fingerprints: one per user. Full structure in JSONB column. user_id
-- is a stable handle ('maya', 'jason') for v1; T-23 adds users table
-- + FK in a follow-up migration.
CREATE TABLE fingerprints (
  user_id TEXT PRIMARY KEY,
  fingerprint JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- verification_reports: pure-function output of the verification skill.
-- One per (candidate_item, verified_at). re-verification appends.
CREATE TABLE verification_reports (
  id BIGSERIAL PRIMARY KEY,
  candidate_item_id BIGINT NOT NULL REFERENCES candidate_items(id),
  item_id TEXT NOT NULL,                      -- mirrors candidate_items.item_file_id
  item_source_hash TEXT NOT NULL,             -- mirrors candidate_items.source_hash at verification time
  verified_at TIMESTAMPTZ NOT NULL,
  verifier_version TEXT NOT NULL,
  overall_verdict TEXT NOT NULL,              -- pass_clean | pass_with_caveats | fail | halt_stale
  report JSONB NOT NULL,                      -- full verification_report record
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (candidate_item_id, verified_at)
);

CREATE INDEX idx_verification_reports_candidate ON verification_reports (candidate_item_id);
CREATE INDEX idx_verification_reports_verdict ON verification_reports (overall_verdict);

-- briefing_items: per-(user, candidate_item, briefing_date) scored row.
-- Written by T-17. Read by T-18 (top-K) and by T-27 trust pane (rank, why_this).
CREATE TABLE briefing_items (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES fingerprints(user_id),
  candidate_item_id BIGINT NOT NULL REFERENCES candidate_items(id),
  verification_report_id BIGINT NOT NULL REFERENCES verification_reports(id),
  briefing_date DATE NOT NULL,
  rank INTEGER,                               -- nullable; populated by T-18 only for surfaced items
  pre_score NUMERIC(5,4) NOT NULL,
  post_score NUMERIC(5,4) NOT NULL,
  surfaced BOOLEAN NOT NULL,
  surface_reason TEXT NOT NULL,
  why_this TEXT NOT NULL,
  score JSONB NOT NULL,                       -- full relevance-score record + synthesis_resolutions[]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, candidate_item_id, briefing_date)
);

CREATE INDEX idx_briefing_items_user_date ON briefing_items (user_id, briefing_date);
CREATE INDEX idx_briefing_items_surfaced ON briefing_items (user_id, briefing_date, surfaced);

-- briefings: one row per (user, briefing_date) with denormalized payload
-- snapshot for one-query email rendering and trace surfaces.
CREATE TABLE briefings (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES fingerprints(user_id),
  briefing_date DATE NOT NULL,
  payload JSONB NOT NULL,                     -- cover_header, items[], coverage, fingerprint_version_used, trace
  generated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, briefing_date)
);
```

The migration also extends `agent_sessions.runtime` allowed values
informally to `{orchestrator, verifier, matcher, composer}` — no enum
constraint, just usage convention. T-19's Routine eventually wraps all
four in one nightly trace.

## Three gate moments

### T-15 — Verification loop (candidate_items → verification_reports)

**Files shipped:**

- `supabase/migrations/20260426034027_v2_pipeline_tables.sql` — the four-table v2 migration above.
- `packages/shared/src/types/verification-report.ts` — hand-written TS mirror of `verification-report.json` (matches the pattern from T-12's `item.ts`).
- `packages/shared/test/verification-report-drift.test.ts` — drift test loading a fixture report (synthesized from a known item if no real one exists yet) and validating it against the schema.
- `apps/orchestrator/src/verify/verifier-prompt.ts` — loads the verifier-prompt.md content + supporting reference files; assembles cached system blocks following the same pattern as `classify.ts`.
- `apps/orchestrator/src/verify/sources.ts` — builds `sources_map` from a candidate item: re-fetches `item_detail`, pulls `agenda_pdf` from `meetings.raw_packet_text`, fetches+extracts other PDFs, marks unsupported source types with a sentinel that the prompt converts to `unverifiable` claims.
- `apps/orchestrator/src/verify/verify-item.ts` — one verification call per item: loads candidate, builds sources_map, invokes verifier via `invokeWithTool`, persists report, returns InvokeResult for cost tracking.
- `apps/orchestrator/src/verify/persist.ts` — `upsertVerificationReport(args)`; INSERT (not upsert) since (candidate_item_id, verified_at) is unique by definition.
- `apps/orchestrator/src/verify/verify.ts` — entry point: `--meeting <id>` or `--all-unverified`. Opens agent_sessions row (`runtime='verifier'`), iterates, prints per-item progress + cost, closes session with summary notes.
- `apps/orchestrator/package.json` — adds `verify` script.

**Source-fetching strategy** (locked here to avoid mid-execute decisions):

| Source `type` | sources_map populated from | If unreachable |
|---|---|---|
| `item_detail` | re-fetch URL; if `sha256(html) != item.source_hash` → halt_stale (skill rule #4) | report `fetch_status: timeout/http_*`; verdicts use other sources |
| `agenda_pdf` | `meetings.raw_packet_text` (cached from T-11) | should never be missing — meeting row guarantees it |
| `staff_report`, `ordinance`, `exhibit` | fetch URL + `extractPdfText` | report `fetch_status: timeout/http_*`; affected claims → `unverifiable` |
| `map`, image-typed `exhibit` | omit from sources_map (T-15.5 stretch) | the verifier emits `unverifiable + remediation: promote_source` |

**Advisor strategy:** Opus 4.7 (per CLAUDE.md, "verification" is an Opus task). No Sonnet first-pass — verification is the load-bearing rigor moment of the system, and the cost delta on 56 items is bounded ($0.50–$1.00 with prompt caching).

**Cost budget for T-15** (one full meeting, 56 items):

| Phase | Model | Items | Per-item input (post-cache) | Per-item output | Subtotal |
|---|---|---|---|---|---|
| Verification | Opus 4.7 ($5/M in, $25/M out) | 56 | ~3K | ~1.5K | $0.84 in + $2.10 out = $2.94 |
| Prompt caching savings (skill pack ~5K tokens cached, 56 items) | -90% on cached input | | | | -$1.80 |
| **Estimated total per meeting** | | | | | **~$1.15** |

Halt-and-flag if T-15 dev iteration exceeds **$3** cumulative — leaves headroom for T-17/T-18 within the session's $5 ceiling.

**Gate evidence for T-15:**

- Migration applied; all four tables visible in Supabase Console.
- `pnpm --filter @revere/shared test` passes the new drift test.
- `pnpm typecheck` clean across all workspaces.
- Run `pnpm --filter @revere/orchestrator run verify -- --meeting 1362247` against the 56 candidate_items.
- ≥50/56 reports have `overall_verdict ∈ {pass_clean, pass_with_caveats}`.
- The 26-1501 report has all 5 zoning sub-fields with verdict `supported` (matches T-06 ground truth: each upstream zoning sub-field carries `confidence: high` + `raw_passage` so the verifier should mark them `supported`).
- `agent_sessions` row updated with `items_processed=56`, `runtime='verifier'`, status=`success`.
- Evidence written to `docs/verification/t-15-loop-gate.md` (per-verdict counts; spot-check on 26-1501; cost summary).

**Commit:** `T-15: verification loop persists per-item reports`.

### T-17 — Fingerprint matching (verified items + fingerprints → briefing_items)

**Files shipped:**

- `apps/orchestrator/test-fixtures/fingerprints/maya.json`, `apps/orchestrator/test-fixtures/fingerprints/jason.json` — verbatim mirrors of the T-09 fixture transcript persona definitions (priorities, weights, anti list, relevance_slider).
- `scripts/seed-fingerprints.ts` — reads the two JSON files; upserts into `fingerprints` via service-role Supabase client. Idempotent.
- `packages/shared/src/types/fingerprint.ts` — fix `RelevanceSlider`: `"loose"` → `"broad"`. Same commit as T-17 since T-17 is the first consumer.
- `packages/shared/src/types/relevance-score.ts` — hand-written TS mirror of `relevance-score.json`.
- `apps/orchestrator/src/match/scoring.ts` — pure-function rubric implementation per `scoring-rubric.md` (geography_match, topic_overlap, priority_phrase_match, action_window_boost, anti_priority_hit; pre_score / post_score; threshold lookup; surface_reason; why_this composer).
- `apps/orchestrator/src/match/topic-vocabulary.ts` — embed the topic-vocabulary-map.md table as a TS map (or load at runtime from the markdown — pick whichever drift-protects best). Decision: load at runtime to keep one source of truth.
- `apps/orchestrator/src/match/persist.ts` — `upsertBriefingItem(args)` on `(user_id, candidate_item_id, briefing_date)`.
- `apps/orchestrator/src/match/match.ts` — entry point: `--user <id> --briefing-date <YYYY-MM-DD>` or `--all-users --briefing-date ...`. Joins candidate_items with their latest verification_report; filters out `fail`/`halt_stale`; scores; persists.
- `apps/orchestrator/test/match/scoring.test.ts` — unit tests reproducing the locked F1–F5 expectations from the T-09 fixture transcript. **Hard gate**: 10/10 expected pairs must match exactly (per-pair `breakdown`, `pre_score`, `post_score`, `surfaced`, `surface_reason` for both Maya and Jason).

**Advisor strategy:** Sonnet 4.6 only (per Session 5 Operating Rules). Scoring is mechanical arithmetic — no model call. Why_this composition uses Sonnet with the rubric's why_this template; cached system block avoids per-call overhead.

**Cost budget for T-17:** ~$0.10 total. ~110 calls (56 items × 2 personas) at ~1K cached input + 0.2K output each. Negligible vs. the session ceiling.

**Gate evidence for T-17:**

- Migration applied (already from T-15). Seed script runs; both fingerprints visible in `fingerprints` table.
- `pnpm --filter @revere/orchestrator test` passes new scoring test (10/10 fixture pairs).
- Run `pnpm --filter @revere/orchestrator run match -- --all-users --briefing-date 2026-04-09`.
- `briefing_items` populated with 56 × 2 = 112 rows for the meeting.
- F1 (26-1501) surfaces for both personas (`surfaced=true`, `surface_reason='score_above_threshold'`).
- F2-equivalent in this meeting: a downtown-corridor item present in the 56-item set must surface for Jason and not Maya. Plan validates by spot-check at gate time.
- F3-equivalent: any item triggering Maya's `anti_priorities` (sister-city / dog parks / ceremonial) must show `surface_reason='anti_priority_suppressed'` for Maya and `'below_threshold'` for Jason.
- `agent_sessions` row recorded with `runtime='matcher'`, `items_processed=112`, status=`success`.
- Evidence written to `docs/verification/t-17-matching-gate.md` — per-persona surfaced count, spot-check on F1/F2/F3 equivalents, scoring-test transcript.

**Commit:** `T-17: fingerprint matcher emits per-persona scored briefing_items`.

### T-18 — Synthesis composer (briefing_items → briefings)

**Files shipped:**

- `apps/orchestrator/src/compose/composer-prompt.ts` — system prompt instructing Opus 4.7 to compose a cover header (PRD §9.1: `Revere · Tue Apr 22 · 3 items for you`), order surfaced briefing_items by post_score desc with tiebreaks, write coverage stats, and emit via `emit_briefing` tool.
- `apps/orchestrator/src/compose/compose-briefing.ts` — entry point: `--user <id> --briefing-date <YYYY-MM-DD>`. Reads surfaced briefing_items joined to candidate_items + verification_reports; calls Opus once with all surfaced items in context; writes to `briefings`; updates `briefing_items.rank` for surfaced rows.
- `apps/orchestrator/src/compose/persist.ts` — `upsertBriefing(args)` on `(user_id, briefing_date)`.
- `apps/orchestrator/src/compose/compose.ts` — multi-user wrapper: `--all-users --briefing-date ...` invokes per-user composition.

**Advisor strategy:** Opus 4.7 (per Session 5 Operating Rules and PRD §15 — "briefing synthesis (final compose) → Opus 4.7 (high), always primary"). One call per (user, briefing_date) with all surfaced briefing_items in user content; system prompt cached.

**Cost budget for T-18:** ~$0.30 total for both personas (≤10 surfaced items per persona × ~2K input + ~3K output × 2 calls).

**Gate evidence for T-18:**

- Run `pnpm --filter @revere/orchestrator run compose -- --all-users --briefing-date 2026-04-09`.
- `briefings` table contains exactly two rows (one per persona) for that date with populated `payload`.
- Maya's `payload.items[]` and Jason's `payload.items[]` differ in:
  - **Top item** (different `candidate_item_id`), OR
  - **Ordering** (same set, different rank), OR
  - **Coverage stats** (different surfaced counts).
  Visible divergence required — if both payloads are identical, the gate fails.
- Cover headers populated per PRD §9.1 format.
- `payload.fingerprint_version_used` and `payload.trace.{verification_session_id, matching_session_id, composer_session_id}` present.
- Evidence written to `docs/verification/t-18-briefings-gate.md` — both payloads side-by-side; divergence table; cover header strings.

**Commit:** `T-18: composer writes per-persona briefings to Supabase`.

### Bundled-task gate (the demo's central claim, mechanically demonstrated)

In addition to the three task gates above, the session as a whole must satisfy:

> **From the same 56 candidate_items, the system produces two
> briefings whose `payload.items[]` are visibly different.**

If T-15, T-17, and T-18 all individually pass but Maya's and Jason's
payloads are identical, the session has not succeeded. This is the
property the demo's money-shot beat depends on (PRD §19.2 row "The
money shot"). Recorded explicitly so it can't be quietly skipped.

Bundled gate evidence joins the T-18 evidence file with a one-row
comparison: `top_item.candidate_item_id`, `top_item.why_this` snippet,
`coverage.surfaced` count, all per persona side-by-side.

## Risk register (4 watch-fors during execution)

1. **Verifier emits `halt_stale` on the live re-fetch.** The 26-1501
   page on Legistar may have changed since T-13's hash. **Rule:** if
   any item halts stale, the verifier persists the halt_stale report,
   and the runtime continues (does not abort the loop). Report row
   counts in the gate evidence. Halt-stale itself is a valid verdict;
   it is not a code failure.

2. **Fingerprint scoring drift between rubric prose and TS code.** The
   rubric is fully specified in `scoring-rubric.md`, but the T-09 gate
   used a subagent to compute scores by hand. T-17's TS implementation
   must reproduce those numbers exactly. **Rule:** if any of the 10
   fixture pairs disagrees, halt; the prose is the ground truth and
   the code is wrong. Do not "fix" the fixture transcript.

3. **T-18's composer hallucinates a cover header that contradicts the
   surfaced items.** PRD §11.1 verification doesn't run on briefings.
   **Rule:** the composer's tool schema enforces that the cover
   header's item count matches `payload.coverage.surfaced`. The
   composer prompt instructs against editorializing — narrative cover
   prose is for v2.

4. **Cost budget overrun.** T-15 is the riskiest line item. **Rule:**
   if T-15 development iteration exceeds **$3** cumulative across all
   re-runs, halt and re-tune (likely: lower max_tokens; verify cache
   is hot; reduce per-call source bytes). Session ceiling is $5
   total.

## Execute order (Phase 3)

Each step ends with a commit. Halt on any gate failure.

0. **Pre-flight** — git log, candidate_items count, skill packs clean,
   env keys resolve. No commit.

1. **Schema migration + drift test** — write the v2 migration,
   `verification-report.ts` and `relevance-score.ts` types, drift
   test. `supabase db push`. `pnpm typecheck` + `pnpm --filter
   @revere/shared test`. **No standalone commit** — folded into T-15.

2. **T-15** — write verifier modules + entry point + sources strategy.
   Run live verification against 56 candidate_items. Verify gate
   evidence. Save evidence file. Commit:
   `T-15: verification loop persists per-item reports`.

3. **T-17** — write seed script, fix slider type drift, write scoring
   module + matcher entry point + scoring test. Run scoring test
   (must reproduce 10/10 T-09 fixture pairs). Run live matcher.
   Verify gate evidence. Save evidence file. Commit:
   `T-17: fingerprint matcher emits per-persona scored briefing_items`.

4. **T-18** — write composer module + entry point. Run live composer
   for both personas. Verify gate evidence + bundled-task gate. Save
   evidence file. Commit:
   `T-18: composer writes per-persona briefings to Supabase`.

After step 4, report final state: row counts in
verification_reports / briefing_items / briefings; total token spend
across T-15 + T-17 + T-18; per-persona top-item divergence.

Halt at end of step 4. Do NOT touch T-19 (Routine), T-21 (adversarial
loop), T-22 (draft UI), T-23 (auth), T-24 (email), T-25 (in-app
views), or anything else past T-18.

## Session-scope rules

- Sonnet 4.6 for: migration sql, seed script, scoring code (mechanical
  arithmetic), matcher entry point, persist helpers.
- Opus 4.7 for: verifier prompt orchestration (the load-bearing rigor
  call), composer prompt (judgment-heavy ordering + cover header).
- Aggressive prompt caching — same pattern T-13 used. Skill packs and
  static system instructions go behind `cache_control: { type:
  "ephemeral" }`. Per-item input is the only cache-bust.
- Files trending past ~250 lines split before shipping (Session 1–4
  pattern).
- If a gate fails, halt — do not commit a failing gate or paper over.
- Anything not required by the four gates lands in BACKLOG (T-15.5,
  T-17.5, T-18.5, multi-meeting indexes, etc.).
- Cost ceiling $5 total. Halt at $3 if T-15 not done.
