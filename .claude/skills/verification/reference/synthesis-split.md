# reference/synthesis-split

Load when the verifier encounters a personal-relevance claim — one that
composes a record claim with a fingerprint claim. The verifier prompt
pulls this file on-demand.

## Why splitting matters

A synthesis claim asserts two atoms at once:

> "The rezoning at 1811 East Cesar Chavez affects **you** because you
>  rent in District 3."

- **Item atom.** "There is a rezoning at 1811 East Cesar Chavez in
  District 3." Fully verifiable against the public record.
- **Join atom.** "…affects you because you rent in District 3." Not
  verifiable here — requires the fingerprint record.

Treating the claim as a single unit forces a false choice: either the
verifier loads fingerprint data (breaks skill-composition boundaries),
or it marks the entire claim `unverifiable` (hides the verifiable half).
Splitting gives T-18's trust pane the item atom right away; the
fingerprint skill (T-09) resolves the join atom.

## Detection rules (when to split)

A claim is synthesis when **any** of:

- It contains a second-person reference: `you`, `your`, `yours`,
  `you're`, `you've`.
- It references a fingerprint field by name: `rent`, `own`, `commute`,
  `commute route`, `your district`, `your school zone`, `your kid`.
- It uses a relevance verb without a source anchor: `affects you`,
  `matters to you`, `concerns you`.
- It conditions on the user's life circumstance: `if you rent`, `since
  you walk to work`.

Claims that mention geography without the user-relational framing are
NOT synthesis. Examples of **non-synthesis** claims:
- "This rezoning is in District 3." → `cross_referenced`.
- "Staff recommended deny." → `extracted` or `quoted`.
- "The CS-1 overlay adds liquor sales." → `extracted`.

## Split protocol

For each detected synthesis claim, emit **two** entries in `claims[]`:

1. **Item-atom entry.**
   - `claim_id` = `<base_path>.item_atom` (e.g.,
     `body.claim[3].item_atom`).
   - `claim_type` = the type the item atom would have taken
     stand-alone — usually `cross_referenced`, `extracted`, or
     `structural`.
   - `claim_text` = just the item-atom sentence.
   - Run the normal verification strategy. Emit a real verdict.

2. **Join-atom entry.**
   - `claim_id` = `<base_path>.join_atom`.
   - `claim_type` = `synthesis`.
   - `claim_text` = the relational framing that depends on the
     fingerprint ("…affects you because you rent in D3").
   - `verdict` = `unverifiable`.
   - `evidence` = `null`.
   - `note` = "personal-relevance join; defers to fingerprint skill".
   - `remediation` = `defer_to_fingerprint`.

T-18 composes the final trust-pane state after the fingerprint skill
resolves the join. Typical resolutions:
- Both atoms `supported` + join resolved in user's favor → item
  surfaces with "why this matters to you" rendered.
- Item atom `contradicted` → item rejected regardless of join
  (trust has no fingerprint-only surface).
- Join atom resolves against the user (e.g., fingerprint says "owner"
  but claim says "rent") → item surfaces with the join stripped and a
  generic framing.

## Edge cases

- **No detectable item atom** (claim is pure fingerprint assertion,
  e.g., "you commute on I-35"). Emit a single `synthesis` entry with
  `unverifiable` + `defer_to_fingerprint`. No split.
- **Claim is ambiguous between synthesis and cross_referenced.** Prefer
  `cross_referenced` when the user-relational framing is an aside that
  could be stripped without losing meaning. Prefer `synthesis` when
  stripping the framing changes the assertion.
- **Nested synthesis** (multiple "you" references in one sentence).
  Split into one item atom + one join atom regardless of reference
  count; T-09 resolves the join against the full fingerprint.
