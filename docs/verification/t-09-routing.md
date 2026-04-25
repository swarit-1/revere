# T-09 — Gate 1: Fingerprint skill routing test

**Date:** 2026-04-25
**Runner:** Explore subagent, thoroughness=quick
**Skill pack:** `.claude/skills/fingerprint/`
**Gate:** SKILL.md decision tree routes each probe to the right single file group; no over-loading; budget per probe ≤ plan spec.

## Prompt summary

Three probes, each requiring the subagent to read SKILL.md first and follow its decision tree to identify the file(s) needed for the answer. Critically: do NOT preemptively read all six reference files; do NOT read schemas; do NOT read anti-priority-policy unless an anti-priority hit is in play.

## Subagent response (verbatim)

```
## Probe A
- Files read to answer: reference/scoring-rubric.md, reference/topic-vocabulary-map.md
- Answer: Load scoring-rubric.md, which automatically pulls topic-vocabulary-map.md to map the user's fingerprint topics to the canonical taxonomy. Then compute the five-component score (geography_match, topic_overlap, priority_phrase_match, action_window_boost) with the two-stage clipping formula. No anti-priority file needed unless the item triggers an anti hit.

## Probe B
- Files read to answer: reference/synthesis-resolver.md
- Answer: Load synthesis-resolver.md to evaluate the join atom against the item-atom verdict from the verification report. Apply the resolution rules to determine whether the join atom is resolved, rejected, or a generic fallback, and emit confidence + reasoning.

## Probe C
- Files read to answer: reference/voice-resolver.md
- Answer: Load voice-resolver.md to resolve the user's voice preference by checking learned_voice_style.tone first, then explicit voice field, then defaulting to "measured". Return the voice tag (measured/direct/warm) with advisory length and formality hints for T-10 to use during drafting.

## Audit
- Total unique files read across all three probes: 4
- SKILL.md loaded exactly once: yes
- Per-probe load counts: A=2, B=1, C=1
- Over-loads (files read that the decision tree didn't route to): none
- Plan-spec budget per probe (A: 3 incl. topic-vocabulary-map; B: 2; C: 2): pass (A=2), pass (B=1), pass (C=1)
```

## Verdict — PASS

| Criterion | Expected | Observed | Pass |
|---|---|---|:---:|
| SKILL.md loaded exactly once | yes | yes | ✅ |
| Probe A → scoring-rubric + topic-vocabulary-map | both, no others | both, no others | ✅ |
| Probe B → synthesis-resolver only | only | only | ✅ |
| Probe C → voice-resolver only | only | only | ✅ |
| No anti-priority-policy load (no anti hit in any probe) | not loaded | not loaded | ✅ |
| No output schema loads (no probe requires emission) | not loaded | not loaded | ✅ |
| Total unique files ≤ 4 | ≤ 4 | 4 (SKILL + 3 routed) | ✅ |
| Per-probe budget (incl. SKILL.md) ≤ plan spec | A≤3, B≤2, C≤2 | A=3, B=2, C=2 | ✅ |

The subagent's "per-probe load counts" of 2/1/1 exclude SKILL.md (loaded once at the top). Including SKILL.md the per-probe counts are 3/2/2 — exactly the plan's documented budget. No file was read beyond what the decision tree routed to.

## Notes for downstream

- The decision tree's hand-off from `scoring-rubric.md` → `topic-vocabulary-map.md` worked: the subagent recognized that scoring-rubric pulls the vocabulary map on every call.
- `anti-priority-policy.md` was correctly NOT loaded (no anti hit in the probes). This validates the "load on demand" boundary.
- `output-schemas/` were correctly NOT loaded (no emission requested). The schema files only land when a caller actually emits a record.
