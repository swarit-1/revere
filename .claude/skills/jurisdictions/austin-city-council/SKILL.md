---
name: austin-city-council
description: |
  Reference for ingesting Austin City Council meetings. Use when working on
  Legistar agenda scraping, ATXN YouTube video processing, council-district
  data, or anything involving austintexas.gov. Covers scrapers, taxonomy,
  and output schemas.
---

# Austin City Council — Ingestion Reference

Follow progressive disclosure: this SKILL.md is the entry point. Load only the
referenced files you need for the current query (3–5 max).

## Decision tree

1. **Scraping an agenda from Legistar?** → see `legistar.md` for URL patterns
   and HTML selectors.
2. **Processing an ATXN YouTube video?** → see `atxn.md` for archive
   structure, transcript sources, and time-alignment notes.
3. **Mapping a motion to a council district?** → see `districts.md` for the
   district → council-member map and boundary references.
4. **Classifying an agenda item?** → see `taxonomy.md` for the committee list
   and item taxonomy.
5. **Emitting structured output?** → see `output-schemas/` (e.g.
   `motion.json`) for the target schema. Validate before returning.

## Scope

- Source domains: `austintexas.legistar.com`, `austintexas.gov`,
  `www.youtube.com/@atxnchannel`.
- Ingestion cadence: weekly (council meetings) + ad-hoc (committee meetings).
- Output lands in `briefings`, `motions`, and `sources` tables (see
  `@revere-prd.md §12`).

## Hard rules

- If the Legistar HTML structure differs from what's documented here, **stop
  and flag it**. Do not guess at new selectors — structure changes break
  downstream verification.
- Never emit a motion without a citable source URL + timestamp (for video) or
  Legistar item ID (for agenda items).
- Council-district assignments must reference `districts.md`; never infer
  from addresses or names.

## Scripts

Deterministic extraction (regex, HTML parsing, schema validation) lives in
`scripts/` and is invoked by the skill rather than reasoned about. See
`scripts/README.md` for the inventory.
