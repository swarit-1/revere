# Adversarial loop protocol — T-21

PRD §10.3 + §11.2. The contract this skill implements when called from
`apps/orchestrator/src/draft/loop.ts`.

## Single chain, three voices

The draft request emits **three** final variants (Direct, Measured,
Persuasive). They share one writer call and one critic+refiner chain
— the chain operates on all three drafts in lockstep.

```
   writer (1 call → array<3>)
       ↓
   critic[0] = council_staffer (1 call → array<3>)
       ↓
   refiner   (1 call → array<3>)
       ↓
   critic[1] = opposing_constituent
       ↓
   refiner
       ↓
   critic[2] = press_shop
       ↓
   refiner   → final array<3>
```

Total: **7 Opus 4.7 calls per draft request**. Sequential. Each refiner
sees the prior draft + the critic's structured `Critique` + the user's
fingerprint + the verified item.

## What the writer receives

- The Item record (full source data — title, body, sponsors, location,
  zoning sub-object, sources).
- The verified VerificationReport claims (only `supported` claims —
  the writer must not draw stakes from `unsupported` /
  `partially_supported` / `unverifiable` claims).
- The Fingerprint (location, priorities, anti-priorities).
- The three voice files (`direct.md`, `measured.md`, `persuasive.md`)
  flattened into the system prompt as `### Voice — Direct` etc.

## What the writer emits

```
{
  variants: [
    { voice: "direct",     text: "...", references: ["26-1501"] },
    { voice: "measured",   text: "...", references: ["26-1501"] },
    { voice: "persuasive", text: "...", references: ["26-1501"] }
  ]
}
```

`text` is ≤ 360 words. `references` cites Legistar item ids. The
writer does NOT include the user's name, address, or contact details
— those are filled in client-side from the account record at mailto
encoding time.

## What each critic receives

- The current array of 3 variants (text + voice tag).
- The Item record (same as writer).
- The Fingerprint (so it knows what stake the user has).

## What each critic emits

```
{
  critiques: [
    {
      voice: "direct",
      issues: [
        { severity: "high"|"medium"|"low", description: "...",
          suggested_rewrite: "..." (optional) }
      ],
      remediation: "accept_some" | "accept_all" | "defend"
    },
    ...
  ]
}
```

Each `issues` array has at least one entry. If the draft is genuinely
strong, return one `severity: low` issue with a remediation note.
Empty arrays are not allowed.

## What each refiner receives

- The current 3 variants.
- The critic's 3 Critiques (one per variant).
- The Item, Fingerprint, voice files.

## What each refiner emits

```
{
  variants: [
    { voice: "direct", text: "...", references: [...],
      response_to_critique: "accepted: X. defended: Y." },
    ...
  ]
}
```

The `response_to_critique` is a one-line note that becomes part of the
`critique_trail` row in the drafts table. The refiner explicitly
states which critic points it accepted and which it defended.

## Hard rules

- Never copy a verbatim source phrase ≥ 8 words long into the draft.
  Drafts are the user's words, not the city's.
- Never include a factual claim not present in the
  VerificationReport's `supported` claims.
- The Direct variant ends with a single-sentence ask. The Measured
  variant ends with one-line thanks. The Persuasive variant closes
  with a callback to its opening vignette.
- Each refiner pass strictly preserves the variant's voice register —
  if a critic suggested changes that would push Direct toward
  Measured-length, defend the Direct length and address the issue
  some other way.
- The final variants must differ from each other in sentence
  structure, not just word choice. The gate explicitly checks this.
