# austin-city-council — BACKLOG

Items deliberately deferred from Session 1's T-05 / T-06 ship. Each has
an owner task or a condition that must be met before it lands.

## Deferred files

| File                                    | Owner | Rationale                                                                 |
|-----------------------------------------|-------|---------------------------------------------------------------------------|
| `scrapers/atxn-youtube-archive.md`      | T-11  | Needs ATXN YouTube discovery subsystem. `item.json` already holds video via `sources[type="video"]`. |
| `reference/committee-structure.md`      | T-14? | Only relevant when ingesting committee-of-the-whole or standing-committee items; council proper is current scope. |
| `reference/parliamentary-procedure.md`  | —     | Procedural interpretation out of scope for v1. Skip unless a verification failure surfaces demand. |
| `scripts/`                              | T-11  | Deterministic extractors (Cheerio helpers, PDF text, source-hash) land when we have code to hold them. |

## Deferred behaviors

- **ASP.NET ViewState handling** for Legistar calendar backfill past the
  default current-month window. Strategy deferred to T-11 — either a
  ViewState-aware POST client or the RSS feed.
- **Per-speaker public-comment parsing** inside attachment PDFs. T-34
  stretch.
- **History-trail vote-total extraction.** Empty pre-enactment; a
  re-scrape pass after final action will fill this. Not v1.
- **Per-meeting full-transcript joining.** Lives in the `meetings` table
  (PRD §12.4), owned by T-11. Skill here emits the item-level record
  only; timestamp pointers into a meeting transcript land separately.
- **Zoning sub-field extraction confidence tuning.** Ship with LLM
  judgment + `confidence` field. If the T-15 verification loop flags
  systematic misses, revisit with a regex-first hybrid.
