# Session 9 — Finalize: scheduler, email, demo video, docs

## Context

Eight sessions in, every demo-load-bearing surface is built: trust
surfaces (T-26 parcel highlight + T-27 trace), action flow (T-21
adversarial loop + T-22 draft modal), persona switching, the briefing
list, the verification trail. What's left is the connective tissue
that makes Revere look like a *product* on hackathon submission day,
not just a series of working modules: the nightly pipeline that proves
the "runs overnight" promise, the email that proves the "morning
briefing email" promise, the pre-recorded full-length demo video, and
the docs (architecture + demo script + README + submission blurb)
that judges read before they look at the code.

Voice onboarding (T-29) is the only PRD-named feature deferred to a
future update — it requires external vendor commitments (Deepgram +
ElevenLabs) that are out of scope for the hackathon submission. PRD
§24 R6 explicitly authorizes the text-fallback we already have via
seeded fingerprints; the demo script never shows onboarding.

## Divergences from PRD

| Divergence | PRD says | Session 9 ships | Why |
|---|---|---|---|
| Scheduler | "Claude Code Routine fires at 2am" (§12.2). Fallback: "Cloud Run Scheduled Job" (T-20). | Vercel cron declaration in `vercel.json` + a Next.js Route Handler at `/api/cron/nightly` that triggers the pipeline. The pipeline itself is `apps/orchestrator/src/nightly.ts` — a single CLI entry that runs ingest → verify → match → compose end-to-end. | Routines are research-preview and the demo can't depend on access. Vercel cron is in the same product family as our hosting (deployment story stays one-platform). The orchestrator stays CLI-callable so demo nights can run it locally. |
| Email path | "Morning email. 7am local. SendGrid/Resend. ~5-minute read." (§9.1) | Resend SDK + `apps/orchestrator/src/email/email.ts` CLI. Renders the briefing payload as HTML + plain-text. Sends to the persona's `DEMO_INBOX` so the demo shows a real email landing in a real inbox. | Resend is the sane modern default and it has a TS SDK. SendGrid is also fine; either way the abstraction is the rendering, not the vendor. |
| Demo cards | n/a — PRD §19.2 narrates beats but assumes the demo is recorded against the live UI | Three new Next.js routes: `/demo/hook` (Paul Revere quote), `/demo/two-people` (split-screen fingerprint summary), `/demo/closing` (closing card). Rendered with the same design tokens as the rest of the app — newspaper serif, hairlines, no chrome. | The bundled-flow videos so far (Sessions 6/7/8) capture mid-flow. The submission video needs the bookends. Building them as routes (rather than as static images composed in ffmpeg) keeps the visual language consistent and lets the demo fit in a single Playwright recording. |
| Pre-recorded demo | "2-minute video rendered the night before" (§19.3) | One Playwright session that walks the full 8-beat flow, narrated by hold-times not voice-over. Saved to `docs/verification/t-32-demo-2min.webm`. | The hackathon submission asks for a video; one continuous recording is honest about what runs live. Voice-over is post-production we don't have time for. |
| Demo rehearsal | "3 full dry-runs, timed, all under 2:05" (T-33) | Three back-to-back recordings, each timestamped + duration-checked. Two need to fit in 2:05. | The discipline matters more than the format — three recordings prove the timing is repeatable. |
| Architecture doc | Referenced in CLAUDE.md as `@docs/architecture.md` | Filled with: components diagram, module layout, data flow, the v1–v5 schema, model routing, cost story. | Empty file would surface as a broken reference whenever a future session loads CLAUDE.md. |
| Demo-script doc | Referenced in CLAUDE.md as `@docs/demo-script.md` | The on-stage delivery — beats, lines, hold-times, what's pre-baked vs live. | Same reason. |
| README | "GitHub repo public with clean README" (§20.11) | Upgraded with feature list, setup, screenshots, demo-video link, design rationale, status checklist. | Hackathon judges open the README before they `git clone`. |
| Submission blurb | "500 words, hook → demo → Opus 4.7 usage → roadmap" (§20.11) | `docs/submission-blurb.md`. | Required deliverable. |

## Pre-flight

1. Session 8 commits intact (T-21, T-22 × 2, video).
2. Supabase counts: meetings=1, candidate_items=56, verification_reports≥30, briefing_items=74, drafts=6, zoning_map_extractions=11. Confirmed via audit.
3. ANTHROPIC_API_KEY at root `.env.local`. Need to add `RESEND_API_KEY`.
4. Vercel project linked (or skip vercel.json deployment; ship the file regardless).

## Five gate moments

### Gate 1 — Architecture + demo-script docs

**Files shipped:**
- `docs/architecture.md` — fills the empty file. Sections: top-level flow,
  module-by-module breakdown (ingest, verify, match, compose, vision,
  draft, web), v1-v5 schema reference, model routing table, cost story,
  trust surfaces (parcel + trace + draft critique trail).
- `docs/demo-script.md` — fills the empty file. The 8-beat on-stage
  script with hold-times, what's live vs cached, the fallback if Wi-Fi
  fails, which URL the operator types to start each beat.

**Gate evidence:** both docs are non-empty; CLAUDE.md `@docs/...`
references resolve when a future Read pulls them.

**Commit:** `T-31: architecture + demo-script docs`

### Gate 2 — Nightly pipeline + Vercel cron declaration

**Files shipped:**
- `apps/orchestrator/src/nightly.ts` — runs the full pipeline:
  ingest → verify → match (per persona) → compose (per persona) →
  email (optional flag). Logs cost summary. Adds an `agent_sessions`
  row of runtime `nightly` that ties the whole run together.
- `apps/orchestrator/package.json` — `pnpm nightly` script.
- `apps/web/app/api/cron/nightly/route.ts` — Next.js Route Handler
  that authenticates via `Authorization: Bearer ${CRON_SECRET}`,
  checks the latest meeting in Supabase + writes an `agent_sessions`
  row with status=`triggered`. Deliberately does NOT invoke the
  orchestrator from the serverless function (Vercel functions are
  bounded; the orchestrator's pipeline is multi-minute). The
  orchestrator runs out-of-band; the cron route is the visible
  trigger surface.
- `vercel.json` — cron declaration: `{"crons":[{"path":"/api/cron/nightly","schedule":"0 7 * * *"}]}`.

**Gate evidence:**
- `pnpm nightly --meeting 1` runs end-to-end on the seeded meeting.
- The cron route returns `{ ok: true, triggered_at: ... }` when called
  with the right secret; 401 without.
- Saved to `docs/verification/t-19-nightly-gate.md`.

**Commit:** `T-19: nightly pipeline + Vercel cron declaration`

### Gate 3 — Morning email path

**Files shipped:**
- `apps/orchestrator/package.json` — `resend` dep added.
- `apps/orchestrator/src/email/render.ts` — pure-function HTML +
  plain-text rendering of a briefing payload. Subject: `Revere · Tue
  Apr 22 · 3 items for you`. Body: cover header + per-item snippet
  with deep links to `/briefing` (or `/demo?fp=maya` for the demo
  version).
- `apps/orchestrator/src/email/email.ts` — CLI: `pnpm email --user
  maya` sends Maya's latest briefing to `DEMO_INBOX`.
- `apps/orchestrator/src/email/persist.ts` — open/close
  `agent_sessions` row of runtime `emailer`.
- `.env.local` adds `RESEND_API_KEY` + `EMAIL_FROM`.

**Gate evidence:**
- A real email lands in `DEMO_INBOX` for both Maya and Jason. Same
  briefing data, different content per persona.
- Screenshot of the inbox in `docs/verification/t-24-email-gate.md`
  (or attached HTML if the inbox is not accessible — the rendered
  HTML on its own is acceptable evidence).

**Commit:** `T-24: morning briefing email path (Resend)`

### Gate 4 — Demo card routes + pre-recorded 2-minute video

**Files shipped:**
- `apps/web/app/demo/hook/page.tsx` — black background, serif white
  text. "Paul Revere rode through the night..."
- `apps/web/app/demo/two-people/page.tsx` — split-screen at
  `md:grid-cols-2`: Maya's fingerprint summary on the left, Jason's
  on the right. Photos avoided; uses initials + key fingerprint
  fields.
- `apps/web/app/demo/closing/page.tsx` — closing card. "Revere. Same
  public record. Different lives. Receipts on every claim."
- A Playwright recording script at `scripts/record-demo-2min.py`
  (already at `/tmp/revere-shots/...` per Sessions 6-8 — codified
  here as a checked-in script).

**Gate evidence:**
- `docs/verification/t-32-demo-2min.webm` saved at 1280×900, ~115-125s.
- Three rehearsal recordings saved to
  `docs/verification/t-33-rehearsal-{1,2,3}.webm`. Two of three must
  fit in ≤ 2:05.
- `docs/verification/t-32-demo-gate.md` with the timing table.

**Commit:** `T-32: pre-recorded 2-minute demo + rehearsal evidence`

### Gate 5 — README + submission blurb

**Files shipped:**
- `README.md` upgraded: feature list, screenshots, demo video link,
  setup, design rationale, status checklist (matches PRD §20.11
  done-criteria).
- `docs/submission-blurb.md` — 500 words for the hackathon
  submission form (hook → demo → Opus 4.7 use → Managed Agents use →
  roadmap).

**Gate evidence:** both files present; word count on submission blurb
≤ 500.

**Commit:** `T-33: README + submission blurb`

## Risks

1. **Resend signup gate.** Resend's API requires a verified sender domain.
   Mitigation: send from `onboarding@resend.dev` (Resend's free tier
   default sender) to a personal inbox. Production would use a verified
   `revere.<domain>` sender; the hackathon doesn't need that.
2. **Demo video drift past 2:05.** Hold-times in the recording script
   are tuned manually. If a recording lands at 2:08, trim hold-times
   in the trace modal and the closing card and re-record. The bundled
   videos from Sessions 6-8 have hold-times that pace ~28-55s; the
   2-min cut adds bookends and one more beat.
3. **Cron route in serverless wants to invoke the orchestrator.**
   Don't. The orchestrator is multi-minute; serverless will time out.
   The cron route logs the trigger; the actual run is `pnpm nightly`
   on a long-lived host (Cloud Run / a screen session).
4. **Email rendering hits a long Persuasive variant** that overflows
   inbox preview. Cap each item summary at 240 chars + "Read more ↗"
   in the email body.
5. **Architecture doc drifting from code.** Cite paths and table
   names directly so a `grep` against the doc will fail loudly when
   we rename things. Don't write English where a path will do.

## Cost ceiling

$2 total. Nightly pipeline running once on the seeded meeting reuses
the cached classifier + verifier work; it's mostly a cost-of-existing
re-validation. Email rendering is pure (no Anthropic calls). Demo
video is no calls. Plenty of headroom.

## Execute order

Each step ends with a commit. Halt on any gate failure.

1. **Pre-flight** — git log, Supabase counts, env keys. No commit.
2. **Gate 1** — architecture.md + demo-script.md. Commit.
3. **Gate 2** — nightly pipeline + cron route + vercel.json.
   Smoke-run `pnpm nightly --meeting 1 --skip-ingest` (we don't want
   to re-ingest the existing meeting; just exercise verify/match/compose).
   Commit.
4. **Gate 3** — Resend integration + email render + CLI. Send to
   DEMO_INBOX. Commit.
5. **Gate 4** — demo card routes (hook / two-people / closing).
   Pre-recorded 2-minute video script. Three rehearsal recordings.
   Commit.
6. **Gate 5** — README upgrade + submission blurb. Commit.

After step 6, halt. Demo is submission-ready.

## Out of scope (deferred to future update)

- T-29 voice onboarding (Deepgram + ElevenLabs).
- T-14 AISD + Texas-Lege orchestrators (skill packs exist; the demo
  doesn't need their data).
- T-30 user testimonials (out-of-band; needs human recruiting).
- T-34 .docx ordinance redlines (stretch).
- T-35 pixel-level chart transcription (stretch).
- T-37 election mode teaser (stretch).
- Production sender domain for email.
- Real Vercel deployment + linking.
