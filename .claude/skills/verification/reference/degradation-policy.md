# reference/degradation-policy

Load when a verification pass encounters a failure mode that prevents
the normal strategy. The verifier prompt pulls this file on-demand when
these conditions arise, not pre-emptively.

## Three documented failure modes

### 1. Source unreachable

**Trigger.** A source the item references is missing from
`sources_map`, or its fetch metadata carries a non-`"ok"` status in
`sources_reached[].fetch_status` (`timeout`, `http_4xx`, `http_5xx`,
`hash_mismatch`, `other_error`).

**Behavior.** For every claim whose evidence would come from the
unreachable source:
- verdict = `unverifiable`
- `evidence` = `null`
- `note` = "source at sources[N] unreachable: <fetch_status>"
- `remediation` = `promote_source` (the caller should try an alternative
  attachment or re-fetch)

**Never.** Never mark `supported` from general knowledge. Never
fabricate an excerpt. Never guess at the source content.

### 2. Upstream extraction low confidence

**Trigger.** The claim is class `extracted` (a `{value, confidence,
raw_passage}` triple) and the item field's `confidence` is `"low"` or
`null`.

**Behavior.**
- verdict = `unverifiable`
- `evidence` = `null`
- `note` = "upstream extraction confidence insufficient"
- `remediation` = `rewrite` (the upstream skill should re-extract with
  a tighter prompt, or the field should be dropped from the item)

**Rationale.** Promoting a low-confidence extraction through
verification launders uncertainty. A `high`/`medium`-confidence
re-extraction is the only acceptable upstream remediation.

### 3. Stale data

**Trigger.** Either:
- `item.source_hash` does not match a fresh re-hash of
  `sources_map[<item_detail_index>]`, OR
- `item.scraped_at` is more than 24 hours before `verified_at`.

**Behavior.** Halt the pass at the item level.
- `overall_verdict` = `halt_stale`
- `claims` = `[]` (empty — NO per-claim verdicts emitted)
- `freshness_check.stale` = `true`
- `freshness_check.item_scraped_at` and `freshness_check.verified_at`
  populated with both timestamps.
- `coverage` reflects `total_claims: 0` and zero in every bucket.

**Rationale.** The invariant "every verdict in this report is against
fresh source" is the report's most valuable property. A stale-but-
correct verdict launders old data into a fresh-looking report. Force
T-15 to re-scrape before re-verifying.

**Upstream remediation.** T-15 sees `halt_stale` and triggers:
- re-fetch of `sources[0..N]`,
- re-compute of `item.source_hash` in the upstream record,
- re-run of verification against the fresh record.

## Non-degradation invariants

These rules bind the verifier even when nothing is broken:

- **Never general knowledge.** If the source does not carry a claim,
  the claim is not supported — regardless of whether the claim is
  plainly true in the world. Example: the source does not say "Austin
  is in Texas," so a claim that depends on this fact as evidence is
  `unsupported`.
- **Never fabricate an excerpt.** `evidence.source_excerpt` is always
  a verbatim quote from one of the in-scope sources. If no excerpt
  exists, `evidence` must be `null`.
- **Never cross the network.** This skill is a pure function. It does
  not fetch, it does not resolve, it does not re-hash beyond the bytes
  in `sources_map`.
- **Never verify topics.** `topics[]` is opaque. T-16's outcome-grader
  owns that rubric.

## Decision order

When multiple degradation conditions apply, resolve in this order:

1. **Stale first.** If the item is stale, halt before classifying
   anything. No per-claim verdicts.
2. **Low confidence second.** For a claim with both low upstream
   confidence and an unreachable source, low confidence wins
   (`remediation: rewrite`) — rewriting the extraction supersedes
   promoting a new source.
3. **Unreachable source last.** Standard `promote_source` remediation.

This order is deterministic; T-15 depends on it for retry logic.
