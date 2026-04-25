# reference/anti-priority-policy

Load when an item triggers an anti-priority hit during scoring (i.e.,
`anti_priority_hit == 1` in `scoring-rubric.md`). Not loaded otherwise.

## The one-line rule

Anti-priorities are a **soft penalty (−0.40 in `post_score`) plus a
critical-override threshold evaluated against the pre-penalty score
(`pre_score ≥ 0.85`)**. Never a hard suppressor on hit alone.

## Why pre-penalty for the override

The post-penalty score with full clipping maxes at `1.0 − 0.40 = 0.60`.
A critical-override threshold of 0.85 against `post_score` would be
mathematically unreachable. So the override is a separate predicate
that checks `pre_score` (the score BEFORE the anti penalty is
applied).

`pre_score ≥ 0.85` means: the item hits geography, topic_overlap,
priority_phrase_match, and action_window strongly enough that all
the positive signals together approach the cap, before anti is even
considered. That's the right bar for "this item is too important to
suppress just because it brushes an anti-tag."

## The full surface decision (repeated from scoring-rubric.md)

```
surface iff (
  (anti_priority_hit == 0 AND post_score >= threshold)
  OR
  (anti_priority_hit == 1 AND pre_score >= 0.85)   // critical override
)
```

When `anti_priority_hit == 1` AND `pre_score < 0.85`:
- `surfaced = false`
- `surface_reason = "anti_priority_suppressed"`
- Item is dropped from the briefing entirely; the user sees nothing
  about it.

When `anti_priority_hit == 1` AND `pre_score >= 0.85`:
- `surfaced = true`
- `surface_reason = "critical_override"`
- Item surfaces with a `why_this` that **explicitly acknowledges the
  anti-interest** (see below).

## Match detection

Anti-priority match is **semantic, not literal**. LLM judgment, not
substring search.

Examples:
- `anti_priorities = ["dog_parks"]` matches "approve dog park
  expansion at Holly District site." MATCH.
- `anti_priorities = ["dog_parks"]` matches "downtown park
  improvement project." NOT a match — generic park, not a dog park.
- `anti_priorities = ["sister_city_proclamations"]` matches "approve
  proclamation honoring sister city Toulouse." MATCH.
- `anti_priorities = ["ceremonial_proclamations"]` matches "approve
  proclamation honoring sister city Toulouse" AND any other
  proclamation. Broad match; that's the user's choice when they wrote
  the broad anti-tag.

The match is per-item. An item either hits or it doesn't; there's no
"partial anti-hit." Multiple anti-tag matches count as one hit
(`anti_priority_hit ∈ {0, 1}`).

## `why_this` requirement when override fires

When `surface_reason == "critical_override"`, the `why_this` field
MUST explicitly acknowledge the anti-tag the user gets surfaced
despite. This is a trust requirement: the user gave the skill a
no-fly list, and the skill is overriding it. The user must see that
the skill knew about the no-fly entry and made an informed decision.

Format: `"critical_override despite anti_priorities[<tag>] — <signal summary> (pre_score=<value>)"`.

Examples:
- `"critical_override despite anti_priorities[dog_parks] — location.council_district=3 + imminent vote + priority_phrase_match (pre_score=0.88)"`
- `"critical_override despite anti_priorities[ceremonial_proclamations] — pre_score=0.85 from priorities[housing_cost] match"`

If the `why_this` for an override case fails to mention the anti-tag
explicitly, the score is invalid — the schema's regex enforces a
field-path reference but the override-acknowledgment is a softer
content check that the running matcher (T-17) should validate before
persisting.

## Cardinal rules

- **Anti hits never auto-promote a sub-threshold item.** They only
  block surfacing OR allow it via override. The override does not
  lower the threshold; it's a separate predicate that bypasses the
  threshold-comparison branch entirely.
- **A user with no `anti_priorities`** (absent or empty array) gets
  `anti_priority_hit = 0` always. The penalty term zeros out and the
  score is the standard threshold comparison.
- **The penalty (−0.40) and the override threshold (0.85) are tuned
  together.** Do not change one without re-tuning the other; the
  fixture corpus exists to catch unintended drift.

## Edge case — multiple users, same item

The verdict (surface vs. suppress) is per (user × item), not per item.
The same item can surface for User A (no anti hit, score above
threshold) and suppress for User B (anti hit, score below override
bar) on the same nightly run. T-17's loop runs the rubric per user.
This file describes only the single-pair logic.
