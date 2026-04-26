# Revere — Architecture

This is the as-built map of the system at the close of Session 9.
It cites file paths and table names so a future grep against this
doc fails loudly when we rename things. The PRD (`revere-prd.md`) is
the *intent*; this is what's actually wired.

## Top-level flow

```
                      ┌─────────────────────────┐
                      │ user (browser)          │
                      └──┬──────────────────────┘
                         │
       ┌─────────────────┼──────────────────────┐
       │ /briefing (auth)│ /demo?fp=...          │
       │                 │ (URL fallback, admin) │
       └─────────────────┴──────────────────────┘
                         │
           ┌─────────────┴───────────────┐
           │ apps/web (Next.js 16)       │
           │ • briefing list             │
           │ • SourceProofModal (T-26)   │
           │ • TraceModal (T-27)         │
           │ • DraftModal (T-22)         │
           │ • PersonaSwitcher (T-28)    │
           │ • /api/persona/switch       │
           │ • /api/cron/nightly (T-19)  │
           └─────────────┬───────────────┘
                         │ supabase-js (anon + service_role)
                         ▼
   ┌─────────────────────────────────────────────────────────┐
   │ Supabase (Postgres 17 + Storage)                        │
   │                                                          │
   │  v1: jurisdictions, meetings, candidate_items,          │
   │      agent_sessions                                      │
   │  v2: fingerprints, verification_reports,                │
   │      briefing_items, briefings                          │
   │  v3: RLS policies (auth + service-role)                 │
   │  v4: zoning_map_extractions + zoning-maps bucket        │
   │  v5: drafts                                              │
   └─────────────────────────────────────────────────────────┘
                         ▲
                         │ service_role
                         │
   ┌─────────────────────┴─────────────────────────────────────┐
   │ apps/orchestrator (Node + TS, CLI)                        │
   │                                                            │
   │  ingest/   → Legistar scrape + agenda PDF text            │
   │  lib/      → Anthropic SDK wrapper, fetch, supabase, pdf  │
   │  verify/   → per-claim verification (T-15)                │
   │  match/    → fingerprint scoring (T-17)                   │
   │  compose/  → per-persona briefing synthesis (T-18)        │
   │  vision/   → 2-stage Opus 4.7 parcel extraction (T-26)    │
   │  draft/    → adversarial loop (T-21)                      │
   │  email/    → Resend rendering + send (T-24)               │
   │  nightly.ts → end-to-end pipeline runner (T-19)           │
   └────────────────────────────────────────────────────────────┘
                         │
                         ▼
   ┌─────────────────────────────────────────┐
   │ Anthropic Messages API                  │
   │ • Opus 4.7 — vision, drafting, verify,  │
   │              compose, refine            │
   │ • Sonnet 4.6 — bulk verification        │
   │ • Haiku 4.5 — bulk classification       │
   └─────────────────────────────────────────┘
```

## Module map

### `apps/orchestrator/src/`

| Path | Purpose | Entry |
|---|---|---|
| `lib/anthropic.ts` | SDK wrapper, prompt-cache helpers, model constants `OPUS`, `SONNET`. | `invokeWithTool(...)` |
| `lib/supabase.ts` | service-role client; throws if env missing. | `supabase()` |
| `lib/fetch.ts` | `fetchText`, `fetchBuffer` with Chrome UA. | — |
| `lib/pdf.ts` | `extractPdfText(bytes)` via pdf-parse. | — |
| `ingest/legistar/` | Meeting + item scrapers. | — |
| `ingest/austin-council.ts` | One-meeting end-to-end ingester. | `pnpm ingest:austin` |
| `ingest/classify.ts` | Haiku 4.5 + Sonnet 4.6 escalation classification. | — |
| `verify/verifier-prompt.ts` | System prompt + emit_verification_report tool schema. | — |
| `verify/verify-item.ts` | Per-item Sonnet 4.6 call (Opus 4.7 escalation by config). | — |
| `verify/sources.ts` | Builds the sources_map for the verifier. | — |
| `verify/persist.ts` | Writes `verification_reports`. | — |
| `verify/verify.ts` | CLI entry: `--meeting <id>` or `--all-unverified`. | `pnpm verify` |
| `match/scoring.ts` | Pure scoring rubric — fingerprint × item → relevance_score. | — |
| `match/topic-vocabulary.ts` | Fingerprint-topic → taxonomy-category mapping. | — |
| `match/judgments.ts` | Synthesis-split + anti-priority resolution. | — |
| `match/match.ts` | CLI entry: writes `briefing_items`. | `pnpm match` |
| `compose/composer-prompt.ts` | Opus 4.7 system prompt + emit_briefing tool. | — |
| `compose/compose-briefing.ts` | Top-K per persona → headline + why_this synthesis. | — |
| `compose/compose.ts` | CLI entry: writes `briefings`. | `pnpm compose` |
| `vision/rasterize.ts` | `pdftoppm` shell-out. Renders all-pages thumbnails or one full-DPI page with byte-cap stepdown. | — |
| `vision/extract-parcel.ts` | Two-stage Opus 4.7 vision: page-detect (60 DPI thumbs) → parcel-localize (200 DPI page). | — |
| `vision/persist.ts` | Uploads to `zoning-maps` Supabase Storage; writes `zoning_map_extractions`. | — |
| `vision/extract.ts` | CLI: `--candidate <id>` or `--meeting <id>`. | `pnpm extract:zoning` |
| `draft/voices.ts` | Voice prompt bodies (direct/measured/persuasive). | — |
| `draft/critics.ts` | Three critic system prompts. | — |
| `draft/writer.ts` | Single Opus 4.7 call → 3 voice variants. | — |
| `draft/critic.ts` | Single critic pass → 3 critiques. | — |
| `draft/refiner.ts` | Single refiner pass → 3 refined variants + response. | — |
| `draft/loop.ts` | Orchestrates writer + 3 (critic, refiner) passes; 7 calls total. | — |
| `draft/persist.ts` | Writes `drafts`. | — |
| `draft/draft.ts` | CLI: `--candidate <id> --user <fp>`. | `pnpm draft` |
| `email/render.ts` | Pure HTML + text renderer for a briefing payload. | — |
| `email/email.ts` | CLI: `--user <fp>`. Sends via Resend. | `pnpm email` |
| `nightly.ts` | End-to-end runner: verify → match → compose → email. | `pnpm nightly` |

### `apps/web/`

| Path | Purpose |
|---|---|
| `app/page.tsx` | Marketing splash → sign-in CTA. |
| `app/auth/sign-in/page.tsx` | Magic-link form. |
| `app/auth/callback/route.ts` | Magic-link callback. |
| `app/onboarding-pending/page.tsx` | Holding page for users without `fingerprint_user_id` metadata. |
| `app/briefing/page.tsx` | Auth path. RLS-gated read; admin-client side-fetches for source-proof + trace + drafts. |
| `app/demo/page.tsx` | URL-fallback path. service_role; renders the same BriefingView. |
| `app/demo/hook/page.tsx` | Demo card 1 (Paul Revere quote). |
| `app/demo/two-people/page.tsx` | Demo card 2 (split-screen fingerprint summary). |
| `app/demo/closing/page.tsx` | Demo card 3 (closing tagline). |
| `app/api/persona/switch/route.ts` | POST: flip auth user's `app_metadata.fingerprint_user_id`. |
| `app/api/cron/nightly/route.ts` | Cron trigger (logs `agent_sessions` row; orchestrator runs out-of-band). |
| `src/components/briefing/CoverHeader.tsx` | "Revere · Tue Apr 9 · N items for you." Vermilion numerals (use 1 of 3). |
| `src/components/briefing/BriefingItem.tsx` | One item card. "See source ↗" / "Why am I seeing this? ↗" / "Draft a reply ↗" buttons. |
| `src/components/briefing/BriefingView.tsx` | Client wrapper. `OpenModal: 'source'\|'trace'\|'draft'\|null`. |
| `src/components/briefing/SourceProofModal.tsx` | T-26 modal. SVG `<image>` + bbox `<rect>` (vermilion fill). |
| `src/components/briefing/TraceModal.tsx` | T-27 modal. Three sections (Ingestion · Verification · Why You). |
| `src/components/briefing/DraftModal.tsx` | T-22 modal. Three-up at desktop, stacked at mobile. |
| `src/components/briefing/PersonaSwitcher.tsx` | T-28 footer toggle. |
| `src/lib/queries/briefing.ts` | `loadLatestBriefing`, `loadItemDetailWithAdmin`. |
| `src/lib/queries/zoning-extraction.ts` | `loadZoningExtractionWithAdmin` + signed URL minting. |
| `src/lib/queries/trace.ts` | `loadTraceWithAdmin` — joined query for the 3 sections. |
| `src/lib/queries/drafts.ts` | `loadDraftsWithAdmin` — 3 rows in voice order. |
| `src/lib/source-proof.ts` | `pickSourceProof` — picks the strongest claim from a verification_report. |
| `src/lib/supabase/{admin,server,browser}.ts` | Three Supabase clients with strict server-only / browser-only boundaries. |

### `packages/shared/src/types/`

| Type file | Mirrors |
|---|---|
| `item.ts` | `.claude/skills/jurisdictions/austin-city-council/output-schemas/item.json` |
| `verification-report.ts` | `.claude/skills/verification/output-schemas/verification-report.json` |
| `relevance-score.ts` | `.claude/skills/fingerprint/output-schemas/relevance-score.json` |
| `fingerprint.ts` | PRD §8.2 |
| `draft.ts` | `.claude/skills/drafting/output-schemas/draft-variant.json` |

### `.claude/skills/`

| Skill | Files |
|---|---|
| `jurisdictions/austin-city-council/` | `SKILL.md`, scrapers, taxonomy (6 topics), output-schemas. |
| `jurisdictions/aisd/` | Stub `SKILL.md`. Orchestrator code deferred. |
| `jurisdictions/texas-lege/` | Stub `SKILL.md`. Orchestrator code deferred. |
| `verification/` | `SKILL.md`, `verifier-prompt.md`, `claim-typology.md`, `degradation-policy.md`, `synthesis-split.md`. |
| `fingerprint/` | `SKILL.md`, scoring-rubric, voice-resolver, anti-priority-policy, synthesis-resolver, validation-policy. |
| `drafting/` | `SKILL.md`, `loop-protocol.md`, `voice-styles/{direct,measured,persuasive}.md`, `output-schemas/draft-variant.json`. |

## Schema (cumulative v1 → v5)

### v1 — `20260425230045_v1_ingestion_tables.sql`

`jurisdictions`, `meetings`, `candidate_items`, `agent_sessions`. RLS
enabled, no policies (service-role-only).

### v2 — `20260426034027_v2_pipeline_tables.sql`

`fingerprints`, `verification_reports`, `briefing_items`, `briefings`.

### v3 — `20260426112824_v3_rls_policies.sql`

Authenticated SELECT policies on `fingerprints`, `briefing_items`,
`briefings`. Gated by `auth.jwt() -> 'app_metadata' ->>
'fingerprint_user_id'`. `candidate_items`, `verification_reports`,
`agent_sessions` stay service-role-only — the auth path side-fetches
them via the admin client per item to render the modals.

### v4 — `20260426123320_v4_zoning_extractions.sql`

`zoning_map_extractions` + `zoning-maps` Supabase Storage bucket
(service_role only, signed URLs minted server-side at 24h TTL).

### v5 — `20260426150000_v5_drafts.sql`

`drafts`. Three rows per draft request — one per voice. Service-role
only.

### v6 — `20260426170000_v6_elections.sql`

Multi-jurisdiction + election expansion (Session 10).

- New tables: `election_races`, `candidates`, `candidate_promises`.
  All RLS-enabled, service-role-only — same posture as
  `candidate_items` / `verification_reports`.
- `jurisdictions.level` + `.state` columns; seeded `travis-county`
  and `us-congress` rows so the abstraction surface matches the
  product framing.
- `briefings.mode` discriminator (`'governance'` | `'election'` |
  `'mixed'`, default `'governance'`).
- `briefing_items` generalization: new `record_kind` + `entity_type`
  + `entity_id` columns. Existing rows default to
  `record_kind='governance'` (FK still on `candidate_item_id`).
  Election rows reference races, candidates, or promises by string
  id; `candidate_item_id` and `verification_report_id` are nullable
  for those rows. A check constraint enforces shape per
  `record_kind`.
- `agent_sessions` tightening: `subject_type`, `subject_id`,
  `user_id`, `briefing_date` columns for multi-jurisdiction
  trace scoping.

## Model routing

| Workload | Model | Notes |
|---|---|---|
| Item classification (bulk) | Haiku 4.5 | Cheap; escalates to Sonnet on ambiguous topic. |
| First-pass summary | Sonnet 4.6 | — |
| Per-claim verification | Sonnet 4.6 | PRD §15 names Opus; CLAUDE.md "cheapest model that clears the bar" wins. Quality-tested in T-15 gate. |
| Vision page-detect (zoning map) | Opus 4.7 | T-26 — 60 DPI thumbnails + tool_use schema. |
| Vision parcel-localize | Opus 4.7 | T-26 — 200 DPI page (with byte-cap stepdown), pixel-coordinate bbox output. |
| Briefing synthesis | Opus 4.7 | T-18. |
| Drafting writer | Opus 4.7 | T-21 — 3 voice variants in one tool_use. |
| Drafting critics | Opus 4.7 | T-21 — three personas, sequential. |
| Drafting refiner | Opus 4.7 | T-21 — preserves voice register; emits accept/defend response. |

## Cost story (per-meeting reference run, 56 candidate_items)

| Step | Approx cost |
|---|---|
| Ingest (no model calls) | $0 |
| Classification (Haiku) | $0.05 |
| Verification (Sonnet, 56 items) | $1.20 |
| Vision extraction (Opus, 11 zoning items) | $1.40 |
| Matching (pure code, no model) | $0 |
| Composition (Opus, 2 personas) | $0.40 |
| Per-draft loop (Opus, 7 calls) | $0.55 |
| Email (no model) | $0 |
| **Per-meeting total** | **~$3.50** |

## Trust surfaces

The PRD's "trust is the product" thesis lands on five concrete
surfaces (in order of demo prominence):

1. **Source-proof modal (T-26)** — every briefing item has a
   one-tap source-proof. For zoning items, the modal renders the
   actual Staff Report PDF page with the parcel highlighted in
   vermilion. The vision pipeline runs at ingestion time
   (rasterize-once) and persists `bbox + page_image_path` so the
   modal renders instantly.
2. **Trace modal (T-27)** — three hairline-divided sections
   (Ingestion · Verification · Why You). Reads from
   `agent_sessions`, the latest `verification_report`, and
   `briefing_items.score`. Per-section "View raw record ↗" toggles
   reveal the JSON.
3. **Draft critique trail (T-21/T-22)** — every draft variant carries
   a `critique_trail` of 3 entries (council_staffer ·
   opposing_constituent · press_shop), each with severity-tagged
   issues + the refiner's accept-vs-defend response. The DraftModal
   surfaces this under a "What the critics caught ↗" toggle.
4. **Authority classification on every promise (T-37)** — five-tier
   `direct_authority` / `partial_authority` / `indirect_influence`
   / `outside_office_scope` / `too_vague_to_assess`, each with a
   sourced rationale tying back to the office's charter. Reframes
   "what they said" as "what they can do." Non-judgmental — partial
   and indirect are common, not necessarily bad.
5. **Conversational onboarding (T-29)** — the fingerprint is built
   through a 10-14 turn Opus 4.7 interview with hard guardrails:
   no precise address, no partisan reframing, no policy advice,
   non-Austin refusal. Server-side replicates the guardrails on
   /api/onboarding/finalize.

All five follow the same editorial principle: **prose first, JSON
one click away**. No tabs, no accordion, no dashboards.

## Visual identity

- **Typography**: Newsreader serif (headlines, body), JetBrains Mono
  (data: why_this, severity tags, source_locator, raw JSON).
- **Color**: Cream background (`#f7f3ec`), ink text (`#1a1a1a`),
  district sage (`#7a8a6e`) for labels, whisper (`#e0d8c8`) for
  hairlines, vermilion (`#c8331f`) for the three high-attention uses
  per page.
- **Vermilion ceiling**: at most three vermilion uses per view —
  cover header numerals, "see source"/"why am I seeing this?" link
  underlines, and the parcel-highlight rectangle. The trace modal
  uses two (link underlines only). The draft modal uses two (link
  underlines + critique toggle).
- **No cards**: hairlines separate sections. Background never
  changes within a view.

## Observable run-state

- `agent_sessions` is the operator's single source of truth. Every
  CLI entry point (`ingest:austin`, `verify`, `match`, `compose`,
  `extract:zoning`, `draft`, `email`, `nightly`) opens a row with
  `runtime` + `started_at`, closes with `status` + `notes` carrying
  the cost summary.
- The trace modal reads from this directly, so the audit trail and
  the user-facing trust surface are the same artifact.

## What's deferred

- T-29 voice onboarding (Deepgram + ElevenLabs).
- T-14 AISD + Texas-Lege orchestrators (skill packs exist; demo
  doesn't show their data).
- T-30 user testimonials (out-of-band; needs human recruiting).
- T-34 .docx ordinance redlines (stretch).
- T-35 pixel-level chart transcription (stretch).
- T-37 election mode teaser (stretch).
- Real Vercel deployment + linking (vercel.json declared, not
  deployed).
- Production sender domain for email (using Resend's free-tier
  default sender).
