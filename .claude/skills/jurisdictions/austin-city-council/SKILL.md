---
name: austin-city-council
description: |
  Use when working with Austin City Council agendas, motions, meetings, or
  votes — anything on austintexas.legistar.com, ATXN YouTube, or
  austintexas.gov/council. Covers scraping Legistar, mapping addresses to
  council districts, classifying items into topic taxonomies, and emitting
  the canonical `item.json` ingestion record.
---

# Austin City Council — Ingestion Reference

This file is the entry point. Route by the question you're answering, then
load ONLY the file(s) that question points to. Each step below is a
separate pull; never load them all at once.

## Decision tree

1. **Scraping a Legistar page?** → `scrapers/legistar-agenda.md`.
2. **Need the council district for an address?** → `reference/council-districts.md`.
3. **Classifying an item into a topic?** Scan the item's title and body for
   signal words from the six taxonomy files. Load the ONE file that matches.
   If signal spans two topics, load TWO — never more. Never load all six to
   compare. Available: `taxonomy/housing.md`, `taxonomy/transportation.md`,
   `taxonomy/public-safety.md`, `taxonomy/budget.md`, `taxonomy/land-use.md`,
   `taxonomy/commercial-regulation.md`.
4. **Emitting a structured record?** → `output-schemas/item.json` is the
   canonical shape.
5. **Don't know where to start?** Start with the Legistar "Type" field. Zoning
   + Neighborhood Plan Amendment → usually `housing` (residential) or
   `commercial-regulation` (CS-* overlays). Public Hearing → often
   `commercial-regulation` or `land-use`. Consent budget items → `budget`.

## Scope

- **Source domains.** `austintexas.legistar.com` (agendas, motions, attachments),
  `www.austintexas.gov/council` (district boundaries, member pages), ATXN
  YouTube (`@atxnchannel`, video + captions). No authenticated endpoints.
- **Cadence.** Regular council meetings weekly; committee meetings ad-hoc.
- **Downstream storage.** Records emitted from this skill land in
  Supabase `candidate_items` / `briefing_items` (see `@revere-prd.md §12.4`).

## Hard rules

- Emit no item without a `sources` entry of `type: "item_detail"` — the
  LegislationDetail URL is the minimum citation.
- Capture BOTH the Legistar ID and GUID for every item. ID-only URLs return
  `Invalid parameters!` — one is not enough.
- Assign `location.council_district` only from `reference/council-districts.md`
  or an explicit geocode. Never infer a district from a street name.
- If Legistar's DOM doesn't match the patterns in `scrapers/legistar-agenda.md`,
  **stop and flag it**. Do not guess new selectors. Structure changes break
  downstream verification silently.
- Classification loads the ONE matching taxonomy file by signal words (two
  max if signal is ambiguous). Never six.
- Zoning sub-fields extracted by LLM reasoning (not selectors) get a
  `confidence` enum and a `raw_passage`. No confidence → no extraction.

## Divergences from PRD §17.1 (recorded in @docs/plans/session-1-austin-skill.md)

Ship `output-schemas/item.json` (single schema with `type` discriminator)
instead of `motion.json` + `public-hearing.json` + `staff-report.json`.
Ship six taxonomy files (PRD's five + `commercial-regulation`).
Expose `sources` as a typed array so T-11 can append video without migration.

Deferred to `BACKLOG.md`: `scrapers/atxn-youtube-archive.md` (T-11),
`reference/committee-structure.md` (when committee routing matters),
`reference/parliamentary-procedure.md` (if verification surfaces demand),
`scripts/` (when we have deterministic extractors to hold).
