# Session 8 — Action flow: T-21 + T-22

## Context

Sessions 1–7 built the read path. Session 8 turns Revere from a
read-only briefing into a *responder*: when an item warrants action,
the user can tap "Draft a reply" and Revere returns three variants —
Direct, Measured, Persuasive — each having survived a sequential
adversarial loop (council staffer → opposing constituent → press
shop). Never autosends; the final action is a clipboard + mailto
handoff. PRD §10 + §11.2 are the constitution.

This is the demo's 1:35–1:55 beat (PRD §19.2). With T-26 + T-27
landed, the trust surfaces cover "why this item, why these claims."
T-21 + T-22 cover "what could I say, and what's wrong with each
version."

## Divergences from PRD

All locked before execution.

| Divergence | PRD says | Session 8 ships | Why |
|---|---|---|---|
| Loop topology | "writer → adversary → refiner, three iterations" (§11.2). Implies 3 separate writer-critic-refiner chains, one per voice. | **Single chain, three-voice payload**: writer emits all 3 voices in one tool_use. Each critic + refiner pass also handles all 3 voices in one tool_use. Total 7 Opus 4.7 calls per (item, persona). | Keeps cost predictable (~$0.50 per draft request) without giving up the sequential semantics — critic passes still compound across the chain, the model just sees 3 drafts at a time. |
| Voice triple | "Direct, Measured, Persuasive" (§10.3) | Same names, fixed across all users. The fingerprint's voice tag (`measured`/`direct`/`warm` from the fingerprint skill) is **not** the same as the variant register — variants are output flavors the user picks from. | The fingerprint voice is a longitudinal preference (one tag per user). The three variants are a one-time exploration of the option space, presented at draft time. Conflating them destroys the "pick the one that fits this moment" experience. |
| Critique surface | "User sees all three variants side-by-side with inline annotations showing what the critics caught" (§10.4) | Persisted: each variant carries a `critique_trail` array (one entry per critic pass). UI default: critic notes collapsed under a "What the critics caught ↗" toggle per variant. | Three columns of full draft + 3 critic notes each = wall of text at 1280px. Toggle is the trace-modal-tested editorial pattern (prose first, raw one click away). Trust-surface continuity. |
| Submission channel | "mailto: link prefilled, or open-in-new-tab to the city's comment form" (§10.4) | v1: clipboard copy + an "Open council@austintexas.gov ↗" mailto link. The actual public-comment form requires a separate flow we don't ship in v1. | Public comment forms vary per item type (council vs board vs hearing). Email-the-council as the default channel covers the bulk of cases; a second channel selector is T-22.5. |
| Pre-baked drafts | n/a | Drafts for **both** Maya and Jason on **26-1501** are computed at session 8 build time (CLI: `extract:draft`) and persisted. Demo-time clicks render instantly from Supabase. | Live generation is a 10–20s round trip with 7 Opus calls. The demo can't tolerate that. The pipeline still supports live generation; the demo just doesn't hit it. |
| `drafts` table shape | "drafts — generated response drafts; one row per (briefing_item, user, variant)" (§12.4) | Columns: `id`, `candidate_item_id`, `user_id`, `voice`, `final_text`, `critique_trail JSONB`, `writer_version`, `loop_version`, `generated_at`, `cost_tokens JSONB`. service-role only RLS. | Closer to the verification_reports + briefing_items shape — the JSONB carries the full structured trail; shadow columns are kept minimal. |
| Critic personas | "council staffer / opposing constituent / press shop" (§10.3) | Same three personas. Prompts live in `apps/orchestrator/src/draft/critics.ts`. Each emits a structured `Critique` (issues found + severity + suggested rewrites). | Aligns with PRD §26.3. |
| Skill pack location | PRD §17 specifies `/skills/drafting/voice-styles/{measured,direct,persuasive}.md` | Same paths. New: `voice-styles/persuasive.md`, `loop-protocol.md`, `output-schemas/draft-variant.json`. | Wires into the existing drafting skill that already has `SKILL.md` + the voice tags from the fingerprint resolver. |

## v5 migration

```sql
-- Session 8 / T-21: drafts table.
-- One row per (candidate_item_id, user_id, voice). Three rows per draft
-- request. service_role bypasses RLS by design (matches verification_reports
-- and briefing_items in v1; per-user read paths land alongside T-23 follow-up).

create table public.drafts (
  id bigserial primary key,
  candidate_item_id bigint not null references public.candidate_items(id),
  user_id text not null references public.fingerprints(user_id),
  voice text not null,                    -- 'direct' | 'measured' | 'persuasive'
  final_text text not null,
  critique_trail jsonb not null,          -- per-pass critique + remediation
  writer_version text not null,           -- 'v1'
  loop_version text not null,             -- 'v1'
  cost_tokens jsonb,                      -- {input, output, cache_read, cache_create}
  generated_at timestamptz not null default now(),
  unique (candidate_item_id, user_id, voice, loop_version)
);
alter table public.drafts enable row level security;
create index idx_drafts_user_item on public.drafts (user_id, candidate_item_id);
```

## Pre-flight

1. Session 7 commits intact (T-26 Phase A, Phase B, T-27, video).
2. Supabase counts: briefings=2, briefing_items=74, agent_sessions ≥ 23,
   zoning_map_extractions = 11.
3. ANTHROPIC_API_KEY + Supabase keys at root `.env.local`.
4. Fingerprints for `maya` and `jason` exist (already verified in T-17).

## Two gate moments

### T-21 — adversarial refinement loop

**Files shipped:**
- `supabase/migrations/2026...._v5_drafts.sql` (above).
- `.claude/skills/drafting/loop-protocol.md` — sequential chain rules.
- `.claude/skills/drafting/voice-styles/{measured,direct,persuasive}.md` —
  one paragraph per voice describing register, sentence shape, hedging
  policy, ask formulation.
- `.claude/skills/drafting/output-schemas/draft-variant.json` — JSON
  schema for what the writer/refiner emit.
- `packages/shared/src/types/draft.ts` — TS mirror of the schema.
- `apps/orchestrator/src/draft/voices.ts` — voice prompt bodies (3
  paragraphs).
- `apps/orchestrator/src/draft/critics.ts` — three critic system
  prompts.
- `apps/orchestrator/src/draft/writer.ts` — single Opus 4.7 call that
  emits all 3 voice variants (one tool_use with array of length 3).
- `apps/orchestrator/src/draft/refiner.ts` — single Opus 4.7 call that
  takes the prior 3 variants + a Critique array and emits 3 refined
  variants.
- `apps/orchestrator/src/draft/loop.ts` — orchestrate writer + 3
  (critic + refiner) sequential passes.
- `apps/orchestrator/src/draft/persist.ts` — write 3 rows to drafts
  per request.
- `apps/orchestrator/src/draft/draft.ts` — entry point CLI:
  `extract:draft --candidate <id> --user <maya|jason>`.
- `apps/orchestrator/package.json` — adds `extract:draft` script.

**Smoke gate:**
- Run `extract:draft --candidate 61 --user jason`. Inspect the 3 rows.
  Each variant must:
  1. Reference Legistar item 26-1501 by id.
  2. Tie back to a Jason-specific stake (small business / commercial
     zoning / TABC).
  3. Differ in register from the others — not a paraphrase.
  4. Have a 3-entry `critique_trail` (staffer / constituent / press
     shop, in that order), each entry naming at least one specific
     issue and a `remediation` field.
  5. Be ≤ 360 words (the public-comment cap from drafting SKILL.md).

If any of the above fails on Jason × 26-1501, halt and re-prompt.
Re-run before any commit.

**Persisted seed:**
- Run for Maya × 26-1501 too. 6 rows total in drafts table.

**Cost budget:**
- 7 Opus calls per draft × 2 personas ≈ 14 Opus calls × ~6K input + ~1.5K
  output tokens each. ~$1.20 total. Plus dev iteration. Cap: $3.

**Gate evidence:**
- `docs/verification/t-21-loop-gate.md` with the 3 rendered variants
  for both personas, the critique_trail summary, the cost row, and a
  "voice contrast" check (Direct sentence count vs Measured vs
  Persuasive — they should obviously differ).

**Commit:** `T-21: adversarial refinement loop produces three variants per persona`

### T-22 — draft variant UI

**Files shipped:**
- `apps/web/src/lib/queries/drafts.ts` — admin-client load drafts for
  (user_id, candidate_item_id), returns 3 rows in a stable voice order.
- `apps/web/src/components/briefing/DraftModal.tsx` — three-up modal
  layout. Each variant shows: voice label, draft text in a serif body
  block, mailto button with prefilled subject + body, "What the
  critics caught ↗" toggle (collapsed by default) revealing the
  3-entry critique_trail in mono.
- `apps/web/src/components/briefing/BriefingItem.tsx` — adds
  "Draft a reply ↗" button next to "See source ↗" and
  "Why am I seeing this? ↗".
- `apps/web/src/components/briefing/BriefingView.tsx` — extends
  OpenModal discriminator to `'source'|'trace'|'draft'|null`.
- `apps/web/app/briefing/page.tsx` + `apps/web/app/demo/page.tsx` —
  pre-fetch drafts in the same Promise.all hop as zoning extractions
  + traces.

**Modal layout:**
- Desktop ≥ 768px: three columns side-by-side, hairline-divided,
  fixed minimum modal width 1080px so each column gets 320px+ of
  prose width. Outer modal scrolls vertically; columns scroll
  independently if any one variant overflows.
- Mobile < 768px: stacked, voice label as a sticky section header.
- Per variant: voice tag (district sage uppercase) → headline serif
  ("Direct" / "Measured" / "Persuasive") → body text in serif → CTA
  row (mailto button + clipboard button + critique toggle).

**Submission channel:**
- mailto button with `Subject: District 3 constituent — Item 26-1501`
  and the variant text as body. Closes the modal after click; user
  edits + sends in their mail client. We never see the send.
- Clipboard button copies just the body text — for users pasting
  into the city's public-comment form themselves.

**Gate evidence:**
- 1280px screenshot showing all three variants for Jason on 26-1501,
  one with the critique toggle expanded.
- 380px mobile screenshot showing stacked variants.
- Side-by-side compare: Maya vs Jason on 26-1501 — different stake
  paragraphs even though item is identical.
- `docs/verification/t-22-draft-ui-gate.md` inline.

**Commit:** `T-22: draft modal — three variants with critic annotations`

### Bundled-flow update (final video)

Re-record the demo flow including the action-flow beat. New flow
(~55s):

1. Land on Maya's briefing.
2. Click 26-1501 → source-proof modal with parcel highlight. Hold.
3. Close. Click "Why am I seeing this?" → trace modal.
4. Toggle "View raw report ↗".
5. Close. Switch to Jason.
6. On Jason's 26-1501, click "Draft a reply ↗" → 3-variant modal.
7. Hold on the three variants for visual punch.
8. Toggle "What the critics caught ↗" on the Direct variant.
9. Close. End.

Save to `docs/verification/t-22-bundled-flow-with-action.webm`.

**Commit:** `T-22: bundled-flow video with action-flow beat`

## Risk register

1. **Voice variants collapse to paraphrases of each other.** If Opus
   produces three essentially-identical drafts, the demo's load-bearing
   moment falls flat. Mitigation: voice prompts in `voices.ts` enforce
   distinctly different sentence structure (Direct: ≤ 12-word
   sentences, no hedging; Measured: balanced clauses, hedge once;
   Persuasive: lead with personal stake, one rhetorical device). The
   gate explicitly checks for register contrast.
2. **Critic finds nothing wrong.** A critic that approves the draft
   produces an empty `issues` array, breaking the "annotations" UX.
   Mitigation: each critic prompt requires at least one issue; if the
   draft is genuinely strong, the critic returns `severity: low`
   issues with a remediation note, not an empty array.
3. **Refiner overcorrects on weak critiques.** PRD §10.3 explicitly
   says "accepting valid critiques, defending against weak ones."
   Mitigation: the refiner prompt instructs it to weigh critique
   severity + tag each variant's response.
4. **Draft cites unverified claim.** SKILL.md hard rule: "Never
   generate a draft that makes a factual claim the verification skill
   hasn't cleared." Mitigation: writer prompt receives the verified
   claims explicitly + is told to draw stakes only from them.
5. **mailto opens with broken body.** Long URL-encoded bodies can
   blow past mail-client URL caps (~2048 chars). Mitigation: clamp
   each variant to ≤ 360 words ≈ 2200 chars; trim trailing newlines
   in the mailto encode.
6. **Modal layout breaks at 768px.** Three columns is fragile.
   Mitigation: switch to stacked at < 768px (Tailwind `md:` breakpoint
   on the grid).

## Cost ceiling

$3 total. Smoke + 2-persona seed ~$1.20. Dev iteration ~$1.

## Execute order

1. T-21 — v5 migration; skill pack files; orchestrator draft modules;
   smoke run on Jason × 26-1501; eyeball check; if pass, run for Maya
   too. Save `t-21-loop-gate.md`. Commit.
2. T-22 — query helper; DraftModal component; BriefingItem button;
   modal-state extension; pre-fetch wiring; capture screenshots;
   save `t-22-draft-ui-gate.md`. Commit.
3. Bundled video update with action-flow beat. Save
   `t-22-bundled-flow-with-action.webm`. Commit.

After step 3, halt. Do NOT touch T-19 (Routine), T-24 (email),
T-29 (voice onboarding), T-30 (recruit), T-32 (pre-recorded demo),
T-33 (rehearsal).
