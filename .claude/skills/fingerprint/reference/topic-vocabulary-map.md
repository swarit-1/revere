# reference/topic-vocabulary-map

The canonical map between fingerprint-legible topic strings (what
users say in voice onboarding and read back in their settings) and
the Session 1 taxonomy enum (what items carry in `item.topics[]`).
Loaded by `scoring-rubric.md` on every scoring call.

This file is also the **inverse-map ground truth** for T-29 voice
onboarding, which translates voice-recorded preferences ("I care
about my kid's school") into a fingerprint topic string. Don't fork.

## Hard rule

If a fingerprint topic maps to `null`, it is NOT silently dropped.
The `priority_phrase_match` channel in `scoring-rubric.md` catches it
via free-text semantic match against the item title and body. The
user's stated priority always reaches the score; what changes is which
channel.

## The map

| Fingerprint topic           | Taxonomy category         | Channel                                  |
|-----------------------------|---------------------------|------------------------------------------|
| `housing_cost`              | `housing`                 | topic_overlap                            |
| `rent_burden`               | `housing`                 | topic_overlap                            |
| `affordability`             | `housing`                 | topic_overlap                            |
| `displacement`              | `housing`                 | topic_overlap                            |
| `homelessness`              | `housing`                 | topic_overlap                            |
| `commercial_zoning`         | `commercial-regulation`   | topic_overlap                            |
| `tabc_rules`                | `commercial-regulation`   | topic_overlap                            |
| `liquor_licensing`          | `commercial-regulation`   | topic_overlap                            |
| `outdoor_seating`           | `commercial-regulation`   | topic_overlap                            |
| `small_business_permitting` | `commercial-regulation`   | topic_overlap                            |
| `signage_rules`             | `commercial-regulation`   | topic_overlap                            |
| `transit_reliability`       | `transportation`          | topic_overlap                            |
| `bike_infrastructure`       | `transportation`          | topic_overlap                            |
| `walkability`               | `transportation`          | topic_overlap                            |
| `parking_policy`            | `transportation`          | topic_overlap                            |
| `mobility`                  | `transportation`          | topic_overlap                            |
| `police_accountability`     | `public-safety`           | topic_overlap                            |
| `apd_oversight`             | `public-safety`           | topic_overlap                            |
| `body_camera_policy`        | `public-safety`           | topic_overlap                            |
| `emergency_response`        | `public-safety`           | topic_overlap                            |
| `downtown_safety`           | `public-safety`           | topic_overlap                            |
| `property_taxes`            | `budget`                  | topic_overlap                            |
| `tax_rate`                  | `budget`                  | topic_overlap                            |
| `homestead_exemption`       | `budget`                  | topic_overlap                            |
| `utility_rates`             | `budget`                  | topic_overlap                            |
| `parkland`                  | `land-use`                | topic_overlap                            |
| `historic_preservation`     | `land-use`                | topic_overlap                            |
| `tree_protection`           | `land-use`                | topic_overlap                            |
| `watershed`                 | `land-use`                | topic_overlap                            |
| `school_quality`            | `null`                    | priority_phrase_match (AISD jurisdiction)|
| `childcare_access`          | `null`                    | priority_phrase_match                    |
| `library_funding`           | `null`                    | priority_phrase_match                    |
| `parks_programming`         | `null`                    | priority_phrase_match                    |
| `senior_services`           | `null`                    | priority_phrase_match                    |

## Lookup protocol

Given a fingerprint priority `{topic: "...", weight: ...}`:

1. Look up `topic` in the left column.
2. If found and the right column is a taxonomy enum → score via
   `topic_overlap` against `item.topics[]`.
3. If found and the right column is `null` → the priority does not
   contribute to `topic_overlap`. It is still considered live for
   `priority_phrase_match` (free-text semantic match in the rubric).
4. If NOT found in this map → treat as if mapped to `null` (live
   for priority_phrase_match) AND record in
   `fingerprint_validation.degraded_dimensions` so T-29 onboarding can
   propose adding the topic to the canonical vocabulary in a future
   release.

## When this map gets edited

- A new jurisdiction is added (post-hackathon: Pflugerville ISD,
  county, etc.). Add new fingerprint topics on the left where
  meaningful; map most to existing taxonomy categories or `null`.
- A taxonomy category is added or renamed (e.g., `commercial-regulation`
  splits into `alcohol_regulation` + `outdoor_use`). Update the right
  column.
- Voice onboarding (T-29) surfaces a recurring topic not in this map
  (logged in `degraded_dimensions`). Add it.

The map is intentionally additive: never remove a fingerprint topic
that real users have on their fingerprints. Mark deprecated mappings
as `null` first, then remove only after a migration sweep.
