---
name: elections
description: |
  Use when scoring election items, classifying candidate-promise authority,
  or composing election-mode briefings. Pure-function reasoning; the
  caller supplies fingerprint + promise + office definition.
---

# Elections — Authority + Materiality

Revere's election mode is **never partisan**. It does not predict
winners, score ideology, recommend a candidate, or aggregate
endorsements. It does:

- Show the user races on their actual ballot.
- Show each candidate's verified promises with source proof.
- Classify whether the office can actually deliver each promise.
- Score promise relevance to the user's fingerprint.

That last triple — verified, scoped, personally relevant — is the
trust differentiator.

## Authority taxonomy (the load-bearing differentiator)

Every promise is classified into one of five tiers. The classification
is paired with a sourced rationale (≤ 240 chars).

- `direct_authority` — The office has explicit, unilateral power
  over the promise's subject. Examples: a city council member
  promising to vote on a specific zoning case; an AISD trustee
  promising to revise district graduation requirements.
- `partial_authority` — The office can move the lever some, but
  the outcome depends on other actors. Examples: a council member
  promising "lower rents" (can pass tenant protections + push
  zoning, can't set rent); a state rep promising "fully funded
  schools" (can vote on Foundation School Program but governor /
  comptroller / other chambers also decide).
- `indirect_influence` — The office is in the conversation but not
  in the decision. Examples: a council member promising "improve
  TABC rules" (TABC is state); a state rep promising to "fix
  Austin's homelessness response" (city operates the response).
- `outside_office_scope` — The promise sits in a different
  branch / level / agency entirely. Examples: a council candidate
  promising to "abolish ICE" (federal); a school board candidate
  promising to "lower property tax rates" (taxing entities, not
  schools, set those rates).
- `too_vague_to_assess` — No actionable mechanism described.
  Examples: "support our community," "fight for working
  families," "make government work for you."

The taxonomy is non-judgmental — `partial_authority` and
`indirect_influence` are common and not necessarily bad. The
classification is a *trust signal to the user*, not a verdict on the
candidate.

## Specificity (orthogonal axis)

A promise can be specific + outside scope (rare and unhelpful) or
vague + direct authority (common and frustrating). Specificity
captures this:

- `specific` — names a vote, a number, a deadline, or a measurable
  outcome. "Vote no on the CS-1-CO-NP rezone at 1811 East Cesar
  Chavez."
- `general` — names a direction without a measurement. "Push for
  more affordable housing on the corridor."
- `vague` — captures a feeling without a direction. "Listen to
  residents on housing."

## Scoring inputs (per race + per promise)

For race-level relevance:
- `jurisdiction_match`: 0|1 — does the user's district intersect
  the race's district?
- `topic_overlap`: 0..1 — sum of weighted overlaps between the
  user's priorities and the race's promise topics.
- `action_window_boost`: 0|1 — election within 30 days?

For promise-level relevance (used to rank promises within a
candidate's column on the comparison surface):
- `topic_overlap`: 0..1 — same as above, scoped to one promise.
- `authority_factor`: 1.0 (direct) | 0.6 (partial) | 0.3 (indirect)
  | 0.0 (outside) | 0.1 (vague — gives some signal but discounted).
- `specificity_factor`: 1.0 (specific) | 0.6 (general) | 0.3 (vague).

The composite `post_score = topic_overlap × ((authority_factor +
specificity_factor) / 2)` gives ordered relevance per promise.

## Hard rules

- Never compute a "best candidate" score. The composite is for
  ordering one user's view of one candidate's promises — never to
  rank candidates against each other.
- Never store partisan labels on candidates without a corresponding
  source. If a candidate self-describes, that goes in the source
  excerpt, not a column.
- Every promise must have a verified source URL + verbatim excerpt
  ≤ 240 chars. The excerpt has to support the promise text.
- Authority classification has a sourced rationale tied to the
  office's explicit charter / statute. If unsure, classify as
  `too_vague_to_assess` rather than guessing.
- Election mode UI never displays "AI says vote for X." It shows
  "here's what they said, here's what the office can actually do,
  here's why it might matter to you."

## Output schema

The classifier emits per-promise:

```ts
{
  promise_id: string,
  authority: PromiseAuthority,
  authority_rationale: string,  // ≤ 240 chars, sourced
  specificity: PromiseSpecificity,
}
```

The race-relevance + promise-relevance scorers are pure functions
over (fingerprint, race, promise) → number. Trace the score back
to fingerprint clauses with the same `why_this` discipline as
governance items.
