---
name: fingerprint
description: |
  Use when interpreting a civic fingerprint to score a verified item, resolve a
  synthesis-split join atom from the verification skill, pick a drafting voice
  for T-10, or validate an inbound fingerprint. Callers: T-17 (matcher), T-18
  (briefing synthesis), T-10 (drafting), the verification skill (via
  defer_to_fingerprint remediation). Pure function: performs no Supabase calls
  or network I/O — the caller supplies the fingerprint object.
---

# Fingerprint — Interpretation & Scoring

This file is the entry point. Route by the question you're answering, then
load only the file(s) that question points to. Scoring, synthesis resolution,
voice resolution, and validation are SEPARATE calls — never load all six
reference files as a set.

## Decision tree

1. **Score an item against a fingerprint?** → `reference/scoring-rubric.md`
   (entry; pulls `topic-vocabulary-map.md` and, if the item triggers an
   anti hit, `anti-priority-policy.md`).
2. **Resolve a synthesis join atom from the verification skill's
   `defer_to_fingerprint` remediation?** → `reference/synthesis-resolver.md`.
3. **Pick a drafting voice for T-10?** →
   `reference/voice-resolver.md`.
4. **Validate an inbound fingerprint?** →
   `reference/validation-policy.md`.
5. **Emit a record?** → `output-schemas/relevance-score.json` for scoring,
   `output-schemas/synthesis-resolution.json` for synthesis.

## Scope

- **Input.** A `Fingerprint` object (canonical type:
  `@packages/shared/src/types/fingerprint.ts`, matching PRD §8.2) plus a
  call-specific payload: a verified `item.json`, a list of synthesis join
  atoms, or nothing (for voice / validation).
- **Output.** A `relevance_score`, a `synthesis_resolution`, a voice tag,
  or a `fingerprint_validation` block — depending on the call.
- **Pure function.** No Supabase access. No network. The caller supplies
  the fingerprint and any associated payload.

## Hard rules (six)

1. **Never score without a `why_this` explanation** that references at
   least one fingerprint field by path (e.g.
   `priorities[housing_cost].weight=0.9`). ≤200 chars. The schema
   enforces it; do not bypass.
2. **Anti-priority enforcement = soft penalty + pre-penalty critical
   override.** Never hard-suppress on anti hit alone. See
   `anti-priority-policy.md`.
3. **Topic-overlap channel uses the canonical taxonomy enum only.**
   Fingerprint topics that don't map → fall through to
   `priority_phrase_match` (free-text channel). Never silently dropped.
   Map lives in `topic-vocabulary-map.md`.
4. **Read `learned_voice_style`; do not write or compute it.**
   Longitudinal learning lives in T-21 follow-up; this skill only reads.
5. **Graceful degradation, not refuse-to-score.** Missing
   `location.council_district` zeros geography_match. Missing
   `priorities[]` zeros topic_overlap and priority_phrase_match.
   Missing `relevance_slider` defaults to `balanced`. Malformed root
   refuses (returns a `fingerprint_validation_error`).
6. **No callbacks.** This skill does not call the verification skill,
   does not open jurisdiction taxonomy files, does not access
   fingerprint persistence (Supabase). Synthesis flow is unidirectional:
   verification → fingerprint → T-18 composes.

## Validation summary

`user_id`, `priorities[]`, `relevance_slider` are required (slider
defaults to `balanced` if absent). `location.council_district`,
`housing.status`, `anti_priorities`, `learned_voice_style` are
required-conditional with documented degradation per
`validation-policy.md`. Every successful output carries a
`fingerprint_validation: {valid, missing_fields, degraded_dimensions}`
block so T-17 can log trace metadata.

## Divergences from PRD §8 + §9

Twelve divergences recorded in `@docs/plans/session-3-fingerprint-skill.md`.
Highlights: slider thresholds set at 0.65/0.55/0.40; anti-priority
critical override evaluated against pre-penalty score (post-penalty
maxes at 0.60 with full clipping); structured `learned_voice_style`
triple `{tone, length_preference, formality}`; voice resolution lives
here, not in T-10; `why_this` is a required field; synthesis resolution
adds `confidence` and a `generic_fallback` state; watch list deferred
to BACKLOG. Score going forward only on fingerprint edits — Supabase
stamps `fingerprint.updated_at`, T-17 stamps `fingerprint_version_used`
on every briefing item.
