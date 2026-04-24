---
name: verification
description: |
  Use when checking whether the factual claims in an Austin City Council
  briefing item (or any jurisdiction ingestion record with the same shape)
  are actually supported by their cited source material. Produces a
  verification_report with per-claim verdicts (supported, partially_supported,
  unsupported, contradicted, unverifiable) and an item-level overall_verdict
  (pass_clean, pass_with_caveats, fail, halt_stale). Pure function: performs
  no network I/O — source bytes are supplied by the caller.
---

# Verification — Claim-by-claim source check

This file is the entry point. Route by the question you're answering; load
ONLY the file(s) that question points to. The verifier prompt is the
primary working reference — the other files are consulted on-demand from
within the prompt as situations arise, not pre-loaded as a set.

## Decision tree

1. **Running a full verification pass on an item?** →
   `reference/verifier-prompt.md`. It drives the whole protocol and pulls
   the other reference files when needed.
2. **Need to classify a single claim you're unsure about?** →
   `reference/claim-typology.md` (stand-alone; eight claim types with
   verification strategy per type).
3. **Source unreachable, upstream confidence low, or item stale?** →
   `reference/degradation-policy.md`.
4. **Claim mentions "you" or the user's fingerprint?** →
   `reference/synthesis-split.md` for the item-atom / join-atom protocol.
5. **Emitting a report?** → `output-schemas/verification-report.json` is
   the canonical shape.

## Scope

- **Input.** `(item, sources_map)` where `item` conforms to the
  austin-city-council `item.json` schema and `sources_map` is a dict
  `{source_index: raw_text}` where keys index into `item.sources[]`.
- **Output.** A `verification_report` conforming to
  `output-schemas/verification-report.json`.
- **Jurisdictions covered in v1.** `austin-city-council`. Other
  jurisdictions plug in once their ingestion records match the
  `item.json` shape.
- **This skill performs NO network I/O.** All source bytes come from the
  caller. The caller (T-15 running loop) owns fetching, hashing, and
  freshness checks; this skill is a pure function.

## Hard rules (non-negotiable — six, not five, not seven)

1. **Never fabricate evidence.** If a source can't be reached (missing
   from `sources_map`, fetch failed, hash mismatch): verdict
   `unverifiable` + `remediation: promote_source`. Never mark `supported`
   from general knowledge.
2. **Verdicts are exactly one of five.** `supported | partially_supported
   | unsupported | contradicted | unverifiable`. No other values.
3. **Upstream low confidence is `unverifiable`.** A claim backed by an
   item field with `confidence: "low"` or `confidence: null` receives
   verdict `unverifiable` with `remediation: rewrite`. Do not launder
   low-confidence extractions into `supported`.
4. **Stale data halts the pass.** If `item.source_hash` does not match a
   fresh re-hash, or `item.scraped_at` is > 24h before `verified_at`:
   emit `overall_verdict: halt_stale` with `claims: []` and a populated
   `freshness_check`. Do not produce claim verdicts against stale data.
5. **Synthesis claims split into item + join atoms.** Personal-relevance
   claims (second-person, fingerprint-dependent) split per
   `synthesis-split.md`. The item atom gets a real verdict from this
   skill; the join atom gets `unverifiable` + `remediation:
   defer_to_fingerprint`.
6. **Topic classification is not verified here.** `topics[]` is opaque
   metadata. T-16's outcome-grader owns that rubric. Do not load
   taxonomy files from inside this skill.

## Divergences from PRD §11.1

Six divergences, all recorded in
`@docs/plans/session-2-verification-skill.md`: added `unverifiable`
verdict; four-tier `overall_verdict` with `halt_stale`; synthesis-split
protocol; pure-function contract (no network); topics deferred to T-16;
stable json-path `claim_id`s.
