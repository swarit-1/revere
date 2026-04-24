# Session 2 — Verification skill (T-08)

## Context

Session 1 shipped the austin-city-council skill pack and a real T-06
record for File #26-1501 with `{value, confidence, raw_passage}` triples
on every structured extraction. This session fills in the verification
skill: the gatekeeper that ensures no unsupported factual claim reaches
a user. It is the technical centerpiece of the "trust is the product"
thesis ([revere-prd.md §11.1](../../revere-prd.md), [§13.5](../../revere-prd.md), [§18.5](../../revere-prd.md)), and the single most-scrutinized
artifact by judges on demo day.

The existing stub at
[.claude/skills/verification/SKILL.md](../../.claude/skills/verification/SKILL.md)
(69 lines, written pre-Session-1) is a starting point but has three
structural mismatches against Session-1's output shape:
1. Claim typology doesn't recognize `{value, confidence, raw_passage}`
   triples as a first-class class.
2. Verdict enum lacks `unverifiable`, collapsing "no source exists" with
   "source exists but doesn't support."
3. Output format is a flat claim array — no per-item wrapper, no
   `sources_reached` log, no degradation states, no `overall_verdict`
   for fast downstream lookup.

Session 2 rewrites SKILL.md and ships the reference files and output
schema that fix these.

## Divergences from PRD (matches Session 1's table format)

| Divergence | PRD §11.1 says | Session 2 ships | Why |
|---|---|---|---|
| Verdict enum | 4 verdicts: `supported | partially_supported | unsupported | contradicted` | 5 verdicts: adds `unverifiable` | Predictive claims and out-of-scope source references need a distinct failure mode from "source exists but doesn't support." Without it, the `unsupported` bucket becomes unreadable. |
| Item-level verdict | Implied binary (rewrite-or-drop) | Four-tier `overall_verdict`: `pass_clean | pass_with_caveats | fail | halt_stale` | PRD's binary is correct at the claim level (rewrite-or-drop still applies there). Four-tier roll-up at the item level gives T-18's trust pane legitimate nuance and encodes stale-data refusal as a first-class state rather than a silent halt. |
| Synthesis-claim handling | Not specified | Split into **item-atom** (verified here) + **join-atom** (`unverifiable` + `remediation: defer_to_fingerprint`) | Personal-relevance claims compose a record claim with a fingerprint claim. Merging them in one verifier breaks progressive disclosure and couples two skills that should compose loosely. The split gives T-18 half the answer already when the fingerprint skill (T-09) resolves its half. |
| Network I/O | Not specified | This skill performs NO network I/O. Input is `(item, sources_map)` where `sources_map` is `{source_index: raw_text_or_markdown}`; output is a `verification_report`. | Pure-function verifier is unit-testable with golden-file fixtures, cost-predictable (Opus spend is proportional to claim count, not retry logic), and re-runnable — T-18 can replay saved raw sources through the verifier for UI without re-scraping. |
| Topic-classification verification | Not specified | Out of scope. T-16 outcome-grader owns rubric scoring. Verifier treats `topics[]` as opaque metadata. | Loading taxonomy files from inside the verifier blows the progressive-disclosure budget (4+ files per call before any source is read). |
| Claim identity | Not specified | Every claim gets `claim_id` = stable json-path into item.json (e.g., `zoning.staff_recommendation`, `location.address`, `sources[2].url`) or synthetic `body.claim[N]` for body-sourced quotes. | Stable IDs let T-18 join verifications to item fields at render time without string matching, and let re-verifications diff semantically ("`zoning.staff_recommendation` moved from `supported` to `contradicted` after re-scrape"). |

## Directory tree (what Session 2 ships)

```
.claude/skills/verification/
├── SKILL.md                              # REWRITE — routing-first entry point
├── BACKLOG.md                            # NEW — deferred work with owner tasks
├── reference/
│   ├── verifier-prompt.md                # NEW — the core verifier prompt. DRAFT → review → commit.
│   ├── claim-typology.md                 # NEW — 8 claim types, verification strategy per type
│   ├── degradation-policy.md             # NEW — unreachable / low-confidence / stale handling
│   └── synthesis-split.md                # NEW — item-atom vs join-atom protocol
└── output-schemas/
    └── verification-report.json          # NEW — JSON Schema Draft 2020-12
```

Nothing else. Quote-extraction rules live inside `claim-typology.md`
under the `quoted` and `extracted` sections rather than a separate file.

## File-by-file specifications

### `SKILL.md` — rewrite (target ≤80 lines)

**Frontmatter.**

```yaml
---
name: verification
description: |
  Use when checking whether the factual claims in an Austin City Council
  briefing item (or any jurisdiction ingestion record with the same
  shape) are actually supported by the cited source material. Produces
  a verification_report with per-claim verdicts (supported,
  partially_supported, unsupported, contradicted, unverifiable) and an
  item-level overall_verdict (pass_clean, pass_with_caveats, fail,
  halt_stale). Pure function — performs no network I/O.
---
```

**Body sections.**

1. **Decision tree.** Five entry questions, each routing to one file:
   - "Running a full verification pass?" → `reference/verifier-prompt.md`
     (the entry point; it references the other three reference files on
     demand).
   - "Need to classify a specific claim?" → `reference/claim-typology.md`
     (stand-alone reference — usable when only one claim type is in
     play).
   - "Source unreachable or item stale?" → `reference/degradation-policy.md`.
   - "Claim looks like it needs fingerprint data?" →
     `reference/synthesis-split.md`.
   - "Emitting the report?" → `output-schemas/verification-report.json`.

2. **Scope.** Input shape, output shape, jurisdictions (v1: austin-city-
   council). Explicitly: **no network I/O in this skill.** All source
   bytes are supplied by the caller.

3. **Hard rules (exactly 6 bullets).**
   - Never fabricate evidence. If a source can't be reached, emit
     `unverifiable` + `remediation: promote_source`. Never mark
     `supported` from general knowledge.
   - Verdict per claim comes from one of five enum values:
     `supported | partially_supported | unsupported | contradicted |
     unverifiable`. No other verdicts.
   - If upstream extraction was low-confidence (`confidence: "low" |
     null` on the item field), verdict is `unverifiable` with
     `remediation: rewrite`. Do not launder low-confidence extractions
     into `supported`.
   - If `item.source_hash` doesn't match a fresh re-hash OR
     `item.scraped_at` is older than 24h against `verified_at`: emit
     `overall_verdict: halt_stale` with `claims: []`. Do not produce
     claim verdicts against stale data.
   - Synthesis claims (personal-relevance, fingerprint-dependent) split
     into an item atom (verified here) and a join atom (emitted
     `unverifiable` + `remediation: defer_to_fingerprint`). See
     `synthesis-split.md`.
   - Topic classification is not verified here. `topics[]` is opaque
     metadata; T-16's outcome-grader owns that rubric.

4. **Divergences from PRD §11.1** — one sentence pointing at this plan.

**What loads it.** Every verification call. Always-loaded entry.
**Type.** Judgment guidance (routing) + invariants (hard rules).

### `reference/verifier-prompt.md` — new (target 150–200 lines). DRAFT REQUIRES REVIEW BEFORE COMMIT.

**Status.** This is the load-bearing prompt. Per Session 2 operating
rules: I will write a first draft, surface it to you for review, iterate,
and commit only after approval. It is NOT included in the Step-6 commit
of the directory scaffold — the placeholder is empty there.

**Contents (shape to aim for).**

- **Role statement.** "You are a literal, skeptical fact-checker. Your
  only source of truth is the raw text provided in `sources_map`. You
  never use world knowledge, never fabricate quotes, and never mark
  `supported` on semantic equivalence alone."
- **Input contract.** `(item, sources_map)` spec. `item` conforms to
  the austin-city-council item.json shape. `sources_map` is a dict
  `{<integer-index-into-item.sources[]>: <raw-utf8-text>}`.
- **Freshness gate** (first step, before claim enumeration). Check
  `item.source_hash` against a re-hash of `sources_map[item_detail_index]`;
  also compare `item.scraped_at` to "now". If stale, emit the
  `halt_stale` report and stop.
- **Claim enumeration protocol.** Walk the item and produce one
  `claim_id` per atomic assertion. Full path list for a T-06-shape item:
  - `id`, `jurisdiction`, `meeting_id`, `meeting_date`,
    `legistar_item_id`, `legistar_item_guid`, `agenda_item_number`,
    `type`, `status`, `title` — all structural.
  - `location.address`, `location.council_district`,
    `location.watershed` — cross-referenced (council_district) and
    structural (others).
  - `zoning.current`, `zoning.proposed`,
    `zoning.staff_recommendation`,
    `zoning.planning_commission_recommendation`,
    `zoning.opposition_petition_filed` — all extracted.
  - Each entry in `sources[]` — structural (URL + type exist).
  - `topics[]` — explicitly skipped (see hard rule 6).
  - `applicants[]`, `sponsors[]` — structural.
  - `body` (if non-null) — broken into individual quoted claims with
    synthetic ids `body.claim[N]`.
- **Per-type verification strategy** (links to `claim-typology.md`).
- **Edge cases with worked examples.** At minimum:
  - `supported`: zoning.current.value = "CS-MU-CO-NP" with raw_passage
    verbatim present in source.
  - `partially_supported`: claim says "CS-1" but source says "CS-1-CO-NP".
  - `contradicted`: claim says "approve" but source says "deny".
  - `unverifiable` (predictive): "rezoning will increase rents" — no
    source can support or deny future tense.
  - `unverifiable` (extraction low-confidence): raw_passage has
    `confidence: "low"`.
  - `unverifiable` (synthesis join): "This affects you because you
    rent in D3."
- **Remediation semantics.** When to emit each enum value
  (`accept | rewrite | drop | promote_source | defer_to_fingerprint |
  defer_to_t16_grader`).
- **Output emission.** Render the full `verification_report` per the
  schema. Compute coverage counters and `overall_verdict` by the
  rollup rules (see below).
- **Tone and style.** Literal, not charitable. Short notes. No
  editorializing about the item's importance.

**What loads it.** Every verification pass (entry point for the full
protocol).
**Type.** Primarily judgment guidance, with some mechanical procedure.

### `reference/claim-typology.md` — new (target ~100 lines)

Judgment guidance. Loaded when the verifier needs to decide a claim's
type and picks the right verification strategy.

**Eight claim types**, each with: definition, example claim text from
T-06-shape data, verification strategy, default verdict on
catastrophic failure.

1. **structural** — identifiers, enums, counts, dates copied from the
   source (`id`, `type`, `status`, `meeting_date`, `legistar_item_id`).
   Strategy: re-parse the source and exact-compare.
2. **extracted** — `{value, confidence, raw_passage}` triples. Strategy:
   (a) substring-check `raw_passage` against the source text
   (deterministic); (b) semantic-equivalence check between `value` and
   `raw_passage` (LLM judgment).
3. **quoted** — explicit verbatim quotes with attribution. Strategy:
   verbatim match modulo ellipses / bracketed clarifications.
4. **cross_referenced** — claims justified by another file in the skill
   system (`location.council_district` justified by
   `reference/council-districts.md`). Strategy: confirm the cited
   reference asserts the claim.
5. **temporal** — dates, deadlines, windows. Strategy: parse and
   compare.
6. **synthesis** — composes an item atom with a fingerprint atom.
   Strategy: split per `synthesis-split.md`. Item atom gets a real
   verdict; join atom gets `unverifiable` + `remediation:
   defer_to_fingerprint`.
7. **predictive** — future-tense assertions. Strategy: always
   `unverifiable`.
8. **editorial** — tone / characterization ("controversial",
   "widely opposed"). Strategy: fail as standalone; `remediation:
   rewrite` to anchor in evidence or drop.

**Quote-extraction rules** (subsection under `quoted` and
`extracted`): modulo ellipses / brackets; one word changed = not a
quote; character offsets or sentence anchors for written; timestamp
ranges `[mm:ss–mm:ss]` for video.

**What loads it.** On-demand when the verifier prompt needs to route a
specific claim through the right strategy.
**Type.** Judgment guidance with a small mechanical sub-section.

### `reference/degradation-policy.md` — new (target ~60 lines)

Mechanical + judgment reference. Loaded when degradation conditions
arise.

**Three documented failure modes and behaviors.**

1. **Source unreachable.** Fetch status in `sources_reached[N].fetch_status`
   is not `"ok"`. Every claim whose evidence would come from that
   source: verdict `unverifiable`, `remediation: promote_source`. Record
   the specific failure (`timeout`, `http_4xx`, `http_5xx`,
   `hash_mismatch`).
2. **Upstream low confidence.** Claim's source-of-record is an item
   field with `confidence: "low"` or `confidence: null`. Verdict
   `unverifiable`, note `"upstream extraction confidence insufficient"`,
   `remediation: rewrite`.
3. **Stale data.** `item.source_hash` ≠ fresh re-hash, OR
   `item.scraped_at` > 24h before `verified_at`. Emit report-level
   `overall_verdict: halt_stale`, `claims: []`, populate
   `freshness_check`. No per-claim verdicts. T-15 is responsible for
   triggering re-scrape.

**Non-degradation rules.** Never fabricate, never general-knowledge,
never silently promote a low-confidence extraction through verification.

**What loads it.** On-demand when the verifier encounters a degradation
condition.
**Type.** Mechanical (behaviors per failure mode) + judgment ("never
fabricate" invariants).

### `reference/synthesis-split.md` — new (target ~40 lines)

Judgment guidance. Loaded when the verifier encounters a
personal-relevance claim.

**Protocol.**

Synthesis claims compose two atoms. Example: *"The rezoning at 1811 E
Cesar Chavez affects you because you rent in District 3."*

- **Item atom.** "There is a rezoning at 1811 E Cesar Chavez in
  District 3." Verifiable here. Emit a real verdict
  (`supported | contradicted | …`) with evidence from the item's
  `sources[]`.
- **Join atom.** "…affects you because you rent in District 3." Not
  verifiable here — requires the fingerprint record. Emit
  `unverifiable` + `remediation: defer_to_fingerprint`. Populate
  `claim_text` but leave `evidence: null`.

Emit BOTH as separate entries in `claims[]`, with distinct `claim_id`
values (e.g., `body.claim[3].item_atom`, `body.claim[3].join_atom`).
T-18 composes the final trust-pane state after the fingerprint skill
returns its half.

**Decision tree for splitting.** A claim is synthesis when it contains
a second-person reference (you / your) OR a reference-to-fingerprint-
field without a corresponding source anchor. Single-atom claims like
"this rezoning is in District 3" are cross-referenced, not synthesis.

**What loads it.** On-demand when a synthesis claim appears.
**Type.** Judgment guidance.

### `output-schemas/verification-report.json` — new (target ~200 lines)

Mechanical schema. JSON Schema Draft 2020-12 matching Session 1's
style: `additionalProperties: false`, explicit `required`, `oneOf` for
nullable-complex structures, `enum` for verdicts and remediation.

**Top-level fields.**

```
$schema, $id, title, description (standard)
item_id                    string, pattern "^[0-9]{2}-[0-9]+$"
item_source_hash           string, 64-char hex (matches item.source_hash)
verified_at                ISO 8601 date-time
verifier_version           string (v1)
overall_verdict            enum: pass_clean | pass_with_caveats | fail | halt_stale
freshness_check            object { item_scraped_at, verified_at, stale: boolean }
coverage                   object { total_claims, supported, partially_supported,
                                    unsupported, contradicted, unverifiable }
sources_reached            array<{ index, url, fetch_status }>
claims                     array<ClaimVerdict>   (empty when halt_stale)
```

**ClaimVerdict shape.**

```
claim_id                   string  (json-path or body.claim[N] or foo.bar.item_atom)
claim_type                 enum: structural | extracted | quoted | cross_referenced |
                                 temporal | synthesis | predictive | editorial
claim_text                 string
value                      string | null         (for extracted/structural)
raw_passage                string | null         (for extracted)
verdict                    enum: supported | partially_supported | unsupported |
                                 contradicted | unverifiable
evidence                   object | null
  └── source_index         integer (into item.sources[])
  └── source_locator       string  (page/offset/timestamp)
  └── source_excerpt       string  (verbatim)
note                       string | null   (required when verdict != supported)
remediation                enum: accept | rewrite | drop | promote_source |
                                 defer_to_fingerprint | defer_to_t16_grader
```

**`fetch_status` enum** on `sources_reached[]`:
`ok | timeout | http_4xx | http_5xx | hash_mismatch | other_error`.

**Rollup rules** (encoded in the schema's description, enforced in the
verifier prompt):
- Any `contradicted` or `unsupported` → `overall_verdict = fail`.
- Any `partially_supported` or `unverifiable` (and none of the above)
  → `pass_with_caveats`.
- All `supported` → `pass_clean`.
- Freshness check fails → `halt_stale`, claims = [].

**Validation at commit time.** `python3 -c "import json; json.load(open('…'))"`.

**What loads it.** On report emission. Also loaded by T-18 consumers.
**Type.** Pure mechanical reference.

### `BACKLOG.md` — new (target ~25 lines)

Deferred with owner tasks.

| File | Owner | Why deferred |
|---|---|---|
| `reference/cross-jurisdiction.md` | T-15 or later | Verification against TLO (state bills) and Austin Code chapters referenced by ordinance number. Needs a cross-scraper API. |
| `scripts/validate_report.py` | T-15 | Deterministic schema validator for CI. Land when the orchestrator holds running code. |
| `reference/video-transcript.md` | T-11 | Transcript-timestamp verification lives in the ingestion layer; verifier just consumes the raw text T-11 extracts. |

**Deferred behaviors.**
- Diff-across-re-verifications (claim-level regression detection). T-15.
- Claude Managed Agents "Outcomes"-native integration. T-16.
- Per-speaker public-comment verification (T-34 stretch).

## Progressive-disclosure audit

**Claim.** No single verification call causes the verifier to load
more than **4 files** from this skill pack. End-to-end verification
typically loads **3**.

### Query-load budget

| Query shape | Files loaded | Count |
|---|---|---|
| "Full-item verification pass (normal path)" | SKILL.md + verifier-prompt.md + claim-typology.md + verification-report.json | 4 |
| "Full-item verification pass (no complications)" | SKILL.md + verifier-prompt.md + verification-report.json (claim-typology consulted only as inline reference) | 3 |
| "Handle a source-unreachable condition" | SKILL.md + degradation-policy.md | 2 |
| "Split a synthesis claim" | SKILL.md + synthesis-split.md | 2 |
| "Classify a single claim type I'm unsure about" | SKILL.md + claim-typology.md | 2 |
| "Emit a report (no verification — replay saved)" | SKILL.md + verification-report.json | 2 |

**Critical routing rule** (encoded in SKILL.md): the four reference
files (`verifier-prompt`, `claim-typology`, `degradation-policy`,
`synthesis-split`) are **NOT** pre-loaded as a set. The verifier prompt
is the entry; it references the other three on-demand as situations
arise (degradation hits → load degradation-policy; synthesis claim
appears → load synthesis-split; ambiguous claim type → load
claim-typology).

### Failure modes to prevent

| Failure | Symptom | Prevention |
|---|---|---|
| Verifier pre-loads all four reference files | 5 files in context at start | SKILL.md decision tree routes by situation, not by pre-load. verifier-prompt.md explicitly says "load X only when Y condition arises." |
| Verifier opens austin-city-council taxonomy files to re-validate `topics[]` | Context bloats with another skill's files | Hard rule 6 in SKILL.md: topic classification is T-16's job. Verifier treats `topics` as opaque. |
| Verifier opens fingerprint files for synthesis claims | Skill crosses into fingerprint territory | synthesis-split.md explicitly says defer — emit `unverifiable + defer_to_fingerprint`, never read fingerprint data. |
| Verifier fetches sources over the network | Skill becomes impure | SKILL.md scope section: "no network I/O." Input is `(item, sources_map)`. T-15 owns fetching. |

### Verification

At T-08's gate test, capture the exact file-load sequence from the
subagent. Acceptance: ≤4 files on any single verification, with
`SKILL.md` loaded exactly once.

## T-08 gate

**Test shape.** Fresh Explore subagent with the full verification skill
pack and Read + Bash tools. Input: three variants of the T-06 record
paired with raw source text harvested from the real Legistar page.

### Three variants

1. **Pristine.** Unmodified T-06 record + real Legistar source text.
   **Expected:** all claims `supported`, `overall_verdict:
   pass_clean`, `coverage.supported == coverage.total_claims`.
2. **Degraded.** T-06 record with `zoning.staff_recommendation.value`
   flipped to `"approve"` (but `raw_passage` still says "to deny").
   **Expected:** that claim comes back `contradicted`,
   `overall_verdict: fail`, `remediation: rewrite` for the broken
   field, every other claim still `supported`.
3. **Partial.** T-06 record with `applicants` extended by an entity
   not in the source ("Random Other LLC"). **Expected:** applicants
   claim returns `partially_supported` or `unsupported` (document
   which and defend — probably `unsupported` because the entity is
   fabricated), `overall_verdict: fail` or `pass_with_caveats`
   depending on the boundary.

### Gate criteria

- All three reports validate against `verification-report.json`
  (run `python3 -c "import json; json.load(open(report))"` for each).
- Each report produces at least one `supported` claim.
- The degraded variant produces at least one `contradicted` claim with
  a non-null `evidence.source_excerpt` showing the real source text
  that contradicts.
- The partial variant produces at least one `unsupported`-or-
  `partially_supported` claim (the subagent documents which and why).
- Collectively across the three variants the subagent exercises at
  least these verdicts: `supported`, `partially_supported` OR
  `unsupported` (one of them), `contradicted`. `unverifiable` is a
  stretch goal for the gate; not required.
- File-load budget per variant: ≤4 files from
  `.claude/skills/verification/`.

### Transcript

Save to `docs/verification/t-08-verification-gate.md` with sections:
prompt, files loaded (per variant), reports emitted, coverage tables,
audit against the criteria above, verdict.

## Execute order (Phase 3)

Each step ends with a commit using `T-08:` prefix.

1. **Scaffold** — `mkdir -p` the directory tree, touch empty
   placeholders. `git add` + commit: `T-08: create verification skill
   pack scaffold`. Also includes `docs/plans/session-2-verification-
   skill.md` (this file).
2. **SKILL.md** — rewrite the entry point. Commit: `T-08: skill entry
   point loads`.
3. **claim-typology.md** — Commit: `T-08: add claim-typology reference`.
4. **degradation-policy.md** — Commit: `T-08: add degradation-policy
   reference`.
5. **synthesis-split.md** — Commit: `T-08: add synthesis-split
   reference`.
6. **verifier-prompt.md DRAFT** — write the first draft. **STOP and
   show the draft to the user.** Do NOT commit yet. Iterate until
   approved. Then commit: `T-08: add verifier prompt`.
7. **verification-report.json** — write the schema. Validate with
   `python3 -c "import json; json.load(open('.claude/skills/verification/output-schemas/verification-report.json'))"`.
   Commit: `T-08: add verification-report output schema`.
8. **BACKLOG.md** — Commit: `T-08: add skill-pack backlog`.
9. **T-08 gate test** — run the three-variant test in a fresh Explore
   subagent. Save transcript to
   `docs/verification/t-08-verification-gate.md`. Commit:
   `T-08: verification skill gates real T-06 record`.

Report after each commit: filepath, gate evidence, next step. **Halt
at step 6 until the user approves the verifier-prompt draft.** Halt on
any failed subagent gate at step 9.

**Stop at the end of step 9.** Do NOT touch T-07 (AISD), T-09
(fingerprint), T-11 (ingestion pipeline), or anything in `packages/`
or `apps/`.

## Session-scope rules (reminder)

- Sonnet 4.6 for enumeration and schema drafting (claim-typology,
  degradation-policy bullet lists, verification-report.json).
- Opus 4.7 for judgment calls (verifier-prompt drafting, synthesis-
  split decision tree, degradation-policy invariants).
- The verifier-prompt is the skill's reason for existing. Draft it,
  surface for review, iterate. No first-version ship.
- If any reference file trends past 150 lines, split before shipping
  (like Session 1).
- Anything not required by the T-08 gate lands in BACKLOG.md.
- Commit-per-gate with `T-08:` prefix. One file per commit unless
  tightly coupled (Session 1's "scraper + council-districts + backlog"
  bundle is an acceptable exception pattern when files are ≤50 lines
  each).
