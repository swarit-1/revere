# reference/synthesis-resolver

Load when the verification skill's output includes one or more claims
with `remediation: "defer_to_fingerprint"`. The producer side of this
protocol lives in
`@.claude/skills/verification/reference/synthesis-split.md`.

## Input contract

```
{
  fingerprint: Fingerprint,            // matches packages/shared/src/types/fingerprint.ts
  joins: [
    {
      claim_id: string,                // verbatim from verification report
      claim_text: string,              // the join atom's wording (e.g.
                                       // "...affects you because you rent in D3.")
      item_atom_verdict:
        "supported" | "partially_supported" | "unsupported" |
        "contradicted" | "unverifiable"
    },
    ...
  ]
}
```

The `item_atom_verdict` comes from the paired item-atom claim in the
verification report (the claim whose `claim_id` is `<base>.item_atom`
to this entry's `<base>.join_atom`).

## Output (per `output-schemas/synthesis-resolution.json`)

One entry per join atom:

```
{
  claim_id: <verbatim from input>,
  resolution: "resolved" | "rejected" | "generic_fallback",
  confidence: "high" | "medium" | "low",
  reason: <one sentence>,
  fingerprint_evidence: [
    { field_path: <e.g. "housing.status">, value: <fingerprint value> }
  ] | null
}
```

## Resolution rules (in order)

### Rule 1 — short-circuit on item-atom failure

If `item_atom_verdict ∈ {"contradicted", "unsupported"}`:
- `resolution = "rejected"`
- `confidence = "high"`
- `reason = "item atom failed verification (verdict: <value>); join not rendered"`
- `fingerprint_evidence = null`

The item atom failed verification, so the personal-relevance framing
can't ride on top regardless of fingerprint. Save the resolver from
work and keep T-18's logic symmetric.

If `item_atom_verdict == "unverifiable"`:
- Continue to Rule 2 — the item atom may still get re-tried later;
  resolve the join based on fingerprint as if the item atom were
  potentially valid.

If `item_atom_verdict ∈ {"supported", "partially_supported"}`: continue.

### Rule 2 — extract field references from claim_text

Parse `claim_text` for fingerprint-field references. Common patterns:
- "you rent" / "you own" → `housing.status`
- "in District N" / "your district" → `location.council_district`
- "your school" / "your kid's school" → `location.school_zone`
- "your commute" / "you drive" / "you walk" → `work.commute_mode`
- "your block" / "your neighborhood" → no specific fingerprint field;
  this is a geography reference that already counted in the item-atom
  scoring.

Build a list of `field_paths` the claim asserts.

### Rule 3 — check each field path

For each path in `field_paths`:
- **Path populated AND value matches claim** → record in
  `fingerprint_evidence`.
- **Path populated AND value contradicts claim** → emit:
  - `resolution = "rejected"`
  - `confidence = "high"`
  - `reason = "fingerprint.<path>=<value> contradicts claim"`
  - `fingerprint_evidence = [{field_path, value}]` (the contradicting
    one)
  - SHORT-CIRCUIT — no need to check other paths if any single one
    contradicts.
- **Path null** → record this path's status as "unconfirmed."

### Rule 4 — combine path results

After checking all paths:

| Field paths checked | All confirmed | Some confirmed, some null | All null | Any contradiction |
|---|---|---|---|---|
| 1 path | resolved/high | n/a | generic_fallback/low | rejected/high |
| 2 paths | resolved/high | resolved/medium | generic_fallback/low | rejected/high |
| 3+ paths | resolved/high | resolved/low (≥1 null) | generic_fallback/low | rejected/high |

`confidence` reflects how much of the claim the fingerprint actually
grounds, not how strongly each individual field matches.

## Worked examples

### Example 1 — full grounding

Claim: `"...affects you because you rent in District 3."`

Field paths: `housing.status`, `location.council_district`.

Maya's fingerprint: `housing.status = "renter"`,
`location.council_district = 3`.

- Path 1 confirmed (`housing.status = "renter"`).
- Path 2 confirmed (`location.council_district = 3`).
- All confirmed → `resolved`, `confidence: "high"`.
- `fingerprint_evidence`:
  ```
  [
    {field_path: "housing.status", value: "renter"},
    {field_path: "location.council_district", value: 3}
  ]
  ```
- `reason = "fingerprint.housing.status=renter and location.council_district=3 confirm the join"`.

T-18 renders the personal framing as written.

### Example 2 — partial grounding

Same claim. Maya's fingerprint has `housing.status = "renter"` but
`location.council_district = null` (geocode hasn't run yet).

- Path 1 confirmed.
- Path 2 null.
- Some confirmed, some null (2 paths, ≥1 null) → `resolved`,
  `confidence: "medium"`.
- T-18 chooses to render only when confidence is `high`. With
  `medium`, it falls back to `generic_fallback` rendering — strip
  the personal framing.

### Example 3 — contradicting fingerprint

Same claim. Jason's fingerprint has `housing.status = "owner"`.

- Path 1 contradicts (claim says rent, fingerprint says owner).
- Short-circuit. `resolution = "rejected"`, `confidence: "high"`,
  `reason = "fingerprint.housing.status=owner contradicts claim 'you rent'"`.
- `fingerprint_evidence = [{field_path: "housing.status", value: "owner"}]`.

### Example 4 — pure fingerprint claim with no item atom

Claim: `"You commute on I-35."` (the verifier's synthesis-split
emitted this as a single-atom synthesis claim — see
synthesis-split.md edge cases.)

- No item atom; `item_atom_verdict` not applicable (or set to
  `unverifiable`).
- Field path: `work.commute_route_keywords`.
- If fingerprint has `commute_route_keywords: ["I-35", "downtown"]` →
  resolved/high.
- If null → generic_fallback/low.
- If `commute_route_keywords: ["MoPac"]` → rejected/high.

## Hard rules

- Never call back into the verification skill. The contract is
  unidirectional: verification → fingerprint → T-18.
- Never read or write outside the supplied `fingerprint` object. No
  Supabase queries, no inference about user behavior.
- A `rejected` resolution does NOT cause the briefing item itself to
  be dropped — only the personal-relevance framing. The item-atom
  surfaces (or doesn't) based on its own verification + scoring.
