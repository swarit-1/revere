# T-18 — Composer + bundled-task gate

**Date:** 2026-04-26
**Briefing date:** 2026-04-09
**Model:** Opus 4.7 (composer)
**Driver:** `apps/orchestrator/src/compose/compose.ts`

## Outcome

Gate state: **cleared, including the bundled-task gate.**

| Gate criterion | Status |
|---|---|
| Two briefings persisted (one per persona) for 2026-04-09 | ✓ cleared |
| Cover header + coverage stats per PRD §9.1 | ✓ cleared |
| `payload.items[]` carries headline / what_happened / why_this / rank | ✓ cleared |
| `briefing_items.rank` updated for surfaced rows | ✓ cleared |
| **Bundled gate: Maya's and Jason's `payload.items[]` are visibly different** | ✓ **cleared** |

The session's central claim — *"from the same 56 candidate_items, the
system produces two briefings with materially different content per
persona"* — is mechanically demonstrated end-to-end.

## Side-by-side payloads

### Jason (D3 small-business owner; commercial-regulation focus)

```
cover_header: "Revere · Thu Apr 9 · 4 items for you"
coverage:     considered=56  verified=37  surfaced=4

rank 1  26-1501  post=0.88  Rezoning hearing for 1811 East Cesar Chavez to allow liquor sales
        why: location.council_district=3 + priorities[small_business_permitting].weight=0.9

rank 2  26-1306  post=0.65  Ordinance would suspend Atmos Energy gas rate adjustment
        why: priorities[property_taxes].weight=0.9

rank 3  26-1495  post=0.65  Fee waiver for Austin Taiwanese Chamber of Commerce Day
        why: priorities[property_taxes].weight=0.9

rank 4  26-1407  post=0.63  Downtown Public Improvement District would expand to include 360 Nueces St
        why: work.commute_route_keywords overlap + priorities[small_business_permitting].weight=0.9
```

### Maya (D3 renter-parent; housing / transit / public-safety focus)

```
cover_header: "Revere · Thu Apr 9 · 5 items for you"
coverage:     considered=56  verified=37  surfaced=8 (top 5 rendered)

rank 1  26-1501  post=0.53  Rezoning hearing for 1811 East Cesar Chavez to allow liquor sales
        why: location.council_district=3 + priorities[housing_cost].weight=0.9

rank 2  26-1399  post=0.48  $1.3M contract for wastewater and roadway fixes at low-income housing community
        why: priorities[housing_cost].weight=0.9

rank 3  26-1393  post=0.48  Council recesses to convene Austin Housing Finance Corporation board meeting
        why: priorities[housing_cost].weight=0.9

rank 4  26-1354  post=0.46  $7.9M TxDOT grant to install advanced traffic signal vehicle detection citywide
        why: priorities[transit_reliability].weight=0.7

rank 5  26-1448  post=0.45  $401K state grant to continue GoATX truancy prevention project
        why: priorities[police_accountability].weight=0.6
```

## Divergence — the demo's load-bearing assertion

| Metric | Jason | Maya |
|---|---|---|
| cover_header.count | 4 items | 5 items |
| top item | 26-1501 (post=0.88) | 26-1501 (post=0.53) |
| top why_this lens | small_business_permitting | housing_cost |
| unique items | 26-1306, 26-1495 (2) | 26-1399, 26-1393, 26-1354, 26-1448 (6 in candidate set; top 5 rendered) |
| shared items | 26-1501, 26-1407 | 26-1501, 26-1407 (Maya's 26-1407 is rank 6, dropped from top-5) |

**Same meeting. Same 56 candidates. Same 37 verified items.** Two
briefings, materially different in:
- cover-header item count,
- ordered set of items,
- *why* the same item appears (26-1501's why_this is `housing_cost` for
  Maya, `small_business_permitting` for Jason — same item, different
  personal lens, with the fingerprint field-path right there in the trust
  receipt).

The personalization claim is mechanical — provable by reading the two
payloads next to each other. Not narrative, not summarization. Per-fingerprint.

## Composer prompt design

`composer-prompt.ts` enforces six rules via Opus 4.7 + `emit_briefing` tool:
1. Sort by `post_score desc`, tiebreaker `critical_override > score_above_threshold`.
2. Top out at 5 items rendered (Maya had 8 surfaced; rank 6–8 stay in
   `briefing_items` for the in-app feed but don't enter the cover briefing).
3. Cover header format `Revere · {Day} {Mon} {D} · {N} items for you`,
   N matching items[] length.
4. Headline ≤140 chars derived from item.title (strip "Approve",
   trailing parenthetical, leave the substance).
5. **why_this is verbatim from the input briefing_item** — never rewritten.
   The fingerprint-path tie-back is the trust receipt; rewriting would
   launder the explainability.
6. what_happened ≤600 chars, neutral 1–2 sentence summary. No
   editorializing.

Cover header content count matches items[] length on both briefings (4 / 5).

## Cost

```
T-18 (jason + maya): 2 Opus calls, ~$0.10 total
  jason: ~3.5K input + ~1K output  → $0.04
  maya:  ~4.3K input + ~1.3K output → $0.06
```

Inside the $0.30 plan estimate. Per-call user content carries the surfaced
items inline (no caching needed at this scale — only 4–5 surfaced items
per persona).

## Plan divergence

Only one notable: T-18 didn't add a `composer_session_id` to
`payload.trace`. The T-18 run owns its own `agent_sessions` row but the
composer-side write currently leaves `trace.matcher_session_id` as null
because the matcher session ID isn't joined through. T-27 (trust pane)
fills this in once it joins on `briefing_items.created_at` ranges.
Booked into BACKLOG.

## What's persisted

- `briefings` table: 2 rows (`jason`, `maya`) for `briefing_date=2026-04-09`.
- Each row carries the full `payload` JSONB (cover_header, items[],
  coverage, fingerprint_version_used, composer_version, generated_at, trace).
- `briefing_items.rank` is now non-null for the 9 rendered items
  (Jason 4, Maya 5) and remains null for the 3 surfaced-but-not-rendered
  Maya items (rank 6–8).
- `agent_sessions` row id=13 (compose run notes).
