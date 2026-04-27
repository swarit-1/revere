# Revere

> Personal civic chief of staff. Runs overnight, reads the public
> record, filters through a civic fingerprint, verifies every claim
> against source, and delivers a morning briefing + draft replies.
> Never autosends.

Hackathon submission · Built with Claude Opus 4.7 · April 2026.


## What it does

The same public record means different things to different people.
Revere ingests every governing body that touches the user — city,
school district, county, state, federal — verifies each claim
against the original source, scores everything against the user's
civic fingerprint, composes a per-person briefing, pre-bakes three
adversarially-refined draft variants for items where action makes
sense, and (in election mode) shows races on the user's ballot with
verified candidate promises and a "Can they actually do that?"
authority classification.

Two demo personas — **Maya** (East Austin renter, parent, drives
I-35) and **Jason** (East Austin homeowner, runs a coffee shop on
East 6th, walks to work) — both live in the same district. They
get *different briefings*, with *different reasons*, *different
drafts*, and *different ballot orderings* for the same races.
That gap is the product.

## Trust surfaces

- **Source proof** — every briefing item has a one-tap modal showing
  the verifier's strongest supported claim, the verbatim source
  excerpt, the source_locator, and (for zoning items) the actual
  Staff Report PDF page rendered with the parcel highlighted in
  vermilion. Opus 4.7's 3.75MP vision pipeline finds the right page
  in 11.8 MB Staff Reports and draws the box in pixel coordinates.
- **"Why am I seeing this?"** — three hairline-divided sections
  (Ingestion · Verification · Why You) read straight from
  `agent_sessions`, the latest `verification_report`, and the
  per-user `briefing_items.score`. Per-section "View raw record ↗"
  toggles reveal the JSON.
- **Critique trail on every draft** — three voice variants (Direct ·
  Measured · Persuasive), each having survived a council staffer, an
  opposing constituent, and a press shop attacking it sequentially.
  Refiner's accept-vs-defend response is persisted alongside the
  final text.
- **"Can they actually do that?"** — every candidate promise on
  /ballot carries one of five authority tiers (`direct_authority`,
  `partial_authority`, `indirect_influence`, `outside_office_scope`,
  `too_vague_to_assess`) with a sourced rationale tying back to the
  office's charter. Non-judgmental — partial and indirect are common
  and not necessarily bad. It's a trust signal, not a verdict.
- **Conversational onboarding** — Opus 4.7 conducts a 10-14 turn
  interview that builds the user's civic fingerprint with hard
  guardrails (no precise address, no partisan reframing, no policy
  advice, Austin-only in v1). Tested by 4 scripted scenarios
  including house-number leakage, partisan reframing, and
  out-of-jurisdiction refusal.

## Screenshots

| Surface | Shot |
|---|---|
| Landing (newspaper masthead) | [`docs/verification/t-31-landing-1280.png`](docs/verification/t-31-landing-1280.png) |
| Briefing list (Jason) | [`docs/verification/t-31-briefing-jason-1280.png`](docs/verification/t-31-briefing-jason-1280.png) |
| Source-proof modal (parcel highlight on 26-1501) | [`docs/verification/t-31-modal-source-1280.png`](docs/verification/t-31-modal-source-1280.png) |
| Trace modal (Jason × 26-1501) | [`docs/verification/t-31-modal-trace-1280.png`](docs/verification/t-31-modal-trace-1280.png) |
| Draft modal (Jason × 26-1501, three variants) | [`docs/verification/t-31-modal-draft-1280.png`](docs/verification/t-31-modal-draft-1280.png) |
| Ballot — Maya (3 races) | [`docs/verification/t-37-ballot-maya.png`](docs/verification/t-37-ballot-maya.png) |
| Ballot — Jason (3 races, different ordering) | [`docs/verification/t-37-ballot-jason.png`](docs/verification/t-37-ballot-jason.png) |
| Email render (Maya morning briefing) | [`docs/verification/email-renders/maya-render.png`](docs/verification/email-renders/maya-render.png) |
| Demo cards | [hook](docs/verification/t-32-card-hook.png) · [two-people](docs/verification/t-32-card-two-people.png) · [closing](docs/verification/t-32-card-closing.png) |

## Layout

- `apps/web` — Next.js 16 frontend (target: Vercel)
- `apps/orchestrator` — Node + TS pipeline (CLI; long-lived runs)
- `packages/shared` — cross-workspace TypeScript types
- `packages/managed-agents` — Managed Agents configs (deferred — see
  Architecture)
- `.claude/skills/` — Austin-council, fingerprint, verification,
  drafting skill packs
- `docs/` — architecture, demo script, plans, verification gates
- `supabase/migrations/` — v1 → v5

## Getting started

```bash
corepack enable
pnpm install

# Frontend (port 3000)
cd apps/web && pnpm dev

# In another terminal, run the orchestrator pipeline
cd apps/orchestrator
pnpm ingest:austin --meeting-url <legistar-meeting-url>  # one-shot
pnpm verify --meeting <db_id>
pnpm match --user maya --briefing-date 2026-04-09
pnpm match --user jason --briefing-date 2026-04-09
pnpm compose --user maya --briefing-date 2026-04-09
pnpm compose --user jason --briefing-date 2026-04-09
pnpm extract:zoning --meeting <db_id>   # parcel highlight pre-bake
pnpm draft --candidate <id> --user maya
pnpm draft --candidate <id> --user jason

# Or run everything in one shot:
pnpm nightly --meeting 1
pnpm nightly --meeting 1 --email   # also send Resend morning email
```

Required env (root `.env.local`):

```
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://....supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=re_...           # optional, for `pnpm email`
EMAIL_FROM=Revere <onboarding@resend.dev>   # optional
APP_URL=http://localhost:3000   # optional
```

`apps/web/.env.local` adds `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DEMO_INBOX`, `CRON_SECRET`.

## Status checklist (PRD §20.11)

| Item | Status |
|---|---|
| T-04 Repo skeleton | ✓ |
| T-05–T-10 Skill packs | ✓ |
| T-11 Austin scraper | ✓ |
| T-12 Schema (v1–v6) | ✓ |
| T-13 Orchestrator | ✓ |
| T-15 Verification loop | ✓ |
| T-17 Fingerprint matcher | ✓ |
| T-18 Composer | ✓ |
| T-19 Nightly + Vercel cron | ✓ |
| T-21 Adversarial draft loop | ✓ |
| T-22 Draft variant UI | ✓ |
| T-23 Magic-link auth + RLS | ✓ |
| T-24 Resend morning email | ✓ (code complete; key needed for live send) |
| T-25 Briefing list + detail | ✓ |
| T-26 Parcel-highlight modal | ✓ |
| T-27 Trace modal | ✓ |
| T-28 Persona switcher | ✓ |
| T-29 Conversational onboarding (text) | ✓ (4/4 guardrail tests pass) |
| T-31 Motion + cinematic polish | ✓ |
| T-32 Pre-recorded demo video | ✓ |
| T-33 Three rehearsals ≤ 2:05 | ✓ |
| T-37 Election Briefing / Your Ballot | ✓ (3 races, 6 candidates, 30 promises seeded) |
| Multi-jurisdiction generalization | ✓ (city + school + state + scaffolds for county/federal) |
| README + submission blurb | ✓ |
| **Deferred** | |
| T-14 AISD + Texas-Lege live ingestion | skill packs + adapter scaffolds; election seed is fixture |
| T-29.5 Voice onboarding (Deepgram + ElevenLabs) | text fallback ships per PRD §24 R6 |
| T-30 User testimonials | out of agent scope |
| T-34 .docx ordinance redlines | stretch |
| T-35 Pixel-level chart transcription | stretch |
| T-37.5 Live election ingestion adapters | seed only |

## Design rationale

The PRD argues "trust is the product." The visual identity follows:
newspaper Newsreader serif, JetBrains Mono for data, hairlines (no
cards, no shadows), a strict three-uses-per-page vermilion ceiling.
The why_this string is rendered verbatim in mono next to every item
— that's the trust receipt, not editorial paraphrase. Modals follow
"prose first, JSON one click away" — three trust modals
(SourceProof, Trace, Draft), each with a "View raw record ↗"
toggle. No tabs, no accordion.

See [`docs/architecture.md`](docs/architecture.md) for the as-built
map and [`docs/demo-script.md`](docs/demo-script.md) for the
on-stage walk-through.

## References

- Product spec: [`revere-prd.md`](revere-prd.md)
- Working constitution: [`CLAUDE.md`](CLAUDE.md)
- Build plans: [`docs/plans/`](docs/plans/)
- Verification gates: [`docs/verification/`](docs/verification/)
