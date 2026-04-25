# reference/scoring-rubric

Load when scoring an item against a fingerprint. Pulls
`topic-vocabulary-map.md` for every call. Pulls
`anti-priority-policy.md` only when the item triggers an anti hit.

## The two-stage formula

The rubric computes two scores. Both are clipped to `[0, 1]`.

```
pre_score = clip(
    0.30 * geography_match
  + 0.30 * topic_overlap
  + 0.25 * priority_phrase_match
  + 0.15 * action_window_boost,
  0, 1
)

post_score = clip(pre_score - 0.40 * anti_priority_hit, 0, 1)
```

`pre_score` is what the critical-override path checks against.
`post_score` is what gets sorted/displayed and compared against the
slider threshold. Two scores because the post-penalty score with full
clipping maxes at 0.60 (1.0 − 0.40), which would make any
critical-override threshold unreachable. Pre-penalty 0.85 is the right
bar for "the item hits everything before anti is even considered."

## The five components

### `geography_match` ∈ {0, 1}

- `1` if the item's `location.council_district` matches the user's
  `location.council_district` (D1–D10 number equality).
- `1` if the item is citywide (`council_district = 0`) AND has a
  direct downstream effect on the user's district (rare; require
  evidence in item body).
- `0` otherwise.

If the user's `location.council_district` is `null`, `geography_match`
is forcibly `0` and the `why_this` must include
`"(geography unscored — district unknown)"`.

### `topic_overlap` ∈ [0, 1]

For each `priority` in the user's fingerprint:
1. Look up the priority's `topic` in `topic-vocabulary-map.md`. Result:
   a taxonomy enum (`housing | transportation | public-safety | budget |
   land-use | commercial-regulation`) OR `null`.
2. If a taxonomy enum, check whether the item's `topics[]` array
   contains it. If yes, this priority contributes `priority.weight` to
   the numerator.
3. If `null`, this priority contributes nothing to `topic_overlap`. It
   stays alive in the `priority_phrase_match` channel below.

Final `topic_overlap` = `sum(matching_weights) / sum(all_priority_weights)`.

If `priorities[]` is empty, `topic_overlap = 0` (degraded; flag in
`fingerprint_validation.degraded_dimensions`).

### `priority_phrase_match` ∈ {0, 1}

`1` if any priority phrase semantically matches the item's title or
body (LLM judgment, not literal substring). Two cases trigger this:
- Priorities whose topic mapped to `null` in
  `topic-vocabulary-map.md` (e.g., `school_quality`,
  `childcare_access` for an Austin Council item — they have no
  taxonomy category; this channel catches them).
- Priorities whose mapped category didn't appear in
  `item.topics[]` but whose phrasing matches the body anyway (catches
  items where the upstream classification missed a topic).

`0` otherwise.

### `action_window_boost` ∈ {0, 1}

- `1` if `meeting_date` is within 7 days of `verified_at`, OR
- `1` if `hearing_details.comment_deadline` (when present) is within
  48 hours, OR
- `1` if `status == "Agenda Ready"` AND `meeting_date` is within
  7 days.
- `0` otherwise.

The boost models "this is decision-imminent" — a vote tomorrow on a
mid-priority item beats an already-decided high-priority item from
last week.

### `anti_priority_hit` ∈ {0, 1}

`1` if any phrase in `anti_priorities[]` semantically matches the
item's title or body. Match is LLM judgment, not literal substring
("dog parks" matches "approve dog park expansion" but not "downtown
park improvement").

If `anti_priorities[]` is absent or empty, this is forcibly `0`.

When `anti_priority_hit == 1`, ALSO load
`anti-priority-policy.md` for the override decision.

## Threshold table (from the relevance_slider)

```
threshold = {
  "strict":   0.65,
  "balanced": 0.55,
  "broad":    0.40
}[fingerprint.relevance_slider || "balanced"]
```

## Surface decision

```
surface iff (
  (anti_priority_hit == 0 AND post_score >= threshold)
  OR
  (anti_priority_hit == 1 AND pre_score >= 0.85)   // critical override
)
```

The `surface_reason` field on the emitted record records which path
fired:
- `score_above_threshold` — normal path, no anti hit, post_score met
  threshold.
- `critical_override` — anti hit but pre_score ≥ 0.85.
- `anti_priority_suppressed` — anti hit AND pre_score < 0.85.
- `below_threshold` — no anti hit AND post_score < threshold.

## `why_this` construction

Every emitted score must carry a `why_this` string. Rules:
- ≤ 200 characters.
- MUST contain at least one substring matching a fingerprint field
  path (e.g., `location.council_district=3`,
  `priorities[housing_cost].weight=0.9`,
  `anti_priorities[dog_parks]`).
- When `surface_reason == "critical_override"`, MUST explicitly
  acknowledge the anti hit (see `anti-priority-policy.md`).
- When the score includes degraded dimensions (e.g., null
  `council_district`), MUST note the degradation.

Examples:
- `"location.council_district=3 + priorities[housing_cost].weight=0.9 hit via topic_overlap on housing"`
- `"location.council_district=3 + critical_override despite anti_priorities[dog_parks] (pre_score=0.88)"`
- `"priority_phrase_match on priorities[school_quality] (geography unscored — district unknown)"`

The `why_this` is what gets rendered in T-18's "why this matters to
you" tie-back. The hard requirement is what makes the personalization
claim verifiable.

## Worked numerical examples

**Maya × File #26-1501 (1811 East Cesar Chavez rezoning, D3):**
- `geography_match = 1` (D3 = D3)
- `topic_overlap`: `housing_cost` weight 0.9 maps to `housing`,
  item has `["housing","commercial-regulation"]` → matches; sum of
  matching weights = 0.9; sum of all weights ≈ 3.5 → `0.9 / 3.5 ≈ 0.26`
- `priority_phrase_match = 1` (item body mentions corridor, displacement
  language)
- `action_window_boost = 1` (meeting date within 7 days)
- `anti_priority_hit = 0`
- `pre_score = clip(0.30·1 + 0.30·0.26 + 0.25·1 + 0.15·1, 0, 1) = clip(0.30 + 0.08 + 0.25 + 0.15, 0, 1) = 0.78`
- `post_score = 0.78`, threshold (balanced) = 0.55 → **surface**.
- `why_this`: `"location.council_district=3 + priorities[housing_cost].weight=0.9 + imminent vote"`

**Sister-city proclamation × Maya (anti hit):**
- `geography_match = 0` (citywide, no D3-specific effect)
- `topic_overlap = 0` (no priority maps)
- `priority_phrase_match = 0`
- `action_window_boost = 1` (on the 4/9 agenda)
- `anti_priority_hit = 1` (`sister_city_proclamations` matches)
- `pre_score = 0.15`, `post_score = max(0.15 − 0.40, 0) = 0`
- `pre_score 0.15 < 0.85` → no critical override → **suppress**.
- `surface_reason = "anti_priority_suppressed"`.

**Critical-override case × hypothetical Maya-variant (`dog_parks` in anti):**
- A dog-park expansion in D3 with imminent vote AND priority_phrase
  match on a co-located housing concern in the item body:
- `pre_score = 0.30 + 0.30·0.4 + 0.25·1 + 0.15·1 = 0.85`
- `anti_priority_hit = 1` → `post_score = 0.45`
- `pre_score 0.85 ≥ 0.85` → **critical override fires** → surface.
- `why_this`: `"critical_override despite anti_priorities[dog_parks] — location.council_district=3 + imminent vote + priority_phrase_match (pre_score=0.85)"`
