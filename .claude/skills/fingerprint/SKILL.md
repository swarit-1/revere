---
name: fingerprint
description: |
  How to interpret a civic fingerprint and score a candidate briefing item
  against it. Use when ranking items for a specific user (Maya, Jason, or
  any recruited user), deciding what to surface vs. suppress, or explaining
  why an item was chosen.
---

# Civic Fingerprint — Interpretation & Scoring

A civic fingerprint is a structured representation of what a specific
constituent cares about: topics, geographies, identities, lived experiences,
and anti-priorities (things they explicitly don't want surfaced).

## Fingerprint shape

See `@packages/shared/types/fingerprint.ts` for the canonical type. At minimum:

- `districts` — council districts the user lives/works/organizes in.
- `topics` — weighted topic tags (e.g. `housing:0.9`, `policing:0.3`).
- `priorities` — free-text phrases the user said matter to them.
- `anti_priorities` — free-text phrases the user said do NOT matter, or
  actively turn them off.
- `voice` — preferred drafting tone (`measured` | `direct` | `persuasive`).

## Relevance-scoring rubric

Score each candidate item on a 0–1 scale using this weighted sum, clipped to
`[0, 1]`:

- **Geography match** (0.30) — item affects a district in `districts`, or
  citywide with direct downstream effect on one.
- **Topic overlap** (0.30) — normalized cosine of item topic tags vs.
  `topics`.
- **Priority phrase match** (0.25) — semantic hit on any `priorities` phrase.
- **Anti-priority penalty** (−0.40) — subtract if any `anti_priorities` phrase
  semantically matches. This is a hard suppressor: a strong anti-priority hit
  should drop the item below the threshold regardless of other signals.
- **Action-window boost** (0.15) — item has an imminent decision point
  (vote within 7 days, public comment deadline within 48h).

Threshold: surface items scoring ≥ 0.55. Below that, suppress unless the user
has an explicit standing interest (a "watch list" topic, not yet modeled in
v1 — see PRD §20).

## Anti-priority rules

Anti-priorities are **stricter than priorities**. A clear anti-priority match
should always suppress the item, even if geography and topic scores are high.
The briefing's job is to earn trust by not wasting attention. A false positive
here (surfacing something the user said they don't want) costs more than a
false negative.

## Explanation requirement

Every surfaced item must carry a one-line "why this" explanation referencing
the fingerprint component that drove the surface (e.g. "District 4 +
standing housing priority"). No explanation → don't surface. This is what
makes the fingerprint legible to the user and debuggable to us.

## Hard rules

- Never surface an item that hits any `anti_priorities` phrase.
- Never surface an item without a `why_this` explanation.
- Never score on fingerprint data the user hasn't actually given. If a field
  is empty, treat its weight as zero — don't infer.
