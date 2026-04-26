# Revere — Demo Readiness Audit

Read-only audit performed in a single session against `main` as of
commit `1014e41`. No code changes were made; no commits other than
this document. Findings are flagged P0 (demo-blocker), P1 (visible
flaw), P2 (polish), or P3 (nice-to-have). Each finding has a
specific location and a proposed remedy that is **not** implemented
here — those decisions are for follow-up sessions with human review.

Scope: PRD (full), `.claude/` skills, `apps/`, `packages/shared/`,
`supabase/migrations/`, every plan in `docs/plans/`, every gate
artifact in `docs/verification/`, and live-state queries against
the Supabase project.

---

## Section 1 — Inventory verification

### Setup tasks

| ID | State | Evidence | Discrepancy |
|---|---|---|---|
| T-01 hackathon registration | not-tracked-in-code | operational | n/a |
| T-02 research-preview applications | not-tracked-in-code | operational; Outcomes/Memory/multi-agent applications not visible in repo | PRD §14 names Outcomes-graded grader; T-16 fallback used (see below) |
| T-03 services authenticated | shipped-partial | `.env.local` files exist locally; Supabase project + Anthropic key live | **No Vercel deployment** (no `.vercel/` dir, no project link). PRD §12.6 names Vercel as the deploy target. |
| T-04 repo skeleton | shipped | first commits, current layout matches PRD §12.1 | none |

### Skill authoring

| ID | State | Evidence | Discrepancy |
|---|---|---|---|
| T-05 austin-city-council SKILL.md | shipped | `31b1250 T-05`, `985165b T-06`; `docs/verification/t-05-routing.md` | none |
| T-06 austin taxonomy + schemas | shipped | `docs/verification/t-06-classification.md` | none |
| T-07 AISD + Texas-Lege skill packs | shipped-partial | `.claude/skills/jurisdictions/aisd/SKILL.md` + `texas-lege/SKILL.md` are stubs; no taxonomy/scrapers/output-schemas under either folder | PRD §17 prescribes parallel structure to `austin-city-council/`. Stubs only — fine for the demo since neither jurisdiction is rendered live, but flag as known. |
| T-08 verification SKILL.md | shipped | `e7d8261…ce07dc8`; `t-08-verification-gate.md` | none |
| T-09 fingerprint SKILL.md | shipped | `e7b0ff7…a141676`; `t-09-routing.md`, `t-09-scoring-fixtures.md` | none |
| T-10 drafting SKILL.md | shipped | committed alongside T-21 voice files (Session 8) | none |

### Ingestion + verification

| ID | State | Evidence | Discrepancy |
|---|---|---|---|
| T-11 Austin scraper | shipped | `2e4f23c T-11`; meeting + agenda PDF + 56 candidate items in DB | YouTube/yt-dlp caption pipeline NOT wired in code (PRD §16.1 names it). `meetings.video_url` and `raw_transcript` are NULL for the seeded meeting. Demo doesn't show video, so behavior is consistent with PRD §19.4 cached posture. |
| T-12 schema | shipped | v1–v6 migrations applied; row counts in §1.x below | T-12 named `users` + `feedback_events` tables; neither migrated. Not blocking. |
| T-13 austin-council orchestrator | shipped | `4e1cde0 T-13`; agent_sessions of runtime=`orchestrator` | ships as a Node CLI + Anthropic Messages API, not as a Managed Agents session. PRD §12.3 always allowed this (Messages API is the synthesis/drafting layer); §14.4's "versioned per-jurisdiction Managed Agents" is not literally implemented. **Branding implication for §1.x.** |
| T-14 AISD + Texas-Lege orchestrators | NOT shipped | n/a | PRD §20.4 critical-path-parallel; deferred. Demo is Austin-only on the briefing surface. T-37 ballot mode covers AISD + Texas House via fixture data. |
| T-15 verification loop | shipped | `d0d4dc2 T-15`; `t-15-loop-gate.md`; 37 verification_reports rows | Sonnet 4.6, not Opus 4.7 with `effort: xhigh` per PRD §15. Documented in commit + gate doc; PRD §15 still names Opus as primary. |
| T-16 outcomes-graded grader | shipped-partial | no Managed Agents Outcomes call; verification rollup serves as the grader | matches PRD §14.1 + §24 R3 fallback ("equivalent grader as a separate Messages API call"). |
| T-17 matcher | shipped | `4051161 T-17`; 74 governance + 66 election briefing_items rows | none |
| T-18 composer | shipped | `55abb8d T-18`; 2 briefings (Maya 5 items, Jason 4 items) | none |

### Scheduling + automation

| ID | State | Evidence | Discrepancy |
|---|---|---|---|
| T-19 Claude Code Routine | shipped-partial | `1f5f6c0 T-19`; `vercel.json` cron declaration; `apps/orchestrator/src/nightly.ts` runner | **No Claude Code Routine.** PRD §12.2 names Routines specifically. Implemented as Vercel cron + out-of-band orchestrator runs per PRD §24 R4 fallback. **Vercel cron will not fire because the project is not deployed.** |
| T-20 fallback scheduler | shipped-partial | nightly.ts is the fallback | no Cloud Run job; running locally is the only path |

### Action flow

| ID | State | Evidence | Discrepancy |
|---|---|---|---|
| T-21 adversarial loop | shipped | `9d96831 T-21`; `t-21-loop-gate.md`; 6 drafts (3 voices × 2 personas) on candidate 61 | none |
| T-22 draft variant UI | shipped | `bf68618 T-22`; `t-22-draft-ui-gate.md`; mailto + clipboard handoff present | none |

### User-facing surfaces

| ID | State | Evidence | Discrepancy |
|---|---|---|---|
| T-23 magic-link auth | shipped | `1c6feed T-23`; `t-23-auth-gate.md`; v3 RLS policies | **callback URL whitelist** must include both `localhost:3000` and any Vercel preview URL — not verifiable from code. Operational. |
| T-24 morning email | shipped-partial | `ab10de0 T-24`; `t-24-email-gate.md`; renderer + CLI + static HTML evidence | **No live send.** `RESEND_API_KEY` not set. PRD §9.1 frames as a real morning email. |
| T-25 briefing list + detail | shipped | `289d640 T-25`; `t-25-briefing-ui-gate.md` | none |
| T-26 source-proof + parcel highlight | shipped | `f4d4bed`+`288ee07`; `t-26-source-proof-gate.md`; 11 zoning_map_extractions, 26-1501 bbox=(825,845,50,70), confidence=high | none |
| T-27 trace modal | shipped | `c0db767 T-27`; `t-27-trace-gate.md` | trace shows orchestrator + verifier + vision-extractor + matcher + composer (5 sessions). PRD §19.2 beat 1:15–1:35 says "**three** Managed Agents sessions — Austin Council, AISD, Texas Lege — in parallel." Trace shows one jurisdiction. **Demo script (docs/demo-script.md) reconciles to "five Managed-Agents sessions, all logged."** PRD wording remains as-was. See P1 below. |
| T-28 persona switcher | shipped | `31a12e4 T-28`; `t-28-persona-switcher-gate.md` | works via auth-metadata refresh; URL fallback at `/demo?fp=...` exercised in demo recording. |
| T-29 conversational onboarding | shipped-partial (text only) | `aeb5187 T-29`; `t-29-onboarding-gate.md`; 4/4 guardrail scenarios pass | **Voice modality (Deepgram + ElevenLabs) deferred** per PRD §24 R6 fallback. PRD §19 demo doesn't show onboarding, so non-blocking on stage. |

### Polish + recruit + rehearse

| ID | State | Evidence | Discrepancy |
|---|---|---|---|
| T-30 Austinite testimonials | NOT shipped | no testimonial files in repo | PRD §22 + §23 (Impact rubric) names this. **Out of agent scope.** Operational. |
| T-31 visual polish | shipped | `f887364 T-31`; `t-31-redesign-gate.md`; Framer Motion + grain + reveal cascades | none |
| T-32 pre-recorded demo video | shipped | `65cb175 T-32`; `t-32-demo-gate.md`; `t-32-demo-2min.webm` (11.2 MB, 2:00) | **WebM only**; no mp4. PRD §32 names "1080p+" — Playwright records at 1280×900. See P0 below. |
| T-33 demo rehearsals ≤ 2:05 | shipped | three rehearsal recordings, all 2:00 ± 0.6s | rehearsals captured the redesigned visuals (Session 9), not the elections expansion (Session 10). Recordings predate `/ballot`. Action-flow beat shows draft modal but does not navigate to /ballot. |

### Beyond-PRD additions

| ID | State | Evidence | Notes |
|---|---|---|---|
| Session 10 multi-jurisdiction generalization | shipped | `89a3ec4`; `t-37-ballot-gate.md` | adds GovernmentLevel, RecordKind, BriefingMode, election entities, geography label builder, deriveConfidenceTier. v6 migration. **Pre-existing demo flow unchanged — demo recording does not visit /ballot.** |
| T-37 Election Briefing / Your Ballot | shipped (fixture-backed) | `1014e41 T-37`; 3 races, 6 candidates, 30 promises | promises are clearly-marked fixture data with `example.test` URLs. **Not in current 2-minute demo recording.** |

### Live-state row counts

```
jurisdictions:           5
meetings:                1
candidate_items:         56   (26-1501 = id 61, district 3 ✓)
agent_sessions:          38   (governance + email + cron + election runs)
verification_reports:    37
briefing_items:          140  (74 governance + 66 election)
briefings:               2    (Maya: 5 items, Jason: 4 items, both 2026-04-09)
drafts:                  6    (3 voices × 2 personas, all on candidate 61)
zoning_map_extractions:  11   (page 8, bbox high confidence on 26-1501)
fingerprints:            2    (maya, jason; both have full priorities)
election_races:          3    (austin-d3-2026, aisd-trustee-d2-2026, txhd-51-2026)
candidates:              6
candidate_promises:      30
```

Working tree is clean (`git diff main HEAD` empty).

---

## Section 2 — Demo-flow walk-through (PRD §19.2)

Walks each beat as a judge would experience it via the canonical
`/demo/hook → /demo/two-people → /demo?fp=maya → /demo?fp=jason →
/demo/closing` path on a localhost dev server (the only path
currently working — see Section 5).

### Beat 0:00 – 0:10 — Hook

- **What renders.** `/demo/hook`. Black-on-cream Newsreader serif:
  "Paul Revere rode through the night so sleeping citizens would
  know what was coming." Word-by-word reveal cascade, vermilion
  "2026" pulse, lantern halo top-right, vignette. Brand lockup
  bottom: "This is Revere."
- **Code path.** `apps/web/app/demo/hook/page.tsx` — static; no data
  load. Animations are pure CSS keyframes from `tailwind.config.ts`
  (`word-reveal`, `lantern-pulse`, `draw-rule`).
- **Risk.** Fonts (Source Serif 4, Public Sans, JetBrains Mono) come
  from Google Fonts via `next/font`. First-load on a cold projector
  could fall back to system serif for ~200ms — not a real risk.
- **Evidence parity.** `t-32-card-hook.png` matches what would render.

### Beat 0:10 – 0:20 — The two people

- **What renders.** `/demo/two-people`. Split-screen Maya | Jason
  fingerprint summaries. Slide-in-from-left + slide-in-from-right.
  Stat blocks (district, housing, school/sector, commute) and top
  3 priorities each.
- **Code path.** `apps/web/app/demo/two-people/page.tsx` — entirely
  static; persona stat blocks are hand-written constants matching
  the seeded fingerprints in DB.
- **Risk.** Static — no data dependency. Will render identically every
  time.
- **Evidence parity.** `t-32-card-two-people.png` matches.

### Beat 0:20 – 0:40 — Maya's briefing

- **What renders.** `/demo?fp=maya`. Cover header "Revere · Thu Apr
  9 · 5 items for you" with vermilion gradient rule that draws
  across. 5 items stagger in: rezone (D3, IMMINENT VOTE), wastewater
  contract, Housing Finance Corp board, TxDOT traffic signals, APD
  mental-health grant.
- **Code path.** `apps/web/app/demo/page.tsx` (admin Supabase client
  bypassing RLS) → `loadLatestBriefing(admin, 'maya')` → joins
  candidate_items + verification_reports + drafts + zoning extraction
  + trace + ballot count. Side-fetch fans out to admin queries, all
  in `Promise.all`.
- **Risk.** Side-fetch is N+1 in `Promise.all` over the briefing
  items (5 items × ~3 admin queries each = ~15 round trips). On
  Supabase free tier with cold connection, first hit can be 1.5–2s.
  After warm, sub-300ms. Demo cold start could feel slow.
- **Evidence parity.** `t-31-briefing-jason-1280.png` (Jason's view)
  exists; Maya's hasn't been re-captured since T-31 redesign. Risk
  is low — both routes share the same component path.

### Beat 0:40 – 0:55 — The source proof

- **What renders.** Click "See source ↗" on the rezone item.
  SourceProofModal opens with backdrop blur. Top: verifier's
  strongest claim (`"Current zoning is CS-MU-CO-NP"`), verbatim
  excerpt in italic serif, source_locator in mono. Bottom of modal:
  rendered Staff Report page 8 with vermilion bbox at (825, 845, 50,
  70) on the 1700×2200 image.
- **Code path.** `BriefingItem.onSourceClick` → BriefingView state
  → `SourceProofModal`. Vision data comes from
  `loadZoningExtractionWithAdmin` → 24-hour signed URL on
  `zoning-maps` bucket (Supabase Storage).
- **Risk.** **Signed URL TTL is 24 hours.** If the demo page is open
  longer than 24 hours since first server-render, the URL expires
  and the parcel image 404s. Short window in practice, but if a
  judge revisits the modal hours after pre-flight, it could fail.
  Mitigation: pre-flight demo within 24 hours of submission.
- **Evidence parity.** `t-31-modal-source-1280.png` matches (vermilion
  rect on the SUBJECT TRACT visible).

### Beat 0:55 – 1:15 — The money shot

- **What renders.** Persona switcher click → JWT refresh → `/demo`
  reloads with `fp=jason`. Same meeting (briefing_date=2026-04-09).
  Jason has 4 items: same rezone (top, with **different** why_this:
  `priorities[small_business_permitting].weight=0.9`), then Atmos
  Energy gas rate, Taiwanese Chamber fee waiver, Downtown
  Improvement District.
- **Code path.** Demo recording uses URL fallback (`/demo?fp=jason`),
  not the auth-metadata persona switcher. Auth path uses
  `/api/persona/switch` which mutates `app_metadata.fingerprint_user_id`
  and refreshes session. Demo path skips auth.
- **Risk.** **Demo recording uses URL fallback only.** If a judge
  asks to see the persona switcher in action, the auth path requires
  signing in. The bottom-right `DEMO · FP=JASON` chip on the demo
  route makes the switching mechanism opaque. PRD §19.2 wording
  ("switch persona to Jason") doesn't specify mechanism, so this is
  on-spec — but a curious judge might probe.
- **Evidence parity.** `t-31-modal-trace-1280.png` exists for Jason.

### Beat 1:15 – 1:35 — The Managed Agents trace

- **What renders.** Click "Why am I seeing this? ↗" on Jason's
  rezone. TraceModal opens. Three sections:
  - **Ingestion**: 5-stage timeline (Austin orchestrator → Sonnet
    4.6 verifier → Opus 4.7 vision extractor → fingerprint matcher
    → Opus 4.7 composer), each with a "View session log ↗" toggle
    that reveals the agent_sessions row's `notes` field.
  - **Verification**: rollup ("Verifier checked 30 claims; 18
    supported with verbatim source quotes…") + 3 sample claims
    with claim_id and claim_type strap; "View raw report ↗" reveals
    full JSON.
  - **Why You**: why_this rendered verbatim, breakdown grid (post
    score, threshold, geography match, topic overlap, phrase match),
    matched fingerprint priorities. "View raw score ↗" reveals JSON.
- **Code path.** `loadTraceWithAdmin` joins `agent_sessions`,
  `verification_reports`, `briefing_items.score`. Three sections are
  pure-render from the joined payload.
- **Risk.** **PRD §19.2 wording diverges from what renders.** PRD
  says "**Three Managed Agents sessions — Austin Council, AISD,
  Texas Lege — in parallel.**" Demo renders **five sessions, all
  on Austin Council** (orchestrator/verifier/vision/matcher/composer).
  `docs/demo-script.md` line 87 reconciles to "Five Managed-Agents
  sessions, all logged." The on-stage script is correct; the PRD is
  not. **The submission-blurb (docs/submission-blurb.md) does not
  repeat the "three jurisdictions" framing — it says "five
  Managed-Agents uses, emphasizing outcome grading, HITL escalation,
  tracing as trust surface."** Submission blurb is fine. PRD is the
  artifact a judge could click into and notice the gap.
- **Evidence parity.** `t-31-modal-trace-1280.png` matches.

### Beat 1:35 – 1:55 — The action flow

- **What renders.** Click "Draft a reply ↗" on Jason's rezone.
  DraftModal opens with three columns at desktop (Direct, Measured,
  Persuasive), each with: voice tag, word count, draft body in
  serif, mailto button, copy-text button, "What the critics caught
  ↗" toggle revealing the 3-entry critique trail (council_staffer,
  opposing_constituent, press_shop).
- **Code path.** `loadDraftsWithAdmin` reads pre-baked rows from
  `drafts`. Drafts were generated at session-8 build time via
  `pnpm draft --candidate 61 --user jason`.
- **Risk.** **Drafts are pre-baked, not live.** PRD §19.4 says
  "Live: ... draft generation." Demo does NOT generate drafts live.
  Generating live would take ~7 Opus calls × 2–3s = 15–25s of dead
  air on stage. Pre-baked is the right call; PRD wording overstates
  what's live.
- **Risk.** PRD §19.2 beat says "On Jason's **TABC alert**, tap
  'draft a reply.'" The actual rezone case is C14-2025-0080 at 1811
  East Cesar Chavez — a **liquor-sales rezone** (CS-MU-CO-NP →
  CS-1-CO-NP), which is TABC-adjacent but not literally a "TABC
  alert." Demo script (docs/demo-script.md) glosses this; PRD remains
  as-was.
- **Evidence parity.** `t-22-jason-draft-1280.png` matches; Maya's
  drafts also exist.

### Beat 1:55 – 2:05 — The ask

- **What renders.** `/demo/closing`. Three-line tagline reveal: "Same
  public record. / Different lives. / Receipts on every claim."
  Vermilion "Different lives" line. Subtagline: "Civic information,
  personal. / Civic action, yours." Brand lockup pulse: "Built with
  Opus 4.7."
- **Code path.** Static.
- **Risk.** None.
- **Evidence parity.** `t-32-card-closing.png` matches.

### Aggregate

If the demo runs against a localhost server, every beat described
in `docs/demo-script.md` will render as the gate evidence shows.
Three of the seven beats have **PRD-versus-actual wording gaps**
(jurisdictions, draft-live-ness, TABC-versus-rezone) that the
demo script reconciled but the PRD did not. Those are P1 narration
risks, not visual failures.

---

## Section 3 — Critical issues

### P0 — demo-blockers if not addressed

**P0-1. No Vercel deployment.**
- Location: operational; no `.vercel/` directory; `vercel.json`
  exists but is not linked.
- Observation. The demo runs **only** on `localhost:3000`. A judge
  given a URL has nothing to visit. The morning-email path
  (T-24 §9.1's deep-links use `APP_URL`) defaults to localhost. The
  Vercel cron declaration in `vercel.json` does not fire.
- Remedy. `pnpm vercel link → vercel deploy --prebuilt` to push the
  current commit, then add the Vercel URL to Supabase Auth →
  URL Configuration → Redirect URLs. Cost: S (15 min). **Can be
  done before submission deadline.**
- Alternative if deploy is risky: rehearse on the local laptop and
  share the localhost URL via Tailscale or a tunneling service for
  remote judges; otherwise present from the laptop.

**P0-2. Demo video is webm only; conference projectors typically
prefer mp4.**
- Location: `docs/verification/t-32-demo-2min.webm` (11.2 MB).
- Observation. PRD §19.3 says "rendered the night before." Most
  conference projectors and presentation software (PowerPoint,
  Keynote) handle mp4 natively but not webm. webm renders fine in
  browsers, but a fallback laptop or a borrowed presenter station
  may not.
- Remedy. `ffmpeg -i t-32-demo-2min.webm -c:v libx264 -pix_fmt yuv420p
  -crf 23 -preset slow t-32-demo-2min.mp4` plus the three rehearsal
  files. Cost: S (5 min if ffmpeg installed; brew install ffmpeg
  if not). **Can be done before submission deadline.**

**P0-3. Demo recording does not include the elections / your-ballot
surface.**
- Location: `scripts/record-demo-2min.py` (last touched commit
  `65cb175`, before T-37 shipped).
- Observation. The 2-minute video walks the source-proof + trace +
  draft beats but never visits `/ballot`. Election Briefing is one
  of the most differentiated surfaces in the build — Session 10's
  contribution. A judge watching the canonical video sees no
  evidence of multi-jurisdiction or ballot mode. The README +
  architecture doc + ballot gate evidence exist, but the recording
  doesn't.
- Remedy decision tree:
  - **(a)** Re-record the 2-minute demo with a "Open your ballot
    ↗" detour after the trace beat, replacing some of the
    hold-time on the draft modal. Adds ~15s of /ballot rendering.
    Cost: M (45 min — extend script, re-time, re-record, re-verify
    ≤2:05). Risk of fix: medium (re-timing could push past cap).
  - **(b)** Record a separate 60-second "ballot supplement" video,
    keep the canonical 2-minute as-is, and link both in the
    submission. Cost: S. Risk: low.
  - **(c)** Accept-as-is and rehearse the live demo to navigate to
    /ballot. Cost: 0. Risk: live demo failure costs the beat.
- Recommendation: (b). Two artifacts is honest about scope and
  doesn't risk the canonical video's timing.

### P1 — visible flaws

**P1-1. PRD §19.2 wording diverges from rendered demo on three beats.**
- Location: `revere-prd.md` lines 545–552.
- Observation. PRD references "three Managed Agents sessions —
  Austin Council, AISD, Texas Lege — in parallel," a "TABC alert,"
  and "live draft generation." None of those three render literally
  in the demo as built. The on-stage script (`docs/demo-script.md`)
  reconciles all three. The submission-blurb (`docs/submission-blurb.md`)
  reconciles two of three (does not echo the "three jurisdictions"
  language). The PRD remains as-was.
- Remedy: a one-paragraph addendum at the top of `revere-prd.md
  §19.2` ("**As-built reconciliation**: 5 sessions on Austin
  Council; rezone item is liquor-sales-adjacent; drafts pre-baked
  for demo timing"). Cost: S. **Rehearse-around alternative**: in
  the on-stage narration, do not echo the original PRD wording.
- Marking the PRD itself as as-was-frozen-at-build-start would
  also work.

**P1-2. No mp4 demo-video archive.**
- Location: same as P0-2 above; reframed as P1 if P0-2 is taken.

**P1-3. RESEND_API_KEY not configured; "morning email" is a render
artifact, not a delivered email.**
- Location: `apps/orchestrator/src/email/email.ts`; demo evidence at
  `docs/verification/email-renders/{maya,jason}.{html,txt,png}`.
- Observation. PRD §9.1 frames the morning email as a delivered
  artifact ("7am local time. Plain text + lightweight HTML.").
  Submission blurb echoes "deliver a morning briefing." A judge
  asking "where's the email?" gets a screenshot of an HTML render,
  not a real send.
- Remedy: signing up for Resend (free tier, ~30s + email
  verification), pasting the API key into `.env.local`, running
  `pnpm email --user maya --to <judge-friendly-inbox>`. Cost: S
  (5 min if user has email-verified signup ready).
- **Rehearse-around alternative**: include `email-renders/maya.html`
  as a screenshot in the submission. Already done.

**P1-4. PRD T-30 (recruited Austinite testimonials) NOT shipped.**
- Location: not in repo.
- Observation. PRD §22 + §23 (Impact rubric) names this as a
  competition-significant deliverable: "Recruited users with real
  testimonials." None of the three recommended personas are
  recorded.
- Remedy: out of agent scope. Operational. Even one 30-second
  testimonial from a single Austinite would substantially
  strengthen the Impact rubric score per PRD §22.4.

**P1-5. Vercel cron declaration without deployment is a paper trigger.**
- Location: `vercel.json`; `apps/web/app/api/cron/nightly/route.ts`.
- Observation. The cron route returns 200 on the localhost server
  (`docs/verification/t-19-nightly-gate.md` shows the curl trace),
  but with no Vercel deployment, the cron never actually fires.
  PRD §19.4 says "the trace is the real trace from the real run."
  Real runs happened locally (Sessions 4 + 7); the trace surface
  reads them correctly. But "ran at 2am while you slept" is a
  narrative claim the operator ran manually.
- Remedy. Either deploy + let the cron actually fire (requires
  P0-1), or in the on-stage narration replace "ran at 2am" with
  "ran overnight via the orchestrator on a long-lived host," which
  is honest. PRD §24 R4 explicitly authorizes this fallback.

**P1-6. Auth callback URL whitelist not verifiable from code.**
- Location: Supabase Dashboard → Authentication → URL Configuration.
- Observation. Magic-link sign-in exchanges a code at `/auth/callback`.
  Supabase requires the allowed redirect-URLs list to include each
  domain that origins from. If only `localhost:3000` is whitelisted
  and the user signs in from a Vercel preview URL, the callback
  fails silently (the email link goes to localhost on the wrong
  machine).
- Remedy: operational. Open the Supabase dashboard, add `localhost:3000`
  + Vercel preview URLs + the canonical Vercel domain.
- **The demo path** (`/demo?fp=...`) bypasses auth entirely and is
  not affected. So even if magic-link is broken in prod, the demo
  still works. Reduces severity — but a curious judge clicking
  "Sign in" would hit the failure.

**P1-7. T-14 AISD + Texas-Lege orchestrators absent.**
- Location: `.claude/skills/jurisdictions/{aisd,texas-lege}/SKILL.md`
  exist as stubs; no `apps/orchestrator/src/ingest/aisd*` or
  `texas-lege*` code.
- Observation. PRD §20 marks T-14 as critical-path-parallel. PRD
  §19.2 references "three jurisdiction agents in parallel."
  Multi-jurisdiction is real on the **ballot side** (election seed
  spans Austin council + AISD + Texas House), not on the
  **briefing side**. The morning briefing is Austin-only.
- Remedy. Demo doesn't need AISD/Texas-Lege briefing items. The
  ballot already covers multi-jurisdiction. **Accept and don't
  refer to multi-jurisdiction briefing.** Submission blurb already
  doesn't.

**P1-8. T-29 onboarding not exercised in the demo recording.**
- Location: `apps/web/app/onboarding/page.tsx` exists; no demo
  recording visits it.
- Observation. The conversational onboarding is a strong product
  surface (10–14 turn Opus 4.7 interview, four guardrail tests
  passed). It's not in the demo because the personas are seeded.
- Remedy. Optional supplement video of the onboarding flow (~90s
  of conversation). Cost: M. Risk: low (independent surface).

**P1-9. Signed URL on Staff Report page expires after 24 hours.**
- Location: `apps/web/src/lib/queries/zoning-extraction.ts`,
  `SIGNED_URL_TTL_SECONDS = 60 * 60 * 24`.
- Observation. Each request generates a fresh signed URL (route is
  `force-dynamic`). So as long as the source-proof modal is fetched
  each render, the URL is fresh. **However**, a previously-rendered
  page kept open for >24 hours would have a stale URL. Negligible
  in practice but flag-worthy for a long-running rehearsal.
- Remedy. None needed — re-rendering refreshes. Document for
  rehearsal hygiene.

**P1-10. Action-flow video uses Sept-9-pre-redesign visuals
(`t-22-bundled-flow-with-action.webm`), not the Session 9 redesign.**
- Location: `docs/verification/t-22-bundled-flow-with-action.webm`
  (last touched `4cd8358`, before T-31 redesign).
- Observation. The current canonical demo video (`t-32-demo-2min.webm`,
  10.7 MB, 2:00) was re-recorded with the redesigned visuals at
  `f887364`. The earlier action-flow-only bundle was not. Confusing
  but non-blocking — only the canonical 2-minute video is the
  submission artifact.
- Remedy: delete or relabel the older bundles. Cost: S. **Or accept
  and don't reference them**.

---

## Section 4 — Polish opportunities

Ranked by demo-day visibility × risk-of-fix. Default verdict is
**ship-as-is** unless the row says otherwise.

| # | Finding | Visibility | Risk | Verdict |
|---|---|---|---|---|
| 1 | Briefing list cold-start latency on first /demo render. Side-fetch fans out to 4 admin queries × N items + 3 storage signed URLs = ~15 round trips on cold connection. | medium | low | **ship-as-is**; rehearse with a warm-up navigation. |
| 2 | Cover-header gradient rule is the only place using a gradient — vermilion through transparent. Slight visual inconsistency with the rest of the app's solid-color rules. | low | medium | ship-as-is. |
| 3 | "IMMINENT VOTE" strap on briefing items uses vermilion — combined with the cover-header numerals + 3 link underlines + (sometimes) parcel highlight, the per-screen vermilion-uses count exceeds the editorial "3 uses ceiling." | low | low | ship-as-is. The ceiling was a soft guideline; the actual visual hierarchy is fine. |
| 4 | The Next.js dev indicator ("N" floating button) is visible in every screenshot and would show in a `next dev` recording. Production builds (`next start`) hide it. | medium | low | **fix**: run `pnpm build && pnpm start` for the demo, not `pnpm dev`. Operational; no code change. |
| 5 | Onboarding's `prefers-reduced-motion` guard is set in `globals.css`; if a judge has motion reduced (macOS Settings → Accessibility), the cinematic reveals collapse to instant. The end state is identical, but the demo's narrated cadence assumes motion. | low | low | ship-as-is; documented in `t-31-redesign-gate.md`. |
| 6 | The bundled video at canonical path is 10.7 MB — slightly over the 10 MB threshold some submission forms cap on direct upload. | medium | low | **fix if needed**: lower CRF or scale to 1080p mp4; mp4 is generally smaller than webm at equivalent quality. Folds into P0-2. |
| 7 | The trace modal's "View raw record ↗" toggles reveal JSON in monospace. The JSON is several hundred lines for the verification report — judges may scroll forever. | low | low | ship-as-is. |
| 8 | The persona switcher button's sliding-fill hover is a delight. The footer "DEMO · FP=JASON" chip is plain. Unifying treatments is a touch-up, not load-bearing. | low | low | ship-as-is. |
| 9 | Election authority badge (`Can do` / `Can move` / `Can push` / `Out of scope` / `Too vague`) uses 5 styles but not all are equally legible at small sizes. Specifically `Out of scope` is `border-vermilion/50 text-vermilion-deep` — deep vermilion at 10px tracking 0.14em can read as fuzzy. | low | low | ship-as-is. |
| 10 | The /ballot page renders all races regardless of election date — there's no "no upcoming races" empty state because the seeded races have election_date=2026-11-03 (still upcoming). Empty state is unreachable. | low | low | ship-as-is. |
| 11 | `apps/web/app/onboarding-pending/page.tsx` is unreachable (auth callback now routes to /onboarding). File still references the old path. | low | low | **fix in cleanup session**: delete the file. Risk-free. |
| 12 | The README's "Status checklist" is hand-maintained and could drift from the actual git log. | low | low | ship-as-is; reaudit before submission. |
| 13 | The /demo route footer chip "DEMO · FP=JASON" remains visible during all-screens demo recording. Reads slightly chrome-ish. | low | low | ship-as-is — it's intentionally there to disambiguate the demo path. |
| 14 | Bundled videos (t-22, t-27, t-28) accumulate in `docs/verification/`. They're prior-session checkpoints, not the canonical demo. Disk: ~22 MB combined. | low | low | ship-as-is; cleanup session can prune. |

---

## Section 5 — Non-code demo-day risks

Each risk lists status-as-of-this-audit and a single specific action
the human should take. All actions are operational; none are code
changes.

### Operational

**Vercel deployment.**
- Status: not deployed. No `.vercel/` directory.
- Action: `npx vercel link → npx vercel deploy --prod` from the repo
  root. Then add the production domain (and the auto-generated
  preview-URL pattern) to Supabase → Auth → URL Configuration →
  Redirect URLs.
- Estimated time: 15–30 minutes including Supabase whitelist update.

**Supabase auth callback URL whitelist.**
- Status: unknown — not verifiable from code.
- Action: open Supabase dashboard → Project → Authentication → URL
  Configuration. Confirm both `http://localhost:3000` and the Vercel
  domain are listed under Site URL + Redirect URLs.
- Estimated time: 5 minutes.

**Resend signup + verified sender + key into env.**
- Status: not configured (`RESEND_API_KEY` empty).
- Action (only if T-24 live email matters for submission): sign up
  at resend.com, verify a sender address, paste key into
  `.env.local` as `RESEND_API_KEY=re_…`, then `pnpm email --user
  maya --to <judge-mailbox>`.
- Estimated time: 10 minutes.
- Optional. The render artifact is sufficient evidence per
  `t-24-email-gate.md`.

**Demo video format.**
- Status: webm only at `docs/verification/t-32-demo-2min.webm` (10.7
  MB, 2:00).
- Action: `brew install ffmpeg` (if absent) → `ffmpeg -i
  t-32-demo-2min.webm -c:v libx264 -pix_fmt yuv420p -crf 23 -preset
  slow t-32-demo-2min.mp4`. Repeat for the three rehearsal files.
- Estimated time: 5 minutes.

**Backup video hosting.**
- Status: video is in repo. If the laptop fails on stage, the
  fallback path (per PRD §19.3) is "pre-recorded backup."
- Action: upload mp4 to a cloud bucket or a private YouTube link.
  Confirm the link works on a non-presenter device before stage.
- Estimated time: 10 minutes.

### Demo-mechanic risks

**Production build, not dev build, for the live demo.**
- Status: Sessions all used `next dev`. The Next.js dev indicator
  ("N" floating chip) is visible in every screenshot.
- Action: `pnpm build && pnpm start` from `apps/web/`. Verify the
  /demo URL still serves and the indicator is gone. Pre-flight
  rehearsal.
- Estimated time: 10 minutes (first build is 30–60s).

**Pre-flight demo with warm cache within 24 hours of submission.**
- Status: never explicitly done.
- Action: open `/demo/hook → /demo?fp=maya → /demo?fp=jason`,
  click into the source-proof modal at least once on each persona,
  click into the trace and draft modals at least once. This warms
  the Next.js route cache and refreshes signed-URL TTL.
- Estimated time: 5 minutes.

**Backup laptop / projector / browser.**
- Status: untracked.
- Action: confirm a second laptop has the same repo + env, can
  serve the demo, and has the mp4 ready as a fallback. Confirm the
  presentation projector accepts HDMI from the laptop.
- Estimated time: 30 minutes.

**Anthropic Console rate-limit posture for live calls.**
- Status: T-26 vision pipeline runs at **ingestion time**, not
  demo time. Modal serves persisted bbox + signed URL. Zero live
  Claude calls during the demo.
- Action: nothing demo-specific.

**Anthropic API budget.**
- Status: `~$5` spent across all sessions per the gate evidence.
  $1000 budget per PRD §21.
- Action: nothing.

### Submission deliverable risks

**Recruited Austinite testimonials.**
- Status: 0 of 3 recorded. T-30 was deferred.
- Action: reach out to 1 Austinite, schedule a 10-minute call,
  record a 30-second response to "what would you want to see in a
  briefing tomorrow?" — even one is enough to claim the Impact
  rubric. PRD §22.3 has an outreach template.
- Estimated time: 1–3 hours over 1–2 days, blocked on a real human.

**Submission blurb word count.**
- Status: 481 words per `docs/submission-blurb.md`. Cap is 500.
  Within bounds.
- Action: nothing.

**README screenshot links.**
- Status: README points to `docs/verification/t-31-*.png` and
  `t-37-ballot-{maya,jason}.png`. All exist.
- Action: open the README on github.com (after pushing) and click
  through the screenshot links to confirm they render.

**PRD §19.2 wording.**
- Status: original wording preserved; demo script reconciles.
- Action (optional): one-line addendum to `revere-prd.md` near the
  beat sheet noting "as-built reconciliation lives at
  `docs/demo-script.md`." Or accept-and-don't-edit-PRD.

### Stage narration discipline

**Things to NOT say on stage.**
- "Three jurisdiction agents in parallel" — the trace shows five
  Austin-only agent sessions. Say "five Managed-Agents sessions"
  per the demo script.
- "The drafts you're seeing were generated live" — they were
  pre-baked. Say "Revere drafts three variants" without a tense
  claim.
- "It ran at 2am via Claude Code Routine" — it ran via `pnpm
  nightly` on a local long-lived process. Say "ran overnight on
  the orchestrator."
- "TABC alert" — say "rezoning to allow liquor sales," which is
  the actual case.

**Things TO say.**
- "The vermilion box on the parcel is Opus 4.7 vision — pixel
  coordinates from the actual Staff Report page."
- "Same meeting. Same district. Different people. Different
  briefings."
- "Each promise carries 'Can they actually do that?' — sourced from
  the office's charter, not our opinion."
- "Revere never autosends."

---

## Audit summary

The build is substantively complete. Twenty-eight of thirty-three
PRD-named tasks are shipped or shipped-partial; five (T-14, T-30,
plus the voice modality of T-29, plus Vercel deployment plus live
email) are deferred-explicit and fall back gracefully. The 2-minute
demo video runs at 2:00 with three reproducible rehearsals all under
the 2:05 cap. The demo's load-bearing argument — same meeting, two
people, two materially different briefings, all with receipts — is
mechanically and visually demonstrable.

Three P0 findings and ten P1 findings exist. **All three P0s are
operational, not code:** Vercel deploy, video format, election-mode
absent from the canonical recording. The first two can be closed in
under an hour; the third takes either a careful re-record or a
supplement video.

The polish list has fourteen entries; ten recommend ship-as-is.
The four exceptions are: building production not dev mode for the
live run; converting the demo video to mp4 (folds into P0-2);
deleting the unreachable `/onboarding-pending` page in a cleanup
session; and shrinking the canonical video below ~10 MB if a
submission form caps on direct upload.

The biggest risk that no Claude Code session can fix is **T-30 user
testimonials** — competition-significant for the Impact rubric per
PRD §22.4 and §23, requires a real Austinite and a real call.

This audit is the gate. After it lands, follow-up sessions with
human review address the P0s and any P1 the operator chooses. The
polish list is for after the demo, if at all.
