---
name: texas-lege
description: |
  Reference for ingesting Texas Legislature activity relevant to Austin-area
  constituents. Use when working on Texas Legislature Online (capitol.texas.gov)
  scraping, House/Senate video processing, or mapping bills to Austin-area
  representatives and senators.
---

# Texas Legislature — Ingestion Reference

Progressive disclosure applies: this SKILL.md is the entry point. Load
referenced files on demand.

## Decision tree

1. **Scraping a bill from TLO?** → see `tlo.md` for URL patterns, bill-status
   query endpoints, and version-history structure.
2. **Processing a House or Senate committee recording?** → see `video.md` for
   the House/Senate video archive locations and transcript availability.
3. **Mapping a bill to an Austin-area rep or senator?** → see `reps.md` for
   the House and Senate district maps covering Travis County.
4. **Classifying a bill?** → see `taxonomy.md` for subject tags aligned with
   the Austin Council taxonomy (so cross-jurisdiction items can be grouped).
5. **Emitting structured output?** → see `output-schemas/` for the bill/motion
   schema.

## Scope

- Source domains: `capitol.texas.gov`, `house.texas.gov`, `senate.texas.gov`.
- Ingestion cadence: only while the Legislature is in session or interim
  hearings are active. Biennial regular sessions + special sessions.
- Output lands in the same `briefings` / `motions` / `sources` tables,
  tagged `jurisdiction: texas-lege`.

## Hard rules

- Bill versions matter: a constituent cares about the version currently
  before a committee, not the filed version. Always record `version_id`.
- Never emit a bill without a citable TLO URL + version ID.
- Rep/senator assignment must reference `reps.md`; never infer from names.

## Status

Priority 4 in the build order (PRD T-07). Spec here is the contract; fill
in referenced files when pulling T-07.
