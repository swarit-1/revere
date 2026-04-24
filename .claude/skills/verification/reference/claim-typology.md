# reference/claim-typology

Load when you need to route a specific claim through its verification
strategy. The verifier prompt references this file on-demand — it is not
pre-loaded for every pass.

## Eight claim types

Each type has: a definition, an example drawn from the T-06
File #26-1501 record, the verification strategy, and the default verdict
on catastrophic failure (source missing, extraction corrupted, etc.).

### 1. structural

**Definition.** Identifiers, enums, counts, or dates copied verbatim from
the source. No interpretation.
**Example.** `id: "26-1501"`, `legistar_item_id: 7962865`,
`meeting_date: "2026-04-09"`, `status: "Agenda Ready"`.
**Strategy.** Re-parse the source and exact-compare. Differences fail
immediately.
**Default on failure.** `contradicted` if the source carries a different
value; `unverifiable` if the source doesn't carry the field at all.

### 2. extracted

**Definition.** A `{value, confidence, raw_passage}` triple where the
upstream skill has already committed to a supporting quote. Dominant
class for items emitted by the austin-city-council skill.
**Example.** `zoning.current = {value: "CS-MU-CO-NP", confidence: "high",
raw_passage: "Current Zoning: CS-MU-CO-NP (...)"}`.
**Strategy.**
1. **Substring check** (deterministic). Does `raw_passage` appear
   verbatim in one of the in-scope sources? Modulo whitespace
   normalization, case-sensitive by default.
2. **Equivalence check** (LLM judgment). Does `value` correctly
   summarize `raw_passage`? A tighter `value` than the source carries
   yields `partially_supported`, not `supported`.
3. **Upstream confidence gate.** If the triple's `confidence` is `"low"`
   or `null`, short-circuit to `unverifiable` with
   `remediation: rewrite`.
**Default on failure.** `contradicted` if substring found but value
disagrees; `unsupported` if substring not found in any source;
`unverifiable` if upstream confidence was insufficient.

### 3. quoted

**Definition.** Explicit verbatim quote with attribution in the item
body or derived narrative (usually appears on briefing items, not raw
ingestion records). Wrapped in quotation marks.
**Example.** Body text: *"Staff wrote: 'The proposed change is
inconsistent with the East Cesar Chavez Neighborhood Plan.'"*
**Strategy.** Verbatim match, modulo ellipses (`...`) and bracketed
clarifications (`[the applicant]`). One word changed = not a quote.
Spelling + punctuation must match. Locator recorded as character
offset for written sources or `[mm:ss–mm:ss]` range for video.
**Default on failure.** `contradicted` if the attributed speaker said
something different; `unsupported` if no matching passage exists.

### 4. cross_referenced

**Definition.** A claim justified by another file in the skill system
rather than by the public record directly.
**Example.** `location.council_district: 3` — justified by
`.claude/skills/jurisdictions/austin-city-council/reference/council-districts.md`
which asserts that 1811 East Cesar Chavez is in District 3.
**Strategy.** Confirm the cited reference file actually asserts this.
Pull the reference file (counts toward the progressive-disclosure
budget) and confirm the mapping. If the reference file defers to an
external authority (e.g., "see austintexas.gov/council"), the verifier
treats the reference itself as the authority — it does not fetch the
external URL.
**Default on failure.** `contradicted` if the reference file asserts a
different value; `unverifiable` if the reference file is silent on the
specific case.

### 5. temporal

**Definition.** Dates, deadlines, windows, durations.
**Example.** `hearing_details.comment_deadline`, or a body phrase like
"public comment closes Thursday."
**Strategy.** Parse both the claim and the source to canonical ISO 8601
timestamps. Compare. Time zone matters — Austin City Council times are
Central; the skill consumes ISO in UTC. Record the parsed form in
`evidence.source_excerpt` for audit.
**Default on failure.** `contradicted` on date mismatch; `unsupported`
if the source is silent.

### 6. synthesis

**Definition.** Personal-relevance claim composing an item atom with a
fingerprint atom. Typically second-person ("you", "your") or refers to
a fingerprint field ("rent", "commute route").
**Example.** "The rezoning at 1811 East Cesar Chavez affects you
because you rent in D3."
**Strategy.** Split per `synthesis-split.md`. Item atom gets a real
verdict from this skill; join atom gets `unverifiable` +
`remediation: defer_to_fingerprint`.
**Default on failure.** Both atoms `unverifiable` if the split itself
is ambiguous.

### 7. predictive

**Definition.** Future-tense assertion; a prediction about outcomes that
have not yet occurred.
**Example.** "This rezoning will increase rents in the corridor."
**Strategy.** No source can support or contradict a prediction.
Verdict is always `unverifiable`. Note should explain: "predictive
claim — no in-scope source addresses a future outcome."
**Remediation.** `rewrite` — replace with a source-anchored observation
("Staff noted the proposed overlay is adjacent to the corridor
currently permitting 40 residential units per acre") or drop.

### 8. editorial

**Definition.** Tone, characterization, or framing that asserts a
valence without a concrete claim. Adjectives doing quiet work.
**Example.** "A controversial rezoning", "widely opposed", "a setback
for the neighborhood."
**Strategy.** Editorial claims usually fail as standalone assertions
because the source carries the fact but not the characterization.
Either recast as a source-anchored quote ("staff noted the proposed
overlay is objected-to by ...") or drop.
**Default verdict.** `unsupported` with `remediation: rewrite`.

## Quote-extraction rules (applies to types 2 and 3)

- Whitespace normalization is allowed (collapse runs of whitespace).
- Modulo ellipses `...` in the middle of a quoted claim if the source
  has additional text there. Track the excised text length in
  `evidence.note`.
- Modulo bracketed clarifications inserted by the author of the
  briefing (e.g., "the applicant [Lodhia Investments]").
- One word changed, added, or removed outside the above exceptions =
  not a quote. Demote to `extracted` if the triple shape fits, or
  `unsupported` if not.
- For video sources, the locator is a timestamp range
  `[mm:ss–mm:ss]`. For written sources, a character offset or a
  surrounding-sentence anchor is acceptable.
- Never fabricate a quote. If the exact words are not in any in-scope
  source, the claim is not a quote — downgrade the class and re-verify.
