# Session 7 — Trust surfaces: T-26 + T-27

## Context

Session 6 closed with the briefing UI rendering for both personas and the
~30s bundled-flow video capturing the demo's beats 1–3. Session 7 builds
the two trust-surface modals that win the Opus 4.7 use score and the Best
use of Managed Agents prize argument:

  T-26 — Source-proof modal upgraded from `mode="minimal"` to `mode="full"`
         with a parcel-highlighted hi-res zoning map. The single most
         concrete demonstration of 4.7's 3.75MP vision capability.
  T-27 — "Why am I seeing this?" trace modal. Three hairline-divided
         sections (Ingestion · Verification · Why You) joined to
         agent_sessions + verification_reports + relevance_score. Trace
         as trust surface, not debug tool.

Both ship in one session because they share the modal-over-briefing-item
idiom, the data layer (joins on candidate_items + verification_reports +
briefing_items + agent_sessions), and the rendering cost (Opus 4.7 vision
calls in T-26's data layer; mostly mechanical Sonnet UI in both).

After Session 7, judges click any briefing item and see (a) the zoning
map with the exact parcel highlighted, (b) the literal verification
report with verdicts per claim, (c) the trace of which agent session
produced it. The Opus 4.7 case is mechanically demonstrated, not just
claimed.

Two non-negotiables surfaced in Phase 1:

- **26-1501 has no standalone zoning-map attachment.** The parcel diagram
  lives inside the 12.4 MB Staff Report PDF, buried among 50–100 pages
  of mixed content. T-26 is therefore a **two-stage Opus vision
  pipeline** (page-detection → parcel-localization), not a one-shot
  vision call on a clean map. Smoke-test the pipeline on 26-1501 BEFORE
  any UI work commits — if the extraction is unreliable, the plan
  switches to a different demo item (10+ zoning items in the 56-item
  set are candidates).
- **PDF-page rasterization is missing from the codebase.** Today's
  pipeline only extracts text via `pdf-parse`. T-26 needs page-as-image
  bytes to feed Opus vision. New dep + new orchestrator step.

## Divergences from PRD (matches Session 1–6 table format)

All locked in Phase 1.

| Divergence | PRD says | Session 7 ships | Why |
|---|---|---|---|
| Parcel-highlight pipeline | "4.7 identifies the exact parcel relevant to the fingerprint and overlays a visual highlight" (§13.1) | **Two-stage** Opus 4.7 vision pipeline run at ingestion time: stage 1 page-detect (which page in the Staff Report contains the zoning map), stage 2 parcel-localize (bbox in pixel coordinates on that page). Pre-extracted, persisted to a v4-migration table; modal renders SVG overlay client-side. | The PRD's framing assumes a clean parcel map. Real Legistar attachments bury the map inside multi-MB Staff Report PDFs. Two-stage pipeline is the honest implementation and tells a *stronger* 4.7 story ("finds the map page in 100 pages of mixed content, then localizes the parcel in pixels"). |
| `zoning_map_extractions` table | Not in §12.4 | New v4 migration `20260426123320_v4_zoning_extractions.sql` adds a table keyed on candidate_item_id with `page_index`, `page_image_path`, `bbox` JSONB, `confidence` text, `extracted_at`, `extractor_version`. RLS enabled, service-role-only (modal route reads via admin client). | Tightly coupled to candidate_items but separable so re-extraction at higher quality (T-26.5 follow-up) can append rows without disturbing the briefing pipeline. |
| PDF page rasterization | Not specified | `pdftoppm` (poppler-utils) shelled out from the orchestrator. Page images rendered at 200 DPI to PNG, stored locally under `apps/orchestrator/cache/zoning-pages/<candidate_item_id>/<page_index>.png` and uploaded to Supabase Storage on a new `zoning-maps` bucket. Bucket is service-role-only; modal serves images via signed URLs (24h TTL). | `pdf-lib` + `canvas` would add 60+ MB of JS deps; `pdftoppm` is a one-line install (already on most macOS via brew + on Vercel build via apt). Storage in Supabase Storage avoids burning the Postgres row cap on multi-MB images. |
| Confidence-gated fallback | n/a | If stage 2 returns `confidence: "low"` OR stage 1 returns no map page, persist a row with `confidence: "low"` and `bbox: null`. Modal renders the page image without overlay AND a "Open staff report at page N ↗" deep link. No silent failures; the absence of overlay is a designed state. | Bad maps are inevitable; the modal can't render a misaligned highlight on stage. Confidence triple `{value, confidence, raw_passage}` is the same pattern the classifier uses for zoning sub-fields. |
| Smoke-test gate before UI | n/a | T-26 commits in **two phases**. Phase A (data layer): write the pipeline, run it on 26-1501 only, manually open the rendered page image + bbox JSON, eyeball-confirm the parcel is right. **No UI commit until smoke passes.** Phase B (UI): if smoke passes, extend the modal + capture screenshots + commit. If smoke fails, halt; switch demo item; re-smoke before any commit. | "Demo cannot ship with a misaligned parcel highlight" is the briefing's hard rule. Smoke-test-before-UI enforces it mechanically. |
| Trace view scope | "tracing as trust surface" (§14.3) | Three hairline-divided sections (Ingestion · Verification · Why You), each with a humanized prose summary + a "View raw record ↗" inline toggle that reveals the JSON. No tabs, no accordion. Same scrolling-modal idiom as the briefing list. | Tabs read as dashboard chrome; accordion is mid-tier dashboard idiom. The editorial direction holds: prose first, JSON one click away. |
| Trace view's "Ingestion" data | PRD doesn't specify the v1 data shape | Read `agent_sessions` rows for the meeting, joined to candidate_items via meeting_id. Show: orchestrator session that classified the item, verifier session that scored it, matcher session that ranked it, composer session that placed it on this briefing. Humanized prose ("Classified by the Austin orchestrator at 11:30pm"). JSON view shows the agent_sessions row's `notes` field. | The plan-time YAGNI on `tool_calls JSONB` + `cost_cents` (Session 4 deferral) means we can't surface per-call cost in v1. The `notes` field carries cost as text — adequate for the trust surface; structured columns are a T-19 follow-up. |
| Trace view "Why You" reuse | n/a | Pull the existing `score` JSONB from briefing_items — the same record T-17 wrote, the same `why_this` field-path string T-25 renders inline. The trace modal adds the breakdown table (geography_match=1, topic_overlap=0.26, etc.) and the matched fingerprint priorities. | The why_this trust receipt is already the load-bearing element of T-25's item. Trace just adds the supporting math; doesn't re-derive anything. |
| Storage bucket | Not in §12.4 | New `zoning-maps` Supabase Storage bucket, public-read disabled, service-role only. Signed URLs minted server-side per render request (24h TTL). | RLS on storage is the canonical pattern; signed URLs are how server components hand off image refs to the client without leaking the bucket. |

## New tasks named (added to BACKLOG)

- **T-26.5** — Re-extract parcel coordinates at higher resolution. v1
  ships at 200 DPI and accepts low-confidence rows. Re-extracting at
  300 DPI on items that came back low-confidence is a follow-up that
  costs ~$1–2 in vision calls.
- **T-27.5** — Per-call cost surfaced as structured columns on
  agent_sessions (`tool_calls JSONB`, `cost_cents int`). Today's
  notes-as-text approach is the v1 trust surface; structured cost
  unlocks T-19's nightly Routine cost dashboard.
- **T-26.6** — On-demand vision fallback. If a candidate_item has no
  pre-extracted row in `zoning_map_extractions` (e.g. ingested before
  T-26 landed, or excluded by smoke), the modal could still trigger
  a vision call live. Skipped in v1 for demo reliability; added to
  BACKLOG so the architecture is documented.

## Visual identity continuity

The Session 6 design tokens carry forward unchanged. Two new applications:

- **Parcel highlight overlay**: 2px vermilion stroke with 25% vermilion
  fill (`rgba(200, 51, 31, 0.25)`). This is **the third vermilion use
  per the locked ceiling** — and the most striking. Cover-header
  numerals, "see source" link underline, parcel highlight. No other
  vermilion appearances on the modal (confidence dot still district
  sage; section labels still district sage).
- **Trace view section labels**: same district-sage small-caps treatment
  as "WHY THIS MATTERS TO YOU" elsewhere. The "View raw record ↗"
  inline button uses the same vermilion-underlined inline-link style as
  "See source ↗".

The hairline-no-card rule still holds. The trace modal's three sections
are separated by `whisper` hairlines, not card backgrounds.

## Pre-flight checklist (Step 0 — runs before any gate work)

If any of these fail, halt and surface — do not work around.

1. **Confirm Session 6 state intact.**
   ```
   git log --oneline -5             # T-28 video / T-28 / T-25 / T-23 visible
   ```
   Plus Supabase: `briefings` count = 2, `briefing_items` count = 74,
   `agent_sessions` for meeting_id=1 ≥ 10.

2. **`pdftoppm` available.** `which pdftoppm` returns a path. If absent,
   `brew install poppler` (macOS). On Vercel: a `vercel.json` build
   step adds it via apt-get; defer until T-26 actually deploys.

3. **Supabase Storage `zoning-maps` bucket exists** (or can be created
   via SQL in the v4 migration). Service-role-only.

4. **Anthropic API key has vision capability.** Same `ANTHROPIC_API_KEY`
   we've been using; verified by smoke test.

5. **`apps/web/.env.local`** still has the three keys from T-23.

## v4 migration (lands as part of T-26)

```sql
-- Session 7 / T-26: zoning map extractions.
-- Pre-extracted by the orchestrator's two-stage Opus 4.7 vision pipeline.
-- Stage 1 finds the page in the Staff Report PDF that contains the parcel
-- diagram. Stage 2 returns the parcel's bbox in pixel coordinates on that
-- page. Modal renders the page image with an SVG overlay client-side.
--
-- service_role bypasses by design — the modal route uses signed URLs
-- minted via admin client, never directly serving from this table to
-- authenticated clients.

CREATE TABLE zoning_map_extractions (
  id BIGSERIAL PRIMARY KEY,
  candidate_item_id BIGINT NOT NULL REFERENCES candidate_items(id),
  source_index INTEGER NOT NULL,          -- which item.sources[i] is the source PDF
  page_index INTEGER,                     -- 1-indexed; nullable when no map page found
  page_image_path TEXT,                   -- supabase storage path: zoning-maps/<cid>/<page>.png
  page_image_width INTEGER,               -- pixel dimensions for the SVG overlay
  page_image_height INTEGER,
  bbox JSONB,                             -- {x, y, w, h} in pixels, OR null on low confidence
  confidence TEXT NOT NULL,               -- 'high' | 'medium' | 'low'
  extractor_version TEXT NOT NULL,        -- 'v1' for the two-stage pipeline
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,                             -- why low-confidence, smoke-test annotations
  UNIQUE (candidate_item_id, extractor_version)
);
ALTER TABLE zoning_map_extractions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_zoning_extractions_candidate ON zoning_map_extractions (candidate_item_id);
```

Plus a Supabase Storage bucket creation (via management API or
dashboard, since `CREATE BUCKET` isn't standard SQL):
- bucket name: `zoning-maps`
- public: false
- file size limit: 5 MB (200 DPI single-page PNG fits comfortably)

## Two gate moments

### T-26 — Source-proof pane with parcel-highlighting hi-res map

**Phase A: data layer + smoke test (no UI commit yet).**

Files shipped in Phase A:

- `supabase/migrations/20260426123320_v4_zoning_extractions.sql` — v4
  migration above.
- `apps/orchestrator/src/vision/rasterize.ts` — wrapper around
  `pdftoppm` to render PDF page → PNG bytes at 200 DPI. Returns
  `{ pageImageBytes, width, height }` per requested page (or all
  pages on first call, cached).
- `apps/orchestrator/src/vision/extract-parcel.ts` — two-stage Opus
  4.7 vision pipeline:
  1. **Stage 1: page detection.** Pass page-thumbnails of the Staff
     Report (rendered at 100 DPI to bound input) to Opus with the
     prompt "Which page contains a zoning map exhibit showing the
     property at <address>? Return page_index and confidence.
     If none, return page_index: null."
  2. **Stage 2: parcel localization.** Pass the full-resolution
     (200 DPI) image of the identified page to Opus with the prompt
     "On this zoning map, identify the bounding box (in pixel
     coordinates) of the property at <address>. Return
     {x, y, w, h, confidence, raw_passage}."
- `apps/orchestrator/src/vision/persist.ts` — uploads the page image
  to `zoning-maps` bucket; inserts into `zoning_map_extractions`.
- `apps/orchestrator/src/vision/extract.ts` — entry point:
  `tsx ... --candidate <id>` runs the pipeline on one item. Or
  `--meeting <id>` runs on every candidate_item with a zoning sub-object.
- `apps/orchestrator/package.json` — adds `extract:zoning` script.

**Smoke test (gate-zero, before any UI commit):**
- Run `pnpm extract:zoning -- --candidate <26-1501-id>`.
- Open Supabase Storage; download the rendered page image.
- Open the bbox JSON; manually overlay it on the page image (any
  image viewer with a rectangle tool, or a tiny SVG one-liner).
- **Eyeball check**: the rectangle aligns with the actual 1811 East
  Cesar Chavez parcel on the zoning exhibit, not "near it."
- If smoke fails → halt. Do not commit. Switch demo item to one of
  the alternate zoning candidates (26-1410, 26-1411, 26-1412,
  26-1413, 26-1414, 26-1415, 26-1416, 26-1417, 26-1418, 26-1467,
  26-1497, 26-1498). Re-smoke before any commit.

**Phase B: UI extension.**

Files shipped in Phase B:

- `apps/web/src/lib/queries/zoning-extraction.ts` — admin-client
  query: load extraction row by candidate_item_id; mint a signed URL
  for the page image (24h TTL).
- `apps/web/src/components/briefing/SourceProofModal.tsx` — extend
  the `mode="full"` branch:
  - If extraction has `confidence: high|medium` AND `bbox != null`:
    render the page image with an SVG overlay at the bbox. Stroke
    2px vermilion, fill 25% vermilion.
  - If extraction has `confidence: low` OR `bbox == null`: render
    the page image without overlay AND the deep-link "Open staff
    report at page N ↗".
  - If no extraction row exists: fall through to the minimal-mode
    behavior (existing T-25 layout).
- `apps/web/src/lib/source-proof.ts` — return the extraction
  reference alongside the existing claim picker.
- `apps/web/app/briefing/page.tsx` + `apps/web/app/demo/page.tsx` —
  swap `mode="minimal"` to `mode="full"` and pass the extraction
  prop through.

**Advisor strategy:**
- **Opus 4.7** for the two vision stages. This is the literal 4.7
  capability the demo features. No Sonnet substitution.
- Sonnet 4.6 for: rasterizer, persistence wrapper, signed-URL helper,
  modal SVG overlay markup, query helpers.

**Cost budget for T-26:**
- Smoke test on 26-1501: 2 Opus vision calls × ~50 input tokens of
  prompt + ~3 MP image (≈1.5K tokens) = ~$0.05 per call → ~$0.10 total.
- Full sweep across 12 zoning candidates (10 known zoning items +
  2 buffer): ~$1.20.
- Worst case (all 56 candidates, including non-zoning that we
  short-circuit on): ~$3.00.
- Plan target: smoke + 12-candidate sweep ≈ **$1.30**.

**Gate evidence for T-26:**
- Smoke transcript saved to `docs/verification/t-26-smoke.md` with
  the rendered page image inline + the bbox + an annotation that
  visually confirms the alignment.
- Full-meeting sweep results: per-candidate `confidence` distribution
  (how many high / medium / low), saved to the gate evidence doc.
- UI screenshots: open `/demo?fp=jason` (Jason scores 26-1501 highest
  among rezoning items), click the top item, modal opens with the
  parcel highlight visible. Capture at 1280px AND 380px.
- Low-confidence fallback: pick a candidate that returned low (or
  force one) and capture the no-overlay + deep-link state.
- All inline in `docs/verification/t-26-source-proof-gate.md`.

**Commit (Phase A):** `T-26: zoning extraction pipeline + smoke gate on 26-1501`
**Commit (Phase B):** `T-26: source-proof modal renders parcel-highlighted map`

### T-27 — "Why am I seeing this?" trace view

**Files shipped:**

- `apps/web/src/lib/queries/trace.ts` — joined query: given a
  candidate_item_id + user_id + briefing_date, returns:
  - the orchestrator + verifier + matcher + composer agent_sessions
    that touched it (joined via `meeting_id` for orchestrator/verifier;
    via `notes`-text-search or session-id columns for the
    user-specific matcher/composer);
  - the latest verification_report (already RLS-bypass-loaded by the
    source-proof modal — share the query helper);
  - the briefing_items row's `score` JSONB.
- `apps/web/src/components/briefing/TraceModal.tsx` — new modal,
  same idiom as SourceProofModal. Three hairline-divided sections:
  - **Ingestion** — humanized prose ("Classified by the Austin
    orchestrator at 11:30pm. Verified by the Sonnet 4.6 verifier.
    Matched against your fingerprint. Composed by the Opus 4.7
    composer.") + per-section "View session log ↗" toggle revealing
    the agent_sessions.notes string in mono.
  - **Verification** — humanized ("Verifier checked 30 claims; 18
    supported with verbatim source quotes, 12 unverifiable.") + a
    table of zoning sub-field verdicts + "View raw report ↗" reveals
    the verification_report JSON.
  - **Why You** — humanized prose pulling from `score.why_this` +
    breakdown table (geography_match, topic_overlap, etc.) + "View
    raw score ↗" reveals the relevance_score JSON.
- `apps/web/src/components/briefing/BriefingItem.tsx` — add a "Why
  am I seeing this? ↗" button next to "See source ↗". Same vermilion
  underline treatment.
- `apps/web/src/components/briefing/BriefingView.tsx` — extend the
  client component's modal-state to track a second modal (trace),
  not just source-proof.

**Advisor strategy:** Sonnet 4.6 throughout. No model calls; pure
data + UI.

**Cost budget for T-27:** ~$0.05 (Sonnet for component scaffolding).

**Gate evidence for T-27:**
- Click "Why am I seeing this?" on Maya's 26-1501. Modal opens with
  three sections. Capture screenshot.
- Toggle each section's "View raw record ↗" — JSON expands inline.
  Capture screenshot of expanded state.
- Switch to Jason (`/demo?fp=jason`). Open trace on Jason's 26-1501.
  Same modal layout, but "Why You" section reflects Jason's
  `small_business_permitting` lens, not Maya's `housing_cost`.
  Capture side-by-side screenshot.
- All inline in `docs/verification/t-27-trace-gate.md`.

**Commit:** `T-27: trace modal — ingestion, verification, why_you`

### Bundled-task gate — updated video

Re-record the bundled-flow video to include the trust surfaces. New
flow (~45s):

1. Land on Maya's briefing.
2. Click 26-1501 → source-proof modal opens with the **parcel-highlighted
   zoning map** (the new T-26 surface). Pause for visual punch.
3. Close modal. Click "Why am I seeing this?" on the same item →
   trace modal opens with three sections.
4. Toggle "View raw report ↗" on the verification section — JSON
   expands showing the supported zoning sub-fields.
5. Close modal. Switch to Jason.
6. On Jason's 26-1501, click "Why am I seeing this?" → trace modal
   shows the same item with Jason's `small_business_permitting` lens.
7. Close. End.

Save to `docs/verification/t-27-bundled-flow-with-trust.webm` (NEW
file, alongside the Session 6 t-28-bundled-flow.webm — keep both as
checkpoints).

## Risk register (5 watch-fors during execution)

1. **Smoke fails on 26-1501.** Two failure modes: stage 1 doesn't
   find the map page (PDF is text-heavy, no exhibit), OR stage 2
   returns a misaligned bbox. **Rule:** halt before any commit. Try
   the alternate zoning candidates (12 candidates available). Demo
   ships with a candidate that smokes clean.

2. **`pdftoppm` not on the host.** macOS dev: `brew install poppler`
   on first run. Vercel deploy: Vercel images may not include poppler;
   T-26's deployment story may need a serverless-function shim or a
   pre-render step. **Rule:** rasterize-once-at-ingestion is the
   architectural choice that sidesteps this — production reads from
   storage, not from `pdftoppm` at request time.

3. **Vermilion creep on the trace modal.** Three sections with three
   "View raw record ↗" toggles is exactly where AI default suggests
   "color-code each section." **Rule:** all three section labels are
   district sage. The vermilion appears only on the inline link
   underline + (for the source-proof modal) the parcel highlight.
   Per-commit visual review.

4. **agent_sessions data is text-not-structured.** `notes` is a
   free-text field. T-27's humanized prose has to parse it — error-
   prone. **Rule:** humanized prose is best-effort; the JSON view
   shows the raw `notes` string verbatim. Don't render fake
   structured data; if the parse fails, just show the notes string
   in mono.

5. **Modal stack management.** With two trust modals plus the
   persona switcher, the page can have multiple overlays in flight.
   **Rule:** only one modal open at a time; clicking "Why am I
   seeing this?" while source-proof is open closes the latter first.
   BriefingView's modal-state is a single `openModal: 'source' |
   'trace' | null` discriminator.

## Execute order (Phase 3)

Each step ends with a commit. Halt on any gate failure.

0. **Pre-flight** — git log, Supabase counts, pdftoppm available, env
   keys resolve. No commit.

1. **T-26 Phase A — data layer + smoke gate.** v4 migration
   (`supabase db push`). Vision pipeline modules. Run smoke on
   26-1501. Manually eyeball the bbox alignment. If smoke passes:
   sweep 12 zoning candidates. Save `docs/verification/t-26-smoke.md`.
   Commit: `T-26: zoning extraction pipeline + smoke gate on 26-1501`.

2. **T-26 Phase B — UI extension.** Extend `SourceProofModal`
   `mode="full"` branch. Wire signed-URL fetch in
   `app/briefing/page.tsx` + `app/demo/page.tsx`. Capture screenshots
   at 1280px + 380px. Save `docs/verification/t-26-source-proof-gate.md`.
   Commit: `T-26: source-proof modal renders parcel-highlighted map`.

3. **T-27 — trace modal.** New `TraceModal.tsx`, new query helper,
   "Why am I seeing this?" button on `BriefingItem`. Single-modal
   discriminator on `BriefingView`. Per-section humanized prose
   plus "View raw ↗" inline toggles. Capture Maya + Jason
   side-by-side. Save `docs/verification/t-27-trace-gate.md`.
   Commit: `T-27: trace modal — ingestion, verification, why_you`.

4. **Bundled video update.** Re-record the demo flow including
   parcel-highlight modal + trace modal. Save
   `docs/verification/t-27-bundled-flow-with-trust.webm`.

After step 4, report: smoke result on 26-1501, full sweep distribution
of confidence values, screenshot count, video duration + filesize,
total token spend across T-26 + T-27.

Halt at end of step 4. Do NOT touch T-21 (adversarial), T-19
(Routine), T-24 (email), T-29 (voice onboarding).

## Session-scope rules

- **Opus 4.7 for the two vision stages of T-26.** Non-negotiable.
  This is the canonical 4.7 demonstration.
- Sonnet 4.6 for: SQL migration, rasterizer wrapper, persistence,
  signed-URL helper, all UI components, all queries.
- Per-commit visual review at 1280px + 380px for every UI change.
  Vermilion 3-uses-per-screen ceiling holds (parcel highlight is
  use #3 on the source-proof modal — no other vermilion on that
  view).
- Smoke-test gate runs **before** any UI commit in T-26. The
  Phase A / Phase B split is non-negotiable.
- Cost ceiling $5 total. Smoke + 12-candidate sweep ≈ $1.30; UI
  work ~$0.10; trace view ~$0.05. Wide headroom.
- The demo override (`/demo`) and the auth path (`/briefing`)
  continue to share components and not Supabase clients. T-26's
  signed-URL fetch happens on both routes via the admin client
  (already imported on /demo, server-only).
