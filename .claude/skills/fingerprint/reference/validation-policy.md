# reference/validation-policy

Load when validating an inbound fingerprint, either as a standalone
call or as the first step before scoring. Every successful T-09
output carries a `fingerprint_validation` block; this file defines
its semantics.

## Required fields (refuse-to-score if absent)

| Field                | Default if absent                         |
|----------------------|-------------------------------------------|
| `user_id`            | none — refuse                             |
| `priorities[]`       | none — empty array IS valid; null refuses |
| `relevance_slider`   | `"balanced"` (don't refuse)               |

These three plus a parseable root structure are the minimum. Without
`user_id` the score has no key. Without `priorities[]` the user has
done no onboarding (but an empty array is a valid pre-onboarding
state). Without `relevance_slider` we apply the documented default
rather than refuse.

## Required-conditional fields (degrade, don't refuse)

| Field                                | Behavior when null/missing                                    |
|--------------------------------------|---------------------------------------------------------------|
| `location.council_district`          | `geography_match := 0`; `why_this` notes "(geography unscored — district unknown)" |
| `housing.status`                     | synthesis resolver returns `generic_fallback` for joins that depend on it |
| `anti_priorities`                    | absent/empty → `anti_priority_hit := 0`; penalty zero out     |
| `learned_voice_style`                | voice resolver returns `measured` default                     |
| `work.commute_mode`, `commute_route_keywords` | synthesis resolver returns `generic_fallback` for commute joins |
| `household[]`                        | empty array OK; certain personal-relevance joins (school, kids) generic_fallback |

Each degraded dimension is recorded in
`fingerprint_validation.degraded_dimensions` so T-17 can log it.

## Refuse-to-score conditions

The skill returns a `fingerprint_validation_error` shape (NOT a
relevance score) and stops:

- Root payload not parseable as the canonical type
  (`packages/shared/src/types/fingerprint.ts`).
- `user_id` missing or empty.
- `priorities` field is `null` (vs. `[]` which is valid).
- `relevance_slider` present but not in
  `{"strict", "balanced", "broad"}` (typo case; refuse rather than
  default — the user explicitly tried to set it and failed).
- `priorities[].weight` is outside `[0, 1]` for any entry.

Error shape:

```
{
  valid: false,
  error_type: "missing_required" | "malformed" | "invalid_value",
  parse_errors: [string],
  user_id: <if available> | null
}
```

T-15's loop logs this and skips scoring for the user this run.

## Successful validation block

Every successful T-09 output (relevance_score or
synthesis_resolution) carries:

```
fingerprint_validation: {
  valid: true,
  missing_fields: [string],          // required-conditional fields that were null
  degraded_dimensions: [string],     // which scoring components were affected
  defaults_applied: [
    { field: "relevance_slider", default: "balanced", reason: "absent" }
  ]
}
```

`missing_fields` is a flat list of field paths that were null/absent.
`degraded_dimensions` is the list of which scoring components were
zeroed or fell back (e.g., `["geography_match", "topic_overlap"]` if
the user had no district and no priorities). `defaults_applied`
records every place T-09 substituted a default for an absent value.

T-27's trust pane uses this block to render legible "we scored X but
couldn't score Y because…" explanations. T-17 uses it for nightly
trace logs.

## Sanity checks (warn but don't refuse)

These produce a warning in `defaults_applied` with `reason:
"sanity_check"` but do not block scoring:

- All `priorities[].weight == 1.0` — the user marked everything max
  important, which compresses the rubric. Score normally; T-17 logs.
- More than 10 entries in `priorities[]` — onboarding flow probably
  failed to deduplicate. Score normally.
- `anti_priorities` has more entries than `priorities` — possible
  but unusual; score normally.
- `learned_voice_style.tone` doesn't match `{measured, direct, warm}`
  — voice resolver falls through to next branch (explicit `voice`
  field, then `measured` default).

## What this file does NOT validate

- **Truth of values.** Whether the user actually rents, actually
  lives in D3, actually has a kid in Zavala — out of scope. T-09
  trusts the self-report.
- **Cross-field consistency.** A user could carry
  `housing.status = "renter"` AND
  `housing.unit_type = "single-family detached owned house"` —
  internally contradictory, but the skill doesn't flag it. The
  onboarding flow (T-29) is responsible for catching this at write
  time.
- **Topic vocabulary membership.** Whether each `priorities[].topic`
  string appears in `topic-vocabulary-map.md` — that's the rubric's
  concern at scoring time, not validation's. Topics not in the map
  fall through to `priority_phrase_match` rather than being refused.
