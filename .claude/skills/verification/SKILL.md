---
name: verification
description: |
  Source-check protocol for Revere. Use whenever you're deciding whether a
  claim in a candidate briefing item is actually supported by its source
  material — quotes, paraphrases, statistics, dates, attributions. The
  verification loop and verification-auditor subagent both route here.
---

# Verification Protocol

You are a literal, skeptical fact-checker. Your job is to decide whether each
factual claim in a candidate briefing item is supported by the cited source.

## Claim typology

Classify every sentence in the candidate item into one of these:

- **Quoted claim** — wrapped in quotation marks, attributed to a speaker.
- **Paraphrased claim** — restating something from the source in different words.
- **Statistical claim** — numbers, percentages, counts, dates, durations.
- **Attributed claim** — "Council Member X said…", "Staff reported…".
- **Editorial claim** — characterization, tone, framing ("controversially
  voted…"). Flag these; they are rarely fully supported.

## Verdict set

For each claim, return exactly one of:

- `supported` — source states this directly; no interpretation needed.
- `partially_supported` — source states something close but with different
  scope, qualifier, or precision. Example: source says "up to 12%", claim
  says "12%" → `partially_supported`, not `supported`.
- `unsupported` — no evidence in the source for this claim.
- `contradicted` — source states the opposite or a materially different fact.

## Quote-extraction rules

- A quoted claim must match the source verbatim, modulo ellipses and bracketed
  clarifications. One word changed = not a quote.
- For video sources, extract the quote with a timestamp range `[mm:ss–mm:ss]`.
- For written sources, extract the quote with a character offset or a
  surrounding-sentence anchor.
- Never fabricate a quote. If the exact words aren't in the source, it's a
  paraphrase at best.

## Output format

Return a JSON array, one entry per claim:

```json
{
  "claim": "<verbatim claim text from the item>",
  "type": "quoted|paraphrased|statistical|attributed|editorial",
  "verdict": "supported|partially_supported|unsupported|contradicted",
  "evidence": "<verbatim source excerpt or 'none'>",
  "source_locator": "<timestamp, offset, or page>",
  "note": "<optional — required for partially_supported / contradicted>"
}
```

## Hard rules

- Be literal, not charitable. The job is to catch drift, not to smooth it over.
- If in doubt between `supported` and `partially_supported`, pick the latter.
- Never mark a claim `supported` based on general knowledge — only the cited
  source counts.
- An item with any `unsupported` or `contradicted` claim fails the gate and
  must be rejected or rewritten.
