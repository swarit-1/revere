# Session 6 — Briefing UI: T-23 + T-25 + T-28

## Context

Session 5 closed with the bundled-task gate firing: Maya and Jason produce
visibly different briefings from the same 56 candidate_items. The pipeline
runs end-to-end from raw Legistar HTML to ranked `briefings.payload` JSON
in Supabase. Session 6 makes that visible.

Three PRD-distinct tasks; three gate moments; one bundled video gate that
seeds T-32 (pre-recorded backup):

  T-23 — Magic-link auth via Supabase Auth + v3 RLS-policies migration.
  T-25 — Briefing list + item detail + minimal source-proof modal.
  T-28 — Persona switcher (production path + URL fallback).

After Session 6, opening a browser, signing in, viewing Maya's briefing,
clicking an item, hitting persona-switch, and seeing Jason's is the demo's
beats 1–3 working live. Beats 4 (source proof with hi-res map) and 5 (action
flow) come later.

Two non-negotiables surfaced in Phase 1:
- **The v2 migration enabled RLS with no policies.** Server-component reads
  via the authenticated JWT will return zero rows until v3 adds policies.
  Folded into T-23 — not a separate session. Dropping silently into Day 1
  of execution would have been catastrophic.
- **The demo override (`/demo?fp=maya`) must be a different code path from
  start to finish** — different Supabase client (service_role, not auth),
  different route, no shared dependencies on the JWT or RLS evaluation. If
  conference Wi-Fi takes auth out, the override has to keep working.

## Divergences from PRD (matches Session 1–5 table format)

All locked in Phase 1.

| Divergence | PRD says | Session 6 ships | Why |
|---|---|---|---|
| v3 RLS policies migration | Not in §12.4 (PRD doesn't speak to RLS) | New migration `20260426112824_v3_rls_policies.sql` adds SELECT policies on `fingerprints`, `briefing_items`, `briefings` keyed on `app_metadata->>'fingerprint_user_id' = user_id`; UPDATE policy on `auth.users.app_metadata` is implicit (admin-only). | The v2 migration enabled RLS without policies. Authenticated reads return zero rows. The fix lands inside T-23 because T-23 is the first task that exercises authenticated reads. |
| Demo override path | n/a | `/demo?fp=maya|jason` route uses service-role server-side, bypasses RLS by design. Different Supabase client, different rendering pipeline, no shared auth dependencies. Documented in migration comments + plan + the route file's header. | If conference Wi-Fi takes auth out, /briefing fails (auth callback), but /demo keeps rendering. The deliberate bypass is the safety net, not a vulnerability — the URL is non-public. A later security pass could be tempted to "fix" it; the comment header tells them not to. |
| Pre-created auth users | "Magic-link email. No social logins in v1." (§12.7) | Pre-create Maya and Jason auth users via Supabase admin SDK as part of T-23. Both share a `+demo`-aliased Gmail (or fresh demo inbox) the user controls. No public sign-up form. | T-29 (voice onboarding) is the proper sign-up path; v1 demo just signs in as a pre-seeded persona. Magic-link to a personal inbox is a 30-second-panic risk on stage; +demo alias keeps demo-day mail isolated. |
| Source-proof modal scope | T-26 owns "the source-proof pane" (§13.1) | T-25 ships `<SourceProofModal mode="minimal">` with: Legistar item URL, agenda PDF link, verbatim `raw_passage`, and `evidence.source_locator` (page / offset / timestamp). T-26 swaps the same component to `mode="full"` and adds the parcel-highlight map without changing call sites. | Source proof is too important to defer entirely. The forensic detail (locator + verbatim quote) is the trust receipt; the map is incremental atmosphere on top. Mode-prop architecture means T-26 plugs in cleanly. |
| Loading + empty states | Treated as polish (§12.6 mentions "newspaper-clean" in passing) | T-25 designs both explicitly: Suspense boundary with hairline-bordered skeleton rows (NOT generic shimmer), and intentional empty-state copy ("No new items in your fingerprint range today. The system watched the April 9 meeting and surfaced nothing for your priorities."). | A blank page during slow Supabase round-trip is catastrophic on stage; "No briefing for today" with empty whitespace looks broken. Both are demo-day risks. Designing them in T-25 means they're tested before T-30 rehearsal, not after. |
| Persona switcher mechanics | "Toggle between Maya and Jason without re-login" (§7.2) | Ship two paths: (b) production-shaped — `app_metadata.fingerprint_user_id` mutation via Route Handler + admin SDK + session refresh; (c) URL fallback — `/demo?fp=maya` query-param route, service-role-rendered, no auth. Default UI uses (b); demo script bookmarks (c). | (b) is what would ship to real users. (c) is the conference-Wi-Fi-fails safety net. Together: production-shaped with a deliberate emergency lane. |
| Persona-switcher RLS implication | n/a | RLS policies use `auth.jwt() -> 'app_metadata' ->> 'fingerprint_user_id'` (not `sub`), so the policy reads the same metadata the switcher mutates. T-28's gate explicitly tests that a metadata swap reaches the briefing render — the JWT must refresh post-mutation, otherwise the new policy denies the new user_id. | Composing RLS with the mutable metadata is the cleanest design; testing the refresh is required because RLS evaluates at query time, not session-creation time. Skipping that test = demo silently shows the wrong briefing. |
| Visual quality enforcement | n/a | Per-commit screenshot comparison at 1280px + 380px against the locked design direction. If a component creeps toward generic AI aesthetic (cards with shadows, vermilion in dividers, Inter font snuck in via a default), halt the commit and iterate. Webapp-testing skill (Playwright) and/or Claude in Chrome extension automates capture. | Visual quality is judged subliminally on demo day. Retrofitting a "generic-looking" UI after T-30 is more expensive than enforcing taste at commit time. Hairline-no-card, mono-`why_this`, vermilion-3-uses-max are the load-bearing rules. |

## Visual identity (locked design tokens)

These ship into `tailwind.config.ts` + `app/globals.css` in T-25. Not
optional, not "themable later."

### Typography

| Role | Font | Loader | Weight |
|---|---|---|---|
| Headline | **Source Serif 4 Display** if next/font/google exposes the display optical-size variable cleanly; otherwise Source Serif 4 (regular cut at ≥24px) | `next/font/google` | 600 / 700 |
| Body | **Public Sans** | `next/font/google` | 400 / 600 |
| Mono (the `why_this` field-path trust receipt) | **JetBrains Mono** | `next/font/google` | 400 |

**Banned fonts (skill default-creep):** Inter, Roboto, Arial, Space Grotesk,
Tiempos, Charter, system-ui. None of these reach `globals.css`. If Tailwind
autocomplete suggests `font-sans` resolving to Inter, the answer is no —
override `theme.fontFamily.sans` to point at Public Sans.

### Color palette (5 tokens, dominant ink + cream + restrained vermilion)

| Token | Hex | Tailwind name | Role |
|---|---|---|---|
| ink | `#1a1a17` | `ink` | typeset body, headlines, default text |
| cream | `#faf7f0` | `cream` | page background — never `#fff` |
| vermilion | `#c8331f` | `vermilion` | the one accent — see usage ceiling below |
| district | `#5a6b5a` | `district` | muted sage — metadata strip ("D3 · Apr 9 · Motion") |
| whisper | `#e8e3d6` | `whisper` | hairline borders + dividers — the visual rhythm of the page |

**Vermilion usage ceiling: 3 uses, no more.**
1. Cover header date numerals (the "Apr **9**" or item-count "**5** items").
2. Link underlines on inline source-proof "see source" links.
3. Primary CTA in T-21 ("Draft a reply"). Not in scope for this session.

If vermilion appears on bullets, dividers, confidence dots, "imminent vote"
tags, or anywhere else, it's AI-default-aesthetic creep. Pull it back.
Confidence dots are `district` sage; dividers are `whisper`; tags inherit
the surrounding text color.

### Spacing rhythm

8px base. Scale: 4 / 8 / 16 / 24 / 32 / 48 / 64 / 96 / 128. The cover header
gets at least 96px above and 64px below — the editorial signature negative
space. Items inside the list use 32px between hairline dividers.

### Item visual anatomy (hairline-divided, no card chrome)

```
─── D3 · Apr 9 · Motion · Imminent vote ─────────────  (district sage, 13px tracked)

Rezoning hearing for 1811 East Cesar Chavez            (Source Serif 4 Display, 28px / 1.15)
to allow liquor sales

WHY THIS MATTERS TO YOU                                 (Public Sans, 11px small-caps,
                                                        vermilion underline ONLY on this label)
location.council_district=3                             (JetBrains Mono, 13px, ink — verbatim
+ priorities[housing_cost].weight=0.9                    not paraphrased; the trust receipt)

Two-sentence what_happened in body sans, generous       (Public Sans, 16px / 1.55)
tracking, no editorializing.

[ See source ↗ ]   • High confidence                    (button: ink, vermilion underline on
                                                        hover; • is district sage)
─────────────────────────────────────────────────────  (whisper hairline, 1px)
```

**No card chrome.** No `shadow-md`, no `rounded-lg`, no `border` outlining
each item. Items separated by hairlines. Every time Tailwind autocomplete
suggests `bg-white shadow rounded`, the answer is no.

### Loading skeleton (designed, not deferred)

```
─── ▒▒▒▒ · ▒▒▒▒▒▒ · ▒▒▒▒▒▒ ─────────────────────────  (whisper-filled placeholder strip)

▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒        (whisper block at headline size)
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒

▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  (whisper block at body size, two lines)
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
─────────────────────────────────────────────────────
```

No animated shimmer. No purple gradient skeleton. Just whisper blocks at
the right sizes, separated by the same hairlines as the real content. Render
inside a `<Suspense fallback={<BriefingSkeleton />}>` boundary on
`/briefing`.

### Empty state (intentional copy)

```
No new items in your fingerprint range today.
The system watched the April 9 meeting and surfaced
nothing for your priorities.

[ See what was filtered ↗ ]
```

The "see what was filtered" link points at a future trace view (T-27). For
v1 it links to a placeholder route. The point is that emptiness is a
design moment, not a rendering bug.

## Pre-flight checklist (Step 0 — runs before any gate work)

If any of these fail, halt and surface — do not work around.

1. **Confirm Session 5 state intact.**
   ```
   git log --oneline -5             # T-18 / T-17 / T-15 / T-13 / T-11 visible
   ```
   Plus a Supabase REST call confirming `briefings` count = 2 and
   `briefing_items` count = 74.

2. **Auth is enabled in the Supabase project**, with email provider on and
   magic-link redirect URLs whitelisted for both `localhost:3000` and the
   eventual Vercel URL. (Settings page check; if not enabled, halt — this
   is a project-config thing the user owns.)

3. **Demo inbox decided.** User has chosen either a fresh Gmail or a
   `+demo`-aliased existing inbox. Email address pasted into a
   `.env.demo-inbox` file (gitignored) so the seed script can read it.

4. **Claude in Chrome extension installed** OR `webapp-testing` skill +
   Playwright available locally for screenshot capture. The visual
   verification loop is non-negotiable for this session; if neither is
   available, halt and install before Phase 3.

5. **`apps/web/.env.local`** has `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon, not service-role — service-role
   only goes server-side). Plus `SUPABASE_SERVICE_ROLE_KEY` for the
   server-only paths (the `/demo` route, the persona-switcher Route
   Handler, the auth-user seed script).

## Three gate moments

### T-23 — Magic-link auth + v3 RLS policies

**Files shipped:**

- `supabase/migrations/20260426112824_v3_rls_policies.sql` — three SELECT
  policies. Sketch:
  ```sql
  -- Gate the auth path: server components rendering for an authenticated
  -- user can read only their own fingerprint / briefing rows.
  CREATE POLICY "users read own fingerprint" ON fingerprints
    FOR SELECT USING (
      (auth.jwt() -> 'app_metadata' ->> 'fingerprint_user_id') = user_id
    );

  CREATE POLICY "users read own briefing_items" ON briefing_items
    FOR SELECT USING (
      (auth.jwt() -> 'app_metadata' ->> 'fingerprint_user_id') = user_id
    );

  CREATE POLICY "users read own briefings" ON briefings
    FOR SELECT USING (
      (auth.jwt() -> 'app_metadata' ->> 'fingerprint_user_id') = user_id
    );

  -- candidate_items + verification_reports stay service-role-only in v1.
  -- Authenticated users reach them transitively through briefing_items
  -- joins, which the matcher denormalizes — no direct read needed.
  ```
  Comment header notes: service-role bypasses by design (used by the orchestrator + the `/demo` URL fallback).
- `apps/web/src/lib/supabase/server.ts` — `createServerClient` from `@supabase/ssr` with cookie store. Used by all server components on `/briefing` and `/auth/callback`.
- `apps/web/src/lib/supabase/browser.ts` — `createBrowserClient`. Used only by the persona-switcher Route Handler trigger.
- `apps/web/src/lib/supabase/admin.ts` — `createClient(url, service-role-key)`. Server-only, never imported into a client component. Used by the seed script + the persona-switcher Route Handler + `/demo`.
- `apps/web/app/auth/sign-in/page.tsx` — magic-link form. Email input → `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: '<origin>/auth/callback' }})`.
- `apps/web/app/auth/callback/route.ts` — Route Handler that exchanges the code for a session and redirects to `/briefing`.
- `apps/web/app/briefing/page.tsx` (skeleton only — fully fleshed out in T-25) — server component that reads the session, looks up the user's fingerprint, redirects to `/onboarding-pending` if absent.
- `apps/web/app/onboarding-pending/page.tsx` — placeholder for T-29. Says "Voice onboarding is coming soon. For demos, use /demo?fp=maya."
- `scripts/seed-auth-users.ts` — admin-SDK script. Creates `maya@<demo-inbox>` and `jason@<demo-inbox>` auth users with `app_metadata.fingerprint_user_id` set to `'maya'` and `'jason'` respectively. Idempotent (skip if exists).
- `apps/web/package.json` — adds `@supabase/ssr`, `@supabase/supabase-js`.

**Advisor strategy:** Sonnet 4.6 for all code (auth boilerplate is mechanical;
@supabase/ssr has a documented pattern). Opus 4.7 only invoked for the
visual-direction sanity check before T-25 starts.

**Cost budget for T-23:** ~$0.20. Mostly small Sonnet calls for boilerplate.

**Gate evidence for T-23:**

- `supabase db push` exits clean. `\d+ fingerprints` (or REST equivalent) shows the SELECT policy attached. RLS is enabled.
- `pnpm --filter @revere/web typecheck` clean.
- `pnpm --filter @revere/web run dev` boots; `/auth/sign-in` renders.
- Submit Maya's email → magic-link arrives at the demo inbox → click → land on `/briefing` with Maya's `payload.cover_header` text visible (even if the rest is unstyled — full styling is T-25). Capture screenshot of: sign-in form, magic-link email body, post-callback `/briefing` redirect, `/briefing` page rendering Maya's cover header.
- Direct REST query against `briefings` from a stale anon JWT returns 0 rows (RLS gates the unauthenticated path).
- Save screenshots inline to `docs/verification/t-23-auth-gate.md`.

**Commit:** `T-23: magic-link auth + v3 RLS policies`.

### T-25 — Briefing list + item detail + minimal source-proof modal

**Files shipped:**

- `apps/web/tailwind.config.ts` — extended with the locked tokens
  (Source Serif 4 Display, Public Sans, JetBrains Mono; ink / cream /
  vermilion / district / whisper; spacing scale).
- `apps/web/app/globals.css` — base reset, font face declarations via
  `next/font` exports, `@apply`s for the editorial defaults
  (`bg-cream text-ink font-body`).
- `apps/web/src/lib/fonts.ts` — `next/font/google` loader for all three
  font families with `display: 'swap'` and CSS variable bindings.
- `apps/web/src/lib/queries/briefing.ts` — typed server-side queries
  reading from the `briefings` and `briefing_items` tables joined to
  `candidate_items` and `verification_reports`. Returns the
  `BriefingPayload` + per-item enrichment for the source-proof modal.
- `apps/web/app/briefing/page.tsx` (full) — server component that:
  - reads session, looks up fingerprint;
  - queries today's briefing for that fingerprint's user_id;
  - wraps the list in `<Suspense fallback={<BriefingSkeleton />}>`;
  - renders cover header + item list, with empty-state branch.
- `apps/web/app/briefing/[item_id]/page.tsx` — item detail page. Same
  visual rhythm as the list, plus the verbatim `body` and the source-proof
  modal trigger.
- `apps/web/src/components/briefing/CoverHeader.tsx` — renders
  `payload.cover_header` with vermilion-numerals-only treatment on the
  date and the item count.
- `apps/web/src/components/briefing/BriefingItem.tsx` — the hairline-divided
  list item per the visual anatomy. Headline, why_this in mono, source-proof
  button, confidence dot.
- `apps/web/src/components/briefing/BriefingSkeleton.tsx` — the loading
  skeleton matching the editorial direction (whisper blocks at headline +
  body sizes, hairline dividers).
- `apps/web/src/components/briefing/EmptyState.tsx` — intentional
  empty-state copy + filtered-trace placeholder link.
- `apps/web/src/components/briefing/SourceProofModal.tsx` — `mode="minimal"`
  branch shown in T-25. Renders Legistar URL, agenda PDF link, the chosen
  claim's `raw_passage` (verbatim, in mono), and the verbatim
  `evidence.source_locator`. Mode-prop accepts `"minimal" | "full"`; T-26
  swaps to `"full"`.
- `apps/web/src/lib/source-proof.ts` — selects ONE strongly-supported claim
  per item from the verification_report (priority: zoning sub-fields > body
  claims > structural). The chosen claim's locator + excerpt is what the
  modal shows.

**Advisor strategy:** Sonnet 4.6 for component scaffolding + Tailwind
composition + Supabase queries. Opus 4.7 for the design-direction sanity
check on the first 3 components landed (CoverHeader, BriefingItem,
SourceProofModal) — verifying intentionality before the rest of the
session inherits the same visual lineage.

**Cost budget for T-25:** ~$1.50 — most of the session budget. UI
component work plus a few rounds of Opus visual iteration.

**Gate evidence for T-25:**

- `pnpm --filter @revere/web typecheck` clean.
- `pnpm --filter @revere/web run dev` boots; `/briefing` renders Maya's
  briefing with all 5 items visible.
- Capture screenshots at **1280px desktop** AND **380px mobile**:
  - cover header
  - full briefing list
  - one item's source-proof modal open
  - loading skeleton (force a slow query for capture)
  - empty state (force by pointing at a non-existent date)
- Visual review against locked design direction: hairline dividers (not
  cards), mono why_this verbatim, vermilion used in ≤ 3 places per
  screen, no Inter / Roboto leakage. If any rule fails, halt and iterate
  before the commit.
- All screenshots inline in `docs/verification/t-25-briefing-ui-gate.md`
  with a per-screenshot annotation noting which design rule it satisfies.

**Commit:** `T-25: briefing list + item detail + source-proof modal`.

### T-28 — Persona switcher (production path + URL fallback)

**Files shipped:**

- `apps/web/app/api/persona/switch/route.ts` — POST handler. Reads target
  persona from request body (validated against `'maya' | 'jason'`); calls
  `admin.auth.admin.updateUserById(userId, { app_metadata: { ... }})`;
  refreshes the session by issuing a new access token; returns `200`.
- `apps/web/src/components/briefing/PersonaSwitcher.tsx` — single-button
  toggle visible on `/briefing`. POSTs to the route, then `router.refresh()`
  to re-render the server component with the new JWT in cookies.
- `apps/web/app/demo/page.tsx` — the URL-fallback route. Reads `?fp=` query
  param, instantiates the **service-role** Supabase client (server-only,
  via `admin.ts`), reads the requested persona's briefing directly,
  renders the same components as `/briefing`. **No** session check.
  **No** RLS path. Different code lineage end-to-end. File header comment
  documents the deliberate bypass:
  ```
  // Demo override route. Service-role client, RLS bypassed by design.
  // This is the conference-Wi-Fi-fails safety net — DO NOT consolidate
  // with /briefing's auth path. See docs/plans/session-6-briefing-ui.md
  // and the v3 migration's header comment.
  ```

**Advisor strategy:** Sonnet 4.6. The Route Handler + the demo route are
mechanical wiring.

**Cost budget for T-28:** ~$0.20.

**Gate evidence for T-28:**

- Logged in as Maya at `/briefing`. Capture screenshot.
- Click Persona Switcher → POST → server-component refresh. Page renders
  Jason's briefing without re-login. Capture screenshot.
- **Critically: confirm the JWT actually refreshed.** The new
  `app_metadata.fingerprint_user_id` must be present in the cookies when
  the next request runs, otherwise RLS denies the new persona's rows.
  Test: log the JWT's `app_metadata` server-side after the refresh; assert
  it changed. If not, halt — the auth refresh logic needs to be patched
  before T-28 ships.
- Visit `/demo?fp=maya` in a fresh browser session (no auth cookie). Page
  renders Maya's briefing. Capture screenshot. Visit `/demo?fp=jason`.
  Renders Jason's. Capture.
- Side-by-side screenshot of `/demo?fp=maya` and `/demo?fp=jason`
  showing the same date with different cover headers, different top
  items, different `why_this` strings.
- All screenshots inline in `docs/verification/t-28-persona-switcher-gate.md`.

**Commit:** `T-28: persona switcher (auth-metadata path + demo URL fallback)`.

### Bundled-task gate (the demo's beats 1–3, mechanically demonstrated)

In addition to the three task gates above, the session must produce a
**~30-second video** capturing one full demo flow:

1. Sign in at `/auth/sign-in` (or land directly on `/briefing` from a
   warm session).
2. Maya's briefing renders.
3. Click an item → source-proof modal opens with Legistar URL + verbatim
   raw_passage + locator.
4. Close modal. Click persona switcher.
5. Jason's briefing renders. Click the same item (26-1501 — the shared
   one between personas) → see the *different* `why_this` field-path
   string for Jason. Same item, different lens.
6. Close modal. End.

Save to `docs/verification/t-28-bundled-flow.webm` (preferred) or `.mp4`.
This is the artifact that seeds **T-32 (pre-recorded backup)** — record
it intentionally:

- Resolution ≥ 1280×720.
- Clean audio if voiceover is added; otherwise silent is acceptable for v1.
- Format: WebM-VP9 or MP4-H.264. Conference projectors handle both; check
  the conference's AV note at submission time.
- No browser dev tools visible. No Console errors mid-recording.
- 60fps if the screen-record tool supports it; 30fps otherwise.

If the bundled video can't be captured cleanly, T-30 rehearsals will
surface the gap — do not paper over with a slideshow simulation.

## Risk register (5 watch-fors during execution)

1. **JWT refresh post-metadata-mutation.** RLS evaluates at query time
   using the JWT in cookies. If the persona-switcher's `updateUserById`
   call doesn't trigger a session refresh, the next page load uses the
   stale JWT, RLS denies the new persona's rows, and the briefing
   renders empty. **Rule:** T-28's gate must explicitly assert that
   `auth.jwt()` reflects the new metadata before declaring victory. Test
   server-side, not just visually.

2. **Visual quality drift via Tailwind autocomplete.** Default Tailwind
   suggestions (`shadow-md`, `rounded-lg`, `bg-white`, `font-sans`
   resolving to Inter) are AI-default-aesthetic creep. **Rule:** every
   component lands with a 1280px + 380px screenshot review against the
   locked design direction. If a component looks generic, halt and
   iterate before commit. Hairline-no-card and vermilion-3-uses-max are
   the load-bearing rules.

3. **Magic-link delivery to a personal inbox.** "Where did the email
   go?" is a 30-second on-stage panic. **Rule:** demo inbox is a
   `+demo`-aliased Gmail or fresh Gmail, not a personal address. Confirmed
   in pre-flight; addressed only in `.env.demo-inbox`.

4. **The `/demo` override drifting back into the auth path.** A future
   refactor may be tempted to "unify" the two routes. **Rule:** the
   migration's header comment, the route file's header comment, and this
   plan all document that the bypass is deliberate. T-28's gate also
   tests `/demo` from a *fresh browser session with no auth cookies* —
   if the route silently requires auth, that test fails immediately.

5. **Loading + empty states getting deferred to "polish."** Both are
   demo-day-visible and easy to forget if T-25 races toward the
   surfaced-list rendering. **Rule:** both states ship in T-25's commit,
   with screenshots in the gate evidence. They are not optional.

## Execute order (Phase 3)

Each step ends with a commit. Halt on any gate failure. Run the visual
review on each component before committing — not after.

0. **Pre-flight** — git log, Supabase counts, demo inbox decided,
   Chrome-extension or webapp-testing-skill ready, auth provider enabled
   in Supabase project. No commit.

1. **T-23** — write v3 migration (`supabase db push`), Supabase clients
   (`server.ts` / `browser.ts` / `admin.ts`), auth pages, seed-auth-users
   script, run seed. Test sign-in end-to-end. Capture screenshots. Save
   evidence file. Commit:
   `T-23: magic-link auth + v3 RLS policies`.

2. **T-25** — write Tailwind tokens, font loaders, briefing queries,
   server components, the four UI components (CoverHeader, BriefingItem,
   BriefingSkeleton, EmptyState), source-proof modal. Per-component
   visual review at 1280px + 380px before each component's commit.
   Final gate screenshots. Save evidence file. Commit:
   `T-25: briefing list + item detail + source-proof modal`.

3. **T-28** — write persona-switch Route Handler, PersonaSwitcher
   component, `/demo` override route. JWT-refresh assertion in the gate.
   Side-by-side screenshots. Save evidence file. Commit:
   `T-28: persona switcher (auth-metadata path + demo URL fallback)`.

4. **Bundled video** — capture the ~30s demo flow per the bundled-gate
   spec. Save to `docs/verification/t-28-bundled-flow.webm`. This file
   becomes T-32's seed. Reference it from
   `docs/verification/t-28-persona-switcher-gate.md`.

After step 4, report final state: row counts unchanged, auth users
created, screenshots captured, video duration + filesize, total token
spend across T-23 + T-25 + T-28.

Halt at end of step 4. Do NOT touch T-19 (Routine), T-21 (adversarial
loop), T-22 (draft UI), T-24 (email), T-26 (hi-res maps), T-27 (trace
view), T-29 (voice onboarding).

## Session-scope rules

- Sonnet 4.6 for: SQL migration, auth boilerplate, component scaffolding,
  Tailwind composition, Supabase queries, route handlers.
- Opus 4.7 for: visual-direction sanity check on the first 3 components
  in T-25 (CoverHeader, BriefingItem, SourceProofModal); design-iteration
  rounds when a component slips toward generic AI aesthetic.
- Per-commit visual review at 1280px + 380px. Webapp-testing skill
  (Playwright) and/or Claude in Chrome extension. If a component looks
  generic, halt and iterate — don't commit and "polish later."
- Files trending past ~250 lines split before shipping (Session 1–5
  pattern).
- If a gate fails, halt — do not commit a failing gate or paper over.
- Anything not required by the four gates (three task gates + bundled
  video) lands in BACKLOG.
- Cost ceiling $3 total. UI work is mostly Sonnet; Opus calls are for
  design judgment and visual-polish iteration.
- The demo override (`/demo`) and the auth path (`/briefing`) are
  separate code lineages end-to-end. They share components but not
  Supabase clients. Don't unify "for cleanliness."
