# verification — BACKLOG

Items deliberately deferred from Session 2's T-08 ship. Each has an
owner task or a condition that must be met before it lands.

## Deferred files

| File                                   | Owner          | Why deferred                                                                                                  |
|----------------------------------------|----------------|---------------------------------------------------------------------------------------------------------------|
| `reference/cross-jurisdiction.md`      | T-15 or later  | Verification against TLO (state bills) and Austin Code chapters referenced by ordinance number. Needs a cross-scraper API. |
| `scripts/validate_report.py`           | T-15           | Deterministic JSON-Schema validator that T-15 runs on every report before persisting. Lands when the orchestrator holds code. |
| `reference/video-transcript.md`        | T-11           | Transcript-timestamp verification lives in the ingestion layer; the verifier consumes the raw transcript text T-11 extracts. |
| `reference/fingerprint-handoff.md`     | T-09           | The producer-side shape for synthesis-split join atoms is in `synthesis-split.md`. The consumer-side contract (what T-09 accepts and returns) belongs in the fingerprint skill. |

## Deferred behaviors

- **Diff-across-re-verifications.** Claim-level regression detection
  ("`zoning.staff_recommendation` moved from `supported` to
  `contradicted` after re-scrape"). Stable `claim_id` makes this
  trivial; the differ lives in T-15.
- **Native Managed Agents `Outcomes` integration.** If the research
  preview lands, T-16 re-implements the grader as an Outcomes
  contract. Until then, T-16 is a Messages API call with the same
  rubric.
- **Per-speaker public-comment verification.** Parsing individual
  speakers out of public-comment attachments and verifying their
  claims against the record. T-34 stretch.
- **Confidence calibration against a golden corpus.** Build a
  hand-labeled set of 20–30 items across three meetings and measure
  the verifier's verdict distribution against ground truth. When T-15
  lands and ingestion is running nightly, this becomes the regression
  harness.
- **Token-budget cap per verification pass.** Right now the verifier
  has no hard token ceiling — a pathologically long body could run
  up cost. T-15 should impose a cap and treat overflow as
  `halt_stale`-equivalent (the verifier didn't fail, but the call
  was truncated).
- **Multi-source evidence merging.** A single claim sometimes has
  support from two sources (staff report + ordinance). Current schema
  allows only one `evidence` object per claim. If this shows up in
  practice, add an `evidence[]` array. Not needed for T-06-shape
  records.

## Session-2 shipped (for reference)

- SKILL.md (80 lines, routing-first).
- reference/verifier-prompt.md (~320 lines).
- reference/claim-typology.md (8 claim types, ~140 lines).
- reference/degradation-policy.md (3 failure modes, ~100 lines).
- reference/synthesis-split.md (item-atom / join-atom protocol,
  ~90 lines).
- output-schemas/verification-report.json (JSON Schema Draft 2020-12,
  ~180 lines, python3 json.load clean).
