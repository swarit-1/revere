# Revere — Demo script

The on-stage walk-through. Mirrors PRD §19.2 beat sheet against the
as-built UI from Sessions 6–8 plus the Session 9 demo cards.

Total runtime target: **2:00**, with 5 seconds of slack. Hard cap:
2:05. Three rehearsal recordings live at
`docs/verification/t-33-rehearsal-{1,2,3}.webm`; the canonical
submission cut lives at `docs/verification/t-32-demo-2min.webm`.

## Pre-flight (do this 60 seconds before going on stage)

1. Open Chrome window, single tab. Disable any extensions that
   inject UI (Grammarly, 1Password buttons, etc.).
2. Confirm `apps/web` is running locally (or, if deployed, open
   the production URL).
3. Type once into the URL bar — you'll keep retyping it during the
   walk: `localhost:3000/demo/`. The demo never uses `/briefing`
   (auth path) on stage.
4. Open the demo-flow tabs in order so you can switch by clicking,
   not typing:
   - `/demo/hook`
   - `/demo/two-people`
   - `/demo?fp=maya`
   - `/demo?fp=jason`
   - `/demo/closing`

If Wi-Fi fails, the pre-recorded video at
`docs/verification/t-32-demo-2min.webm` is the fallback. Announce
the fallback up front so judges aren't surprised.

## Beat sheet

| Time | Beat | What happens on screen | What is said |
|---|---|---|---|
| 0:00 – 0:10 | **Hook** | `/demo/hook` page — black-on-cream, serif, the Paul Revere line above the modern translation. | "Paul Revere rode through the night so sleeping citizens would know what was coming. In 2026, most Americans don't know what their city council voted on last night. This is Revere." |
| 0:10 – 0:20 | **The two people** | `/demo/two-people` — split-screen Maya and Jason. Each side shows district + housing status + 2 priorities. | "Maya rents in East Austin, one kid in AISD, drives I-35. Jason owns a duplex three blocks away, runs a small coffee shop on East 6th. Both live in the same district. Last night the council met for four hours." |
| 0:20 – 0:40 | **Maya's briefing** | `/demo?fp=maya` — newspaper-grain cover header, four items. Top: rezoning at 1811 East Cesar Chavez. Hold. | "Here's what Revere sent Maya at 7am. The rezoning sits at the top of her briefing because it's two blocks from the address she gave us. Below that: an AISD line item, a transit change, and a downtown improvement district." |
| 0:40 – 0:55 | **Source proof — the parcel** | Click "See source ↗" on the rezoning item. Modal opens; the verifier's strongest claim and the verbatim source quote at top. Scroll: the actual Staff Report page renders with the **vermilion parcel highlight** on the SUBJECT TRACT for case C14-2025-0080. | "Every claim has receipts. Here's the verifier's strongest supported claim with the verbatim source. Below that: the actual zoning exhibit pulled out of an 11-megabyte Staff Report. Opus 4.7 found the right page among 23 and drew the box on the right parcel. The vermilion is the demonstration." |
| 0:55 – 1:15 | **The money shot — same item, different person** | Close modal. Persona switcher footer (or open `/demo?fp=jason`). Same meeting, four items — but the emphasis and the why-this-matters string change. Click into the rezoning item again. | "Now watch. Same meeting. Same four hours. Same item." (click) "Different person." (Jason loads.) "Jason's why-this-matters reads `priorities[small_business_permitting].weight=0.9`. Maya's read `priorities[housing_cost].weight=0.9`. Same source, different lives." |
| 1:15 – 1:35 | **Trace — the audit trail** | On Jason's rezoning item, click "Why am I seeing this? ↗". Trace modal opens. Three sections: **Ingestion** (5 stages: orchestrator → verifier → vision extractor → matcher → composer), **Verification** (30 claims, 18 supported), **Why you** (matched fingerprint priorities + breakdown). Toggle "View raw report ↗" on the verification section so the JSON expands. | "This is the audit trail for the same item. Five Managed-Agents sessions, all logged. The verifier checked 30 claims; 18 supported with verbatim source quotes, 12 unverifiable, zero unsupported. JSON is one click away — prose first, raw record below." |
| 1:35 – 1:55 | **Action — three variants under attack** | Close trace. Click "Draft a reply ↗" on the same item. Modal opens with three variants side-by-side: Direct, Measured, Persuasive. Hold. Click "What the critics caught ↗" on the Direct column. The trail expands: council staffer → opposing constituent → press shop, each with severity-tagged issues and the refiner's accept-vs-defend response. | "When action makes sense, Revere drafts three variants and argues with itself. Direct, Measured, Persuasive. Each survived a city-council staffer, an opposing constituent, and a press shop attacking it sequentially. Jason picks one, edits it, and sends it himself. Revere never autosubmits." |
| 1:55 – 2:05 | **Close** | Click `/demo/closing` tab. Card: "Revere. Same public record. Different lives. Receipts on every claim." | "Civic information, personal. Civic action, yours." |

## What's live vs cached

- **Live during the walk**: every UI surface, every modal click, every
  persona switch, every JSON toggle. The data underneath is cached
  (the 2026-04-09 Austin City Council meeting was ingested April 26).
- **Cached during the walk**: the meeting itself, the verification
  reports (37 rows), the briefing items (74 rows), the zoning
  extractions (11 rows), the drafts (6 rows). The agent_sessions
  trail is the actual audit log of those runs.
- **No live model calls during the demo**. Every Opus 4.7 / Sonnet
  4.6 / Haiku 4.5 call already happened. The trace modal shows the
  ones that ran.

## Fallback

If anything breaks live:

1. Switch to the pre-recorded video. Announce the switch.
2. Backup URLs (in order of preference): direct file, Google Drive
   link mirror, GitHub raw link.

The video is the same path with the same beats — judges can't tell
the difference.

## Voice / cadence notes

- The two longest holds are 0:40-0:55 (parcel highlight) and
  1:35-1:55 (three variants). Don't rush them — they're the
  argument.
- Don't read the variants aloud. They're long enough that judges
  scan, not read. Let them scan while you narrate the *why* (3
  critics, accept vs defend).
- Don't say "AI" once. Say Opus 4.7 by name when it's appearing on
  screen (vision and drafting). Say "the verifier" when it's
  Sonnet 4.6 in the trace.

## Risks

1. **Modal image takes too long to load.** The page image is a
   signed URL on Supabase Storage. The first hit on a stale signed
   URL is ~400ms; subsequent hits are cached. Mitigation: open the
   parcel modal once during pre-flight, then reload the briefing.
2. **Persona switcher doesn't refresh JWT.** This was the T-28 bug.
   The fix is in `/api/persona/switch` (it calls
   `auth.refreshSession()`). For demo robustness, use the
   `/demo?fp=...` URL approach — it bypasses auth entirely.
3. **Draft modal opens too narrow at projector resolution.** Modal
   max-width is `5xl` (~1024px). Tested at 1280×900. If projector
   is 1024×768, the modal scrolls horizontally. Mitigation: rehearse
   at projector resolution.
4. **Going over 2:05.** Three rehearsals. If the third lands above
   2:05, drop the JSON-expand step in the trace modal beat.
