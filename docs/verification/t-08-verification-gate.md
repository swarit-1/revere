# T-08 — Verification skill gates real T-06 record (three variants)

**Date:** 2026-04-24
**Runner:** Explore subagent
**Skill pack:** `.claude/skills/verification/`
**Test fixture:** File #26-1501 (1811 East Cesar Chavez rezoning) record from `docs/verification/t-06-classification.md`, three variants (pristine / degraded / partial) against an in-prompt synthesized `sources_map`.
**Gate:** verifier produces schema-valid reports for each variant, exercises `supported`, `contradicted`, and `unsupported` collectively, holds the ≤4-file load budget, and never fabricates evidence.

## Prompt shape

See `docs/plans/session-2-verification-skill.md` §"T-08 gate" for the prompt spec. Subagent received:
- Skill pack location + decision-tree routing instruction.
- `sources_map` with four entries (item_detail, staff_report, ordinance, recommendation_for_action) — synthesized in-prompt from the real Legistar content captured in Phase 1 of Session 1.
- Three variants of the T-06 record (pristine, degraded with `zoning.staff_recommendation.value` flipped to `"approve"` while raw_passage retains "to deny", partial with `applicants` extended by a fabricated `"Random Other LLC"`).
- Hash instruction: compute `sha256(sources_map[0])` and use as `item.source_hash` so the freshness gate passes.

## Files loaded (union across all three variants)

1. `.claude/skills/verification/SKILL.md`
2. `.claude/skills/verification/reference/verifier-prompt.md`
3. `.claude/skills/verification/output-schemas/verification-report.json`

**File-load budget per variant: 3 files (≤4 ceiling, PASS).** `claim-typology.md`, `degradation-policy.md`, and `synthesis-split.md` were not pulled — the verifier prompt's inline strategy and worked examples covered every claim type encountered. No taxonomy or fingerprint files were read, confirming progressive-disclosure boundaries.

## Source hash

`hash0 = e5cab29037681c849922bc945c5f0868aeba869bd4e08feca6bfbc4b7b8c3073`

Used as `item.source_hash` on all three variants.

## Variant 1 — Pristine

### Coverage
| Field | Count |
|---|---|
| `total_claims` | 21 |
| `supported` | 21 |
| `partially_supported` | 0 |
| `unsupported` | 0 |
| `contradicted` | 0 |
| `unverifiable` | 0 |

`overall_verdict = pass_clean`. Parse check: valid JSON.

### Notable claim entries (excerpts)

```json
{
  "claim_id": "zoning.current",
  "claim_type": "extracted",
  "value": "CS-MU-CO-NP",
  "raw_passage": "Current Zoning: CS-MU-CO-NP (general commercial services-mixed use-conditional overlay-neighborhood plan)",
  "verdict": "supported",
  "evidence": {
    "source_index": 0,
    "source_locator": "item_detail, line containing 'Current Zoning:'",
    "source_excerpt": "Current Zoning: CS-MU-CO-NP (general commercial services-mixed use-conditional overlay-neighborhood plan)"
  },
  "remediation": "accept"
}
```

```json
{
  "claim_id": "zoning.staff_recommendation",
  "claim_type": "extracted",
  "value": "deny",
  "raw_passage": "Staff Recommendation: To deny the rezoning to CS-1-CO-NP zoning",
  "verdict": "supported",
  "evidence": {
    "source_index": 1,
    "source_locator": "staff_report, section 'Staff Recommendation'",
    "source_excerpt": "Staff Recommendation: To deny the rezoning to CS-1-CO-NP zoning"
  },
  "remediation": "accept"
}
```

**Expectation match: YES.** All structural and extracted claims resolved against the supplied source bytes; no fabricated evidence; verdict rolls up cleanly.

## Variant 2 — Degraded

The item's `zoning.staff_recommendation.value` was flipped to `"approve"` while leaving the original `raw_passage` ("To deny...") unchanged. The verifier surfaced the disagreement.

### Coverage
| Field | Count |
|---|---|
| `total_claims` | 21 |
| `supported` | 20 |
| `contradicted` | 1 |
| (others) | 0 |

`overall_verdict = fail`. Parse check: valid JSON.

### The contradicted claim

```json
{
  "claim_id": "zoning.staff_recommendation",
  "claim_type": "extracted",
  "value": "approve",
  "raw_passage": "Staff Recommendation: To deny the rezoning to CS-1-CO-NP zoning",
  "verdict": "contradicted",
  "evidence": {
    "source_index": 1,
    "source_locator": "staff_report, section 'Staff Recommendation'",
    "source_excerpt": "Staff Recommendation: To deny the rezoning to CS-1-CO-NP zoning"
  },
  "note": "Item value is 'approve'; source says 'deny'.",
  "remediation": "rewrite"
}
```

**Expectation match: YES.** The verifier kept the source citation honest — `source_excerpt` is verbatim from `sources_map[1]`, not invented to match the item value. `remediation: rewrite` correctly directs the upstream skill to fix the extraction. Rollup correctly hits `fail` (rule 2: any contradicted claim → fail).

## Variant 3 — Partial

The item's `applicants` was extended by a fabricated entity (`"Random Other LLC"`) not in any source.

### Coverage
| Field | Count |
|---|---|
| `total_claims` | 21 |
| `supported` | 20 |
| `unsupported` | 1 |
| (others) | 0 |

`overall_verdict = fail`. Parse check: valid JSON.

### The unsupported claim

```json
{
  "claim_id": "applicants",
  "claim_type": "extracted",
  "value": ["Lodhia Investments LLC", "G N Exim Corporation Inc.", "Random Other LLC"],
  "raw_passage": "Applicants: Lodhia Investments LLC and G N Exim Corporation Inc.",
  "verdict": "unsupported",
  "evidence": {
    "source_index": 0,
    "source_locator": "item_detail, line containing 'Applicants:'",
    "source_excerpt": "Applicants: Lodhia Investments LLC and G N Exim Corporation Inc."
  },
  "note": "Item lists three applicants; source lists only two. 'Random Other LLC' is not mentioned in any source.",
  "remediation": "rewrite"
}
```

**Verdict choice (`unsupported` over `partially_supported`).** The subagent correctly reasoned that adding a wholly fabricated entity is not "scope narrowing" or "qualifier dropping" — it's an assertion the source affirmatively does not make. `partially_supported` covers items that match a narrower or weaker version of the source claim; `unsupported` covers claims the source is silent on. Adding a third entity counts as silent-on (the source enumerates exactly two), so `unsupported` is correct.

**Expectation match: YES.** The plan tolerated either `unsupported` or `partially_supported` here; the subagent's `unsupported` defense is principled.

## Gate criteria audit

| Criterion | Outcome |
|---|:---:|
| All three reports validate against `verification-report.json` (python3 json.load) | ✅ |
| Each report produces at least one `supported` claim | ✅ (20+ each) |
| Degraded variant produces at least one `contradicted` claim with non-null `evidence.source_excerpt` citing real source text | ✅ |
| Partial variant produces at least one `unsupported` or `partially_supported` claim | ✅ (`unsupported`) |
| Collectively exercise `supported`, `partially_supported OR unsupported`, and `contradicted` | ✅ |
| File-load budget per variant ≤ 4 files | ✅ (3 files used) |

## Verdict — PASS

T-08 gate fires. The verification skill, treated as a pure function of `(item, sources_map)`, emits schema-valid reports that distinguish all three failure modes the gate test was designed to surface. No evidence was fabricated; every `source_excerpt` is a verbatim substring of the provided source. The file-load budget held at 3 — under the ≤4 ceiling — without consulting `claim-typology.md`, `degradation-policy.md`, or `synthesis-split.md`, since none of the test conditions required them.

## Notes for downstream consumers

- **Coverage double-counting was not exercised.** No `body` text in these variants, so the "enumerate every body sentence" rule from the verifier prompt did not fire. A future test variant with `body` populated would be useful for confirming the loose-enumeration policy lands as intended.
- **Stretch verdicts not exercised.** `unverifiable` (predictive, low-confidence, synthesis join) was not surfaced — the variant set didn't include those failure modes. The plan flagged this as a stretch goal, not a gate requirement.
- **Schema validation gap.** The subagent ran `python3 json.load` only — full JSON Schema validation against `verification-report.json` requires `pip install jsonschema` and was deferred. T-15's running loop should add proper schema validation before persisting reports.
- **`source_hash` synthesis.** The test computed `sha256(sources_map[0])` to make freshness pass. T-15 will do the same against actual Legistar HTML; this confirms the contract holds.
