# T-21 — Adversarial refinement loop

Three voice variants per (item, persona) — Direct / Measured / Persuasive —
each having survived a sequential critic-and-refiner chain
(council_staffer → opposing_constituent → press_shop). 7 Opus 4.7 calls
per draft request. Gate-zero ran on Jason × 26-1501 + Maya × 26-1501;
both passed all five gate rules.

## Pipeline

```
writer (1 call → 3 variants)
   ↓
critic[0] = council_staffer  ← refiner  (2 calls)
   ↓
critic[1] = opposing_constituent  ← refiner  (2 calls)
   ↓
critic[2] = press_shop  ← refiner  (2 calls)
   ↓
3 final DraftVariants (one per voice) + critique_trail of length 3
```

## Gate-zero rules

For each persisted variant:

1. **References Legistar item id** — every variant cites `26-1501` (and
   case `C14-2025-0080`, and the §25-2-812 / §25-2-284 / LGC §211.006
   procedural cites) at the top.
2. **Ties back to a persona-specific stake** —
   * Jason: small-business operator, walks corridor, residential-abutter
     concern.
   * Maya: District 3 renter, procedural posture (petition +
     supermajority + staff denial), housing-piece argument.
3. **Differs in register** — Direct is short and unhedged; Measured is
   balanced with one acknowledgement; Persuasive opens with a vignette
   and uses one rhetorical device.
4. **3-entry critique_trail** — staffer / constituent / press_shop, in
   that order, each with non-empty issues + remediation + refiner
   response.
5. **≤ 360 words** — all six variants under cap.

All five rules pass for both personas.

## Word counts (per variant)

| persona | direct | measured | persuasive |
|---|---|---|---|
| Jason   | 162 | 313 | 268 |
| Maya    | 136 | 289 | 302 |

Voice contrast holds: Direct is consistently the shortest, Persuasive
the longest, Measured in between with a longer hedged middle.

## Stake contrast (same item, two people)

**Jason × 26-1501 — Direct opening:**
> Re: Item 26-1501, C14-2025-0080 at 1811 East Cesar Chavez Street.
> Mayor and Council Members, please deny this rezoning. Keep
> CS-MU-CO-NP in place. The applicant wants CS-1-CO-NP. That adds
> Liquor Sales as a permitted primary use under §25-2-812.
> ... I run a small business. I walk this corridor most mornings.
> The rear property line of 1811 abuts residential lots.

**Maya × 26-1501 — Direct opening:**
> Re: Item 26-1501 / Case C14-2025-0080, 1811 East Cesar Chavez.
> A valid opposition petition has been filed. Under LGC §211.006
> this vote requires a nine-vote supermajority. Staff recommends
> denial. Please vote no.
> ... I live in District 3 and rent here.

Same item. Two people. Two stakes (small-business hours-and-buffer
vs. procedural-and-housing). Two distinct drafts. This is the
demo's load-bearing argument carried into the action flow.

## Critic trail spot-check (Jason Direct)

Three passes, each accepting some critiques and defending the voice:

1. **council_staffer**: 4 issues (1 high / 1 medium / 2 low),
   remediation `accept_some`. Refiner response: "hedged the
   staff-recommendation claim, qualified petition validity, swapped
   the colloquial line; defended the short cap and unhedged register."
2. **opposing_constituent**: 3 issues (1 high / 2 medium),
   remediation `accept_some`. Refiner response: "named concrete
   off-premise harms (hours, loading, single-serve), engaged the
   Commission's reasoning; kept the procedural mention."
3. **press_shop**: 4 issues (2 medium / 2 low), remediation
   `accept_some`. Refiner response: "removed misstated staff
   recommendation, replaced conclusory line with site-condition
   statement; kept short sentence cap and binary lede."

Each pass concretely changed the draft AND explicitly defended the
voice register. No collapse to a single average register.

## Cost

| persona | input | output | cache_create | cache_read | calls | approx $ |
|---|---|---|---|---|---|---|
| Jason   | 29,268 | 15,327 | 4,600 | 0 | 7 | ~$0.55 |
| Maya    | 33,936 | 15,109 | 0     | 0 | 7 | ~$0.55 |
| **Total** | **63,204** | **30,436** | **4,600** | **0** | **14** | **~$1.10** |

Well within the $3 plan ceiling. Cache_create is small because the
system prompt (with all three voice specs) is the cached block; cache
hit on the second persona didn't apply because the per-item content
changes the user message.

## Architecture notes

- **Single chain, three-voice payload**: writer + each critic + each
  refiner all process the 3 voices in lockstep. Cuts call count from
  21 (three independent chains) to 7 per draft request.
- **`response_to_critique` carries the refiner's editorial logic** as
  one line, persisted into `critique_trail[i].response`. The DraftModal
  surfaces this so the user can see *why* the draft is the way it is,
  not just what the critics flagged.
- **agent_sessions integration**: each `extract:draft` run opens a
  `runtime: drafter` row, finishes with cost summary in `notes` —
  the same trust-surface the trace modal reads from.
- **No silent fallback**: if the model returns a tool_use missing a
  voice or an empty issues array, the loop throws. The schema's
  `minItems: 3` and `minItems: 1` catch this at the API layer.

## Remaining BACKLOG

- **T-21.5** — Per-fingerprint pre-bake at compose time: when T-18
  composes a briefing, kick off draft generation for the top-N items
  in the background so clicks render instantly. Today: drafts only
  exist for the seeded pair (Jason, Maya × 26-1501).
- **T-21.6** — Surface partially_supported claims in the draft modal
  as a banner ("This draft mentions a claim the verifier flagged as
  partial — review carefully"). The writer already filters to
  `verdict=='supported'`, but the modal should *also* warn the user.
