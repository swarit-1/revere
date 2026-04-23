---
name: aisd
description: |
  Reference for ingesting Austin Independent School District board meetings
  and related materials. Use when working on AISD BoardDocs scraping, board
  meeting video processing, trustee-district data, or anything involving
  austinisd.org.
---

# AISD — Ingestion Reference

Progressive disclosure applies: this SKILL.md is the entry point. Load
referenced files on demand.

## Decision tree

1. **Scraping a board agenda from BoardDocs?** → see `boarddocs.md` for URL
   patterns and document-library structure.
2. **Processing an AISD board meeting recording?** → see `video.md` for the
   archive source and transcript availability notes.
3. **Mapping a motion to a trustee district?** → see `trustees.md` for the
   district → trustee map.
4. **Classifying an agenda item?** → see `taxonomy.md` for the committee list
   (Policy, Finance, Student Achievement, etc.) and item taxonomy.
5. **Emitting structured output?** → see `output-schemas/` for the target
   schema (aligned with the Austin Council `motion.json` shape).

## Scope

- Source domains: `www.austinisd.org`, `go.boarddocs.com/tx/aisd/`.
- Ingestion cadence: board meets ~twice monthly + committee meetings ad-hoc.
- Output lands in the same `briefings` / `motions` / `sources` tables as
  Austin Council, tagged `jurisdiction: aisd`.

## Hard rules

- BoardDocs renders agendas as JS-heavy pages; prefer the exported PDF packet
  when available for stable extraction.
- Never emit a motion without a citable source (BoardDocs item URL or PDF
  page reference).
- Trustee-district assignments must reference `trustees.md`; never infer.

## Status

Priority 4 in the build order (PRD T-07). Spec here is the contract; fill in
`boarddocs.md`, `video.md`, `trustees.md`, `taxonomy.md`, and `output-schemas/`
when pulling T-07.
