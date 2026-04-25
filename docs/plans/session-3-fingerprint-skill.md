# Session 3 — Fingerprint skill (T-09)

## Context

Session 1 shipped item ingestion. Session 2 shipped per-item verification with a synthesis-split protocol whose **producer** side emits join atoms tagged `defer_to_fingerprint`. This session ships the **consumer** side: the interpreter for civic fingerprints. T-09 is the rubric, the synthesis resolver, and the voice picker — used at runtime by T-17 (matcher), T-18 (briefing synthesis), and T-10 (drafting).

The existing stub at `.claude/skills/fingerprint/SKILL.md` (67 lines, written pre-Session-1) is wrong on every field name (uses `districts`/`topics` instead of PRD §8.2's `location.council_district`/`priorities[].topic`) and contradicts itself on anti-priorities (says "never surface" AND "−0.40 penalty"). Full rewrite.

## Divergences from PRD §8 + §9 (matches Session 1/2 table format)

All twelve divergences have explicit approval from Phase 1.

| Divergence | PRD says | Session 3 ships | Why |
|---|---|---|---|
| Existing stub field names | n/a | Full rewrite to match PRD §8.2 + `packages/shared/src/types/fingerprint.ts` | Stub field names contradict the canonical type. |
| Slider thresholds | Not specified | strict 0.65 / balanced 0.55 / broad 0.40 | Strict at 0.70 puts a textbook obvious-match item at 0.75 — right at the cliff. 0.65 leaves an honest margin. |
| Anti-priority enforcement | "unless 'critical override'" (§9.4) | Soft penalty −0.40 in `post_score` + critical-override at **pre-penalty** `pre_score ≥ 0.85`. Surface iff `(no anti_hit AND post_score ≥ threshold) OR (anti_hit AND pre_score ≥ 0.85)`. | Computing critical override against pre-penalty score keeps the math reachable (post-penalty maxes at 0.60 with full clipping). Pre-penalty 0.85 is "this hits practically every dimension." |
| Score formula clipping | Not specified | `pre_score = clip(0.30·g + 0.30·t + 0.25·p + 0.15·a, 0, 1)`; `post_score = clip(pre_score − 0.40·anti_hit, 0, 1)` | Two clip steps so we have both a sortable post_score and a reachable critical-override pre_score. |
| `learned_voice_style` shape | "evolves from user edits" (§8.4); structure unspecified | Structured triple `{tone: "measured" \| "direct" \| "warm", length_preference: "concise" \| "thorough", formality: "casual" \| "neutral" \| "formal"}` | Concrete shape T-10 can consume. `tone` is load-bearing; the other two are advisory in v1. |
| Fingerprint diff handling | Not specified | Score going forward only. Stamp `fingerprint.updated_at` in Supabase + `fingerprint_version_used` on every briefing item. | Briefings are daily and ephemeral; daily cadence absorbs changes. Version stamp gives T-27's trust pane a "why did I see this yesterday" handle. |
| Topic vocabulary | PRD §8.2 examples use fine-grained topics (`housing_cost`, `school_quality`, `childcare_access`); Session 1 taxonomy uses 6 categories (`housing`, `transportation`, ...) | T-09 owns a topic-to-category map in `reference/topic-vocabulary-map.md`. Fingerprint topics with no taxonomy match → `null` → score via `priority_phrase_match` (free-text channel) instead of `topic_overlap` (structured channel). Never silently dropped. | Keeps fingerprint legible to the user; lets onboarding (T-29) use the inverse map. |
| Voice resolution boundary | Not specified | T-09's voice resolver picks the tag from fingerprint + learned style; T-10 takes the tag and loads the matching voice file. | Drafting decoupled from fingerprint internals. T-21's adversarial writer agent stays small. |
| `why_this` field | "explicitly tied back to one or more fingerprint bullets" (§9.2) | **Required** field on every relevance-score record. ≤200 chars. Must reference at least one fingerprint field by path (e.g. `location.council_district=3`, `priorities[housing_cost].weight=0.9`). | Hard requirement, not advisory. The personalization claim is unverifiable without it; T-27's trust pane has nothing to render. |
| Synthesis resolution shape | Implied 2-state | 3-state `{resolved \| rejected \| generic_fallback}` + `confidence: high \| medium \| low`. Full grounding → high; partial grounding (some fingerprint fields null) → medium/low. | Mirrors the {value, confidence, raw_passage} triple shape Session 1/2 use everywhere. T-18 chooses to render personal framing only when `confidence == high`. |
| Watch list (PRD §20 hint) | "explicit standing items" | Deferred to BACKLOG.md. Not in canonical type. | Strict YAGNI — interaction with anti-priorities, override semantics, UI all need design before code. Trivial to add later. |
| Validation policy | Not specified | Required: `user_id`, `priorities[]` (may be empty), `relevance_slider` (defaults to `balanced` if missing). Required-conditional with graceful degradation: `location.council_district`, `housing.status`, `anti_priorities`. Malformed root → error report, no scoring. | Real users have partial onboarding. Score-with-degradation beats refuse-to-score; flag the degradation in `fingerprint_validation` block on every output. |

## Directory tree (what Session 3 ships)

```
.claude/skills/fingerprint/
├── SKILL.md                              # REWRITE — routing + invariants + validation summary
├── BACKLOG.md                            # NEW — watch_list, longitudinal learning, future
├── reference/
│   ├── scoring-rubric.md                 # NEW — formula, weights, thresholds, slider semantics
│   ├── topic-vocabulary-map.md           # NEW — legible-topic ↔ taxonomy-category map (canonical)
│   ├── anti-priority-policy.md           # NEW — soft penalty + pre-penalty critical override
│   ├── synthesis-resolver.md             # NEW — consumer side of Session 2's handoff
│   ├── voice-resolver.md                 # NEW — fingerprint → voice tag for T-10
│   └── validation-policy.md              # NEW — required-vs-optional + graceful degradation
└── output-schemas/
    ├── relevance-score.json              # NEW — score record T-17 persists
    └── synthesis-resolution.json         # NEW — resolution record T-18 consumes
```

10 files total (1 SKILL.md + 6 reference + 2 schemas + BACKLOG). Heaviest skill yet.

## File-by-file specs

### `SKILL.md` (rewrite, ≤80 lines)

**Frontmatter description.** Opens with "Use when..." Names the three callers (T-17 matcher, T-18 synthesis composer, verification skill via synthesis-split). Notes pure-function contract (no Supabase calls; caller supplies the fingerprint).

**Body.** Five-question decision tree:
1. "Score an item against a fingerprint?" → `reference/scoring-rubric.md` (entry; pulls topic-vocabulary-map and anti-priority-policy on demand)
2. "Resolve a synthesis join atom from the verification skill?" → `reference/synthesis-resolver.md`
3. "Pick a drafting voice for T-10?" → `reference/voice-resolver.md`
4. "Validate an inbound fingerprint?" → `reference/validation-policy.md`
5. "Emit a record?" → `output-schemas/relevance-score.json` or `output-schemas/synthesis-resolution.json`

**Hard rules (six, lock-step with the verification skill's ruleset):**
1. Never score without a `why_this` explanation that references at least one fingerprint field by path.
2. Anti-priority enforcement: soft penalty + pre-penalty critical override. Never hard-suppress on anti hit alone.
3. Topic-overlap channel uses the canonical taxonomy enum only. Fingerprint topics that don't map → fall through to `priority_phrase_match`.
4. T-09 reads `learned_voice_style`; it does not write or compute it. Longitudinal learning lives elsewhere.
5. Graceful degradation: missing `location.council_district` zeros geography_match, doesn't refuse. Missing `priorities[]` zeros topic_overlap and priority_phrase, doesn't refuse. Malformed root refuses.
6. Pure function. No Supabase calls inside this skill. The caller supplies the fingerprint.

**Divergences pointer** to this plan.

### `reference/scoring-rubric.md` (~120 lines)

Mechanical + judgment. Loaded on every scoring call.

- **Pre-penalty score formula** with the four weighted components (geography 0.30, topic_overlap 0.30, priority_phrase_match 0.25, action_window_boost 0.15) and what each measures.
- **Post-penalty score:** `pre_score − 0.40·anti_hit` then clipped.
- **Threshold table:** strict 0.65, balanced 0.55, broad 0.40. Default to balanced when slider missing.
- **Surface decision:** the explicit `(no anti_hit AND post_score ≥ threshold) OR (anti_hit AND pre_score ≥ 0.85)` boolean with worked numerical examples (Maya housing rezoning: pre 0.85, post 0.85 → surface; sister-city proclamation with anti hit: pre 0.10, post 0 → suppress; etc.).
- **`why_this` construction protocol:** which fingerprint fields contributed, by what amount, in human-readable form. Enforces ≤200 chars and at-least-one-field-path-reference.
- **Cross-references:** topic_overlap consults `topic-vocabulary-map.md`; anti-priority logic consults `anti-priority-policy.md`.

### `reference/topic-vocabulary-map.md` (~60 lines)

Mechanical reference. Canonical map between fingerprint-legible topic strings and the Session 1 taxonomy enum.

- Two-column table: fingerprint topic (left, free-text users say in voice onboarding) → taxonomy category (right, `housing | transportation | public-safety | budget | land-use | commercial-regulation | null`).
- Examples from PRD §8.2:
  - `housing_cost` → `housing`
  - `transit_reliability` → `transportation`
  - `school_quality` → `null` (AISD jurisdiction; not Austin council taxonomy) — falls through to priority_phrase_match
  - `police_accountability` → `public-safety`
  - `childcare_access` → `null` — falls through
  - `property_taxes` → `budget`
  - `commercial_zoning` → `commercial-regulation`
  - `tabc_rules` → `commercial-regulation`
  - `downtown_safety` → `public-safety`
- Hard rule: any topic mapped to `null` MUST be matched via `priority_phrase_match` (semantic match against item title/body) so the user's stated priority isn't silently dropped.
- Inverse-map note: this file is also the ground truth for T-29 onboarding's voice → topic picker. Don't fork.

### `reference/anti-priority-policy.md` (~70 lines)

Mechanical + judgment.

- **The one-line rule:** soft penalty −0.40 in `post_score`; critical-override threshold `pre_score ≥ 0.85`.
- **Why pre-penalty for override:** post-penalty score with full clipping maxes at 0.60 (1.0 - 0.40); critical override at 0.85 would be unreachable. Pre-penalty 0.85 means "the item hits geography + topic + priority_phrase + action_window all-in" before the anti is even considered.
- **Match detection:** semantic (LLM judgment), not literal string match. "dog parks" anti matches "approve dog park expansion" but not "downtown park improvement."
- **`why_this` requirement when override fires:** must explicitly acknowledge the anti-interest. Worked example: "Surfacing despite your noted anti-interest in `dog_parks` because this item is in your district AND has an imminent vote AND matches your `housing_cost` priority directly."
- **Cardinal rules:** anti hits never auto-promote a sub-threshold item to surface; they only block surfacing. Override doesn't lower the threshold; it's a separate predicate.

### `reference/synthesis-resolver.md` (~80 lines)

Judgment guidance. Consumer side of Session 2's `synthesis-split.md` protocol.

**Input contract** (matches the producer side from Session 2):
```
{
  fingerprint: Fingerprint,
  joins: [
    {
      claim_id: string,                // verbatim from verification report
      claim_text: string,              // the join atom's wording
      item_atom_verdict: "supported" | "partially_supported" |
                         "unsupported" | "contradicted" | "unverifiable"
    }
  ]
}
```

**Output:** array of `{claim_id, resolution, confidence, reason, fingerprint_evidence}` per `output-schemas/synthesis-resolution.json`.

**Resolution rules:**
- If `item_atom_verdict ∈ {contradicted, unsupported}` → `resolution: "rejected"`, `confidence: "high"`, no fingerprint check needed (item failed verification; don't render personal framing on top).
- Else parse the join atom's claim_text for fingerprint-field references:
  - Identify the fingerprint field paths the claim asserts (e.g., "you rent in D3" → `housing.status`, `location.council_district`).
  - Check fingerprint values for each path:
    - All paths populated AND values consistent with claim → `resolved`, `confidence: "high"`.
    - Some paths populated AND consistent, others null → `resolved`, `confidence: "medium"` or `"low"` depending on how many.
    - Any populated path inconsistent with claim → `rejected`, `confidence: "high"`.
    - All paths null → `generic_fallback`, `confidence: "low"`.

**`fingerprint_evidence`** carries the populated field path(s) and value(s) the resolver consulted, so T-18's trust pane can render the join with attribution.

**Worked examples** (3): "you rent in D3" with full fingerprint, partial fingerprint, contradicting fingerprint.

### `reference/voice-resolver.md` (~50 lines)

Judgment.

- **Output:** a voice tag `{voice: "measured" | "direct" | "warm", length_preference, formality}` that T-10 consumes to load a voice file.
- **Resolution order:**
  1. If `learned_voice_style.tone` is populated, use it.
  2. Else if there's an explicit `voice` field at fingerprint root, use it.
  3. Else default to `measured`.
- `length_preference` and `formality` pulled from `learned_voice_style` if present; null otherwise.
- T-10's contract: voice file selection routes only on `tone`; the other two are advisory hints.
- Note: T-09 doesn't COMPUTE the learned style — that's a longitudinal-learning concern. It only reads.

### `reference/validation-policy.md` (~70 lines)

Mechanical.

- **Required fields** (refuse-to-score if absent):
  - `user_id`
  - `priorities` array (may be empty)
  - `relevance_slider` (default `"balanced"` if absent rather than refuse)
- **Required-conditional** (degrade, don't refuse):
  - `location.council_district` null → geography_match := 0; `why_this` notes "(geography unscored — district unknown)"
  - `housing.status` null → synthesis-resolver returns `generic_fallback` for joins that depend on it
  - `anti_priorities` absent or empty → anti-priority terms zero out
  - `learned_voice_style` null → voice-resolver returns `measured` default
- **Malformed root** (not parseable as the canonical type) → return a `fingerprint_validation_error` report shape with `valid: false`, `parse_errors: string[]`, no scoring.
- **`fingerprint_validation` block** on every successful output: `{valid: true, missing_fields: string[], degraded_dimensions: string[]}`. T-17 logs this for trace metadata.

### `output-schemas/relevance-score.json` (~150 lines)

JSON Schema Draft 2020-12. Fields:
- `user_id`, `item_id`, `scored_at`, `scorer_version: "v1"`, `fingerprint_version_used` (the `fingerprint.updated_at` timestamp from Supabase).
- `pre_score`, `post_score`, `threshold_used`, `slider_value`.
- `surfaced: boolean`, `surface_reason: "score_above_threshold" | "critical_override" | "below_threshold" | "anti_priority_suppressed"`.
- `breakdown: {geography_match, topic_overlap, priority_phrase_match, action_window_boost, anti_priority_hit}` (each in [0,1]).
- `topic_overlap_detail: [{fingerprint_topic, mapped_taxonomy: string|null, weight, contribution, matched_via: "topic_overlap"|"priority_phrase_match"}]`.
- `why_this: string` — required, ≤200 chars, must contain at least one substring matching `^[a-z_]+(\.[a-z_]+)*$` (a field-path reference).
- `fingerprint_validation: {valid, missing_fields, degraded_dimensions}`.

### `output-schemas/synthesis-resolution.json` (~80 lines)

JSON Schema Draft 2020-12.
- Top-level: `user_id`, `verification_report_id` (joins back to T-08 output), `resolved_at`, `resolutions[]`.
- Per resolution: `claim_id`, `resolution: "resolved"|"rejected"|"generic_fallback"`, `confidence: "high"|"medium"|"low"`, `reason`, `fingerprint_evidence: [{field_path, value}]|null`.

### `BACKLOG.md` (~30 lines)

| File / behavior | Owner | Why deferred |
|---|---|---|
| `reference/watch-list.md` + `watch_list` field on type | Post-hackathon | Interaction with anti-priorities + override semantics + UI all need design. Trivial single-field add later. |
| Longitudinal learning loop (writes `learned_voice_style`) | T-21 follow-up | Computing voice style from edits is its own concern; T-09 only reads. |
| Cross-fingerprint matching (group/household briefings) | Post-hackathon | Multi-user mode (PRD §25). |
| Fingerprint diffs / re-scoring open briefings | T-15 stretch | Going-forward only is the v1 policy. |
| Privacy-preserving aggregate scoring | Post-hackathon | Federated stats once we have multiple users. |

## Progressive-disclosure audit

Most-common path (T-17 nightly score per (user × item)) loads **3 files**. Anti-priority path loads **4**. Other paths all load **2 or 3**. The 10-file skill never loads more than 4 in a single call.

| Query | Files loaded | Count |
|---|---|---|
| "Score an item against a fingerprint" (T-17 nightly, no anti hit) | SKILL.md + scoring-rubric.md + topic-vocabulary-map.md | 3 |
| "Score an item, anti-priority hits" | SKILL.md + scoring-rubric.md + topic-vocabulary-map.md + anti-priority-policy.md | 4 |
| "Resolve a synthesis join atom" (verification handoff) | SKILL.md + synthesis-resolver.md | 2 |
| "Pick a drafting voice" (T-10 query) | SKILL.md + voice-resolver.md | 2 |
| "Validate a fingerprint before scoring" | SKILL.md + validation-policy.md | 2 |
| "Emit a relevance-score record" (paired with score path) | + output-schemas/relevance-score.json | +1 (4 total in worst case) |
| "Emit a synthesis-resolution record" (paired with resolver path) | + output-schemas/synthesis-resolution.json | +1 (3 total) |

**Critical routing rule** (encoded in SKILL.md): scoring, synthesis resolution, voice resolution, and validation are SEPARATE calls, each with its own minimal load set. The skill is not pre-loaded as a unit. The single highest-volume path (T-17 nightly scoring) loads 3 files.

**Failure modes to prevent:**
| Failure | Symptom | Prevention |
|---|---|---|
| Skill pre-loads all 6 reference files | 7 files in context | SKILL.md decision tree explicitly routes by question, not by pre-load. |
| Voice resolver loads scoring-rubric.md | +1 unnecessary file | voice-resolver.md is self-contained; doesn't reference rubric. |
| Synthesis resolver loads anti-priority-policy.md | +1 unnecessary file | synthesis-resolver.md doesn't score; it only reads fingerprint fields. |
| T-09 calls back into verification skill | Cross-skill recursion | SKILL.md hard rule: T-09 doesn't call verification. Synthesis flow is unidirectional. |
| T-09 reads taxonomy files | Bleeds into Austin skill | topic-vocabulary-map.md owns the mapping; T-09 never opens taxonomy files. |

## T-09 gates

Two gates, both required to pass before T-09 closes.

### Gate 1 — Routing test (mirrors T-05 + T-08 routing tests)

Fresh Explore subagent. Three probes:

1. *"Score this item against Maya's fingerprint."* → expected loads: `SKILL.md` + `scoring-rubric.md` + `topic-vocabulary-map.md` (3 files).
2. *"This briefing has a synthesis join atom. Resolve it."* → expected loads: `SKILL.md` + `synthesis-resolver.md` (2 files).
3. *"Maya is drafting a public comment. What voice should T-10 use?"* → expected loads: `SKILL.md` + `voice-resolver.md` (2 files).

Pass: each routes correctly with no over-loading. Save transcript to `docs/verification/t-09-routing.md`.

### Gate 2 — Fixture-corpus scoring test (THE load-bearing gate)

A fixture corpus of **5 hand-curated items × 2 personas (Maya, Jason) = 10 score outputs**, with expected score ranges locked in `docs/verification/t-09-scoring-fixtures.md`. Subagent runs the scoring rubric against each pair and confirms scores fall in the expected ranges.

**The five fixtures:**

| # | Item | Designed to test | Maya expected | Jason expected |
|---|---|---|---|---|
| 1 | File #26-1501: 1811 East Cesar Chavez rezoning (CS-MU-CO-NP → CS-1-CO-NP, D3) | Obvious match for both — same district, both have housing-adjacent priorities | post_score 0.80–0.95, surfaced, threshold=balanced (0.55) | post_score 0.65–0.85, surfaced, threshold=balanced |
| 2 | Item 43: Downtown Austin PID expansion (commercial-regulation, D9) | Obvious match for Jason (commercial_zoning + tabc_rules + downtown_safety priorities); weak for Maya | post_score 0.20–0.35, NOT surfaced | post_score 0.70–0.85, surfaced |
| 3 | Hypothetical: "Approve sister-city proclamation honoring Toulouse, France" | Anti-priority hit for Maya (`sister_city_proclamations` in her anti list); not in Jason's anti list | post_score < 0.10 (anti hit + low pre_score), suppressed via anti path | post_score 0.05–0.15, NOT surfaced (sub-threshold) |
| 4 | Hypothetical: "Approve dog park expansion at Holly District site, D3" — engineered so the anti hits AND the pre-penalty score reaches 0.85 (geography + land-use partial topic_overlap + priority_phrase via "Holly" matching her D3 + imminent vote) | Critical override case for Maya (`dog_parks` in her anti); should surface despite anti via the override path | pre_score 0.85+, post_score ~0.45, **surfaced via critical_override**; why_this acknowledges the anti | post_score 0.30–0.45, NOT surfaced (no anti hit but sub-threshold) |
| 5 | Real or constructed: Austin Water FY27 rate schedule adoption (budget, citywide) | Ambiguous mid-range for both | post_score 0.45–0.55 (right at balanced threshold) | post_score 0.50–0.60 (right at balanced threshold) |

For each pair, the subagent emits a `relevance-score` record per the schema and confirms:
- `post_score` falls in the expected range.
- `surfaced` matches expectation.
- `surface_reason` matches the expected path (`score_above_threshold` / `critical_override` / `below_threshold` / `anti_priority_suppressed`).
- `why_this` contains at least one fingerprint field-path reference and is ≤200 chars.
- `fingerprint_validation.valid: true`.

**Pass criteria:** all 10 pairs validate against `relevance-score.json`, all 10 fall in expected ranges, fixture #4 surfaces via `critical_override` exactly. Save transcript + emitted JSON to `docs/verification/t-09-scoring-fixtures.md` (this file IS the fixture corpus + the test transcript — they live together so future regression checks are self-contained).

## Execute order (Phase 3)

Each step ends with a commit using `T-09:` prefix.

1. **Scaffold** — `mkdir -p` directory tree, touch empty placeholders. Commit `T-09: create fingerprint skill pack scaffold` (also lands this plan).
2. **SKILL.md** — rewrite. Commit `T-09: skill entry point loads`.
3. **scoring-rubric.md** — Commit `T-09: add scoring rubric`.
4. **topic-vocabulary-map.md** — Commit `T-09: add topic vocabulary map`.
5. **anti-priority-policy.md** — Commit `T-09: add anti-priority policy`.
6. **synthesis-resolver.md** — Commit `T-09: add synthesis resolver`.
7. **voice-resolver.md** — Commit `T-09: add voice resolver`.
8. **validation-policy.md** — Commit `T-09: add validation policy`.
9. **output-schemas/relevance-score.json** + python3 json.load validate. Commit `T-09: add relevance-score output schema`.
10. **output-schemas/synthesis-resolution.json** + validate. Commit `T-09: add synthesis-resolution output schema`.
11. **BACKLOG.md** — Commit `T-09: add skill-pack backlog`.
12. **Gate 1 — routing test** in fresh Explore subagent. Save transcript. Commit `T-09: routing test passes`.
13. **Gate 2 — fixture-corpus scoring test** in fresh Explore subagent. Author the fixture corpus + run the test in one transcript file (`docs/verification/t-09-scoring-fixtures.md`). Commit `T-09: fixture corpus + scoring gate passes`.

13 commits. After step 9 or 10, **/clear if context > 60%** — the plan is durable enough to resume from.

Halt on any failed gate. Halt at step 13. Do NOT touch T-07 (AISD), T-10 (drafting), T-11 (ingestion), or anything in `packages/` or `apps/`.

## Session-scope rules

- Sonnet 4.6 for the schemas, topic-vocabulary-map, validation-policy, and BACKLOG (mechanical enumeration).
- Opus 4.7 for SKILL.md routing wording, scoring-rubric formula prose, anti-priority-policy override mechanics, synthesis-resolver judgment rules, voice-resolver decision order (judgment-heavy — these are the load-bearing prompts).
- If any reference file trends past 150 lines, split before shipping.
- Anything not required by the two gates lands in BACKLOG.md.
- Commit-per-file with `T-09:` prefix. No bundling unless files are tightly coupled and ≤50 lines each.
- Watch context budget. /clear after step 10 if context > 60%.
