# fingerprint — BACKLOG

Items deliberately deferred from Session 3's T-09 ship.

## Deferred files

| File / feature | Owner | Why deferred |
|---|---|---|
| `reference/watch-list.md` + `watch_list` field on canonical type | Post-hackathon | Interaction with anti-priorities, override semantics, UI for managing the list — all need design before code. Trivial single-field add later, real complexity to add now. |
| `reference/longitudinal-learning.md` (writes `learned_voice_style`) | T-21 follow-up | Computing voice style from edit patterns is its own concern; T-09 only reads. |
| `reference/cross-fingerprint-matching.md` | Post-hackathon | Multi-user mode (PRD §25). Group/household briefings, federated stats. |
| `reference/diff-policy.md` | T-15 stretch | Re-scoring open briefings on fingerprint edit. v1 is going-forward only; daily cadence absorbs changes. |

## Deferred behaviors

- **Watch list** — explicit standing items the user always wants regardless
  of score (PRD §20 hint). Defer entirely; not in canonical type yet.
- **Longitudinal voice learning** — writing `learned_voice_style` from edit
  patterns. T-09 reads only.
- **Multi-user / household scoring** — federated fingerprints, group
  briefings.
- **Re-scoring open briefings on fingerprint edit** — out of v1 by policy
  (going-forward only). T-15 owns the orchestration if we ever flip the
  policy.
- **Privacy-preserving aggregate scoring** — federated stats once we have
  multiple users.
- **Fingerprint conflict detection** — flag internally inconsistent
  fingerprints (e.g., `housing.status: "renter"` AND
  `housing.unit_type: "single-family detached owned house"`). Out of scope
  for T-09; onboarding (T-29) is the right place.
- **Score caching** — repeated (user × item) scoring is currently a fresh
  call every time. T-15 may add a cache keyed on `{user_id, item_id,
  fingerprint_version_used, item.source_hash}` so identical inputs return
  the same score without recomputation.

## Session-3 shipped (for reference)

- SKILL.md (90 lines, routing-first).
- reference/scoring-rubric.md (~180 lines) — two-stage formula,
  threshold table, surface decision, why_this construction, worked
  numerical examples.
- reference/topic-vocabulary-map.md (~85 lines) — 35 mappings.
- reference/anti-priority-policy.md (~110 lines) — soft penalty +
  pre-penalty critical override.
- reference/synthesis-resolver.md (~180 lines) — consumer side of
  Session 2 handoff with confidence triple.
- reference/voice-resolver.md (~90 lines) — fingerprint → voice tag.
- reference/validation-policy.md (~120 lines) — required vs.
  required-conditional + graceful degradation.
- output-schemas/relevance-score.json (~120 lines, 15 required).
- output-schemas/synthesis-resolution.json (~80 lines, 7 required).
