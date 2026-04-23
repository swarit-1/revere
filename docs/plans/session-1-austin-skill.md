# Session 1 — Austin City Council skill pack (T-05, T-06)

## Context

Session 0 landed the repo skeleton and the six empty skill-pack entry points. The `austin-city-council` skill is the first one we actually fill in — it's the load-bearing piece every downstream agent (scraper, verifier, fingerprint matcher, drafter) depends on. A weak skill pack here corrupts every briefing for the rest of the build.

Phase 1 (read-only) established:
- Only [SKILL.md](../../.claude/skills/jurisdictions/austin-city-council/SKILL.md) (50 lines) exists; nothing under the PRD §17.1 subdirs.
- Legistar's structure matches the PRD but has three gotchas: ID+GUID pair required, ASP.NET ViewState for backfill, video not linked from MeetingDetail.
- Demo-ready test item: **File #26-1501, 1811 East Cesar Chavez rezoning** (District 3, CS-MU-CO-NP → CS-1-CO-NP, staff/Planning Commission split, opposition petition filed).

## Divergences from PRD (recorded for PRD update after Session 1)

These are deliberate. Each has explicit approval from the previous message.

| Divergence | PRD §17.1 says | Session 1 ships | Why |
|---|---|---|---|
| Output schema filename | `motion.json` + `public-hearing.json` + `staff-report.json` | Single `item.json` with `type` discriminator | All three have the same structural shape; the variance is in which fields populate. One schema cuts downstream consumer cost. `motion` name implies primacy; `item` is neutral. |
| Taxonomy file count | 5 (land-use, transportation, public-safety, budget, housing) | 6 (PRD's 5 + `commercial-regulation`) | `commercial-regulation` is the Jason differentiator (TABC, sidewalk permits, PIDs). Without it, "same meeting, different briefings" loses its strongest contrast. Each file stays lean. |
| `source` representation on items | Implied single URL field | Array of typed references: `[{type: "agenda_pdf", url, page}, {type: "video", url, timestamp_seconds}, {type: "staff_memo", url}]` | T-11 appends video without schema migration. |
| Zoning sub-object | Not specified | Structured with per-field `confidence` + raw passage | Demo narrates "staff deny, PC approve, opposition filed." Paired with verification loop (T-15) as the safety net. |
| `video` for T-06 gate | N/A | `video: null` allowed | T-06 tests schema validity. Video coupling is T-11's problem. |

## Directory tree (what Session 1 ships)

```
.claude/skills/jurisdictions/austin-city-council/
├── SKILL.md                             # REWRITE — routing-first decision tree
├── BACKLOG.md                           # NEW — deferred files, with task IDs
├── scrapers/
│   └── legistar-agenda.md               # NEW — URL chain + DOM patterns + ASP.NET gotchas
├── reference/
│   └── council-districts.md             # NEW — 10-district map, current members, District 3 flagged
├── taxonomy/
│   ├── housing.md                       # NEW
│   ├── transportation.md                # NEW
│   ├── public-safety.md                 # NEW
│   ├── budget.md                        # NEW
│   ├── land-use.md                      # NEW
│   └── commercial-regulation.md         # NEW
└── output-schemas/
    └── item.json                        # NEW — single schema with type discriminator
```

Deferred to [BACKLOG.md](../../.claude/skills/jurisdictions/austin-city-council/BACKLOG.md):

| File | Owner task | Rationale |
|---|---|---|
| `scrapers/atxn-youtube-archive.md` | T-11 | Video discovery subsystem lives there, not here. |
| `reference/committee-structure.md` | Unassigned | Needed only when routing committee items (T-14 or later). |
| `reference/parliamentary-procedure.md` | Unassigned | Needed only if we interpret live motion flow. YAGNI for T-06 (classification, not interpretation). |
| `scripts/` | T-11 | Deterministic extractors land when we have them. |

## File-by-file specifications

### `SKILL.md` — rewrite (target ≤80 lines)

**Frontmatter.**

```yaml
---
name: austin-city-council
description: |
  Use when working with Austin City Council agendas, motions, meetings, or
  votes — anything on austintexas.legistar.com, ATXN YouTube, or
  austintexas.gov/council. Covers scraping Legistar, mapping addresses to
  council districts, classifying items into topic taxonomies, and emitting
  the canonical `item.json` ingestion record.
---
```

**Body (index-style, NOT a content dump).**

Sections:

1. **Decision tree (topic-first routing).** Five entry questions, each pointing to exactly one file:
   - "Scraping a Legistar page?" → `scrapers/legistar-agenda.md`
   - "Need to know which district an address is in?" → `reference/council-districts.md`
   - "Classifying an item into a topic?" → step-by-step: first scan title+body for signal words, then load THE ONE matching file from `taxonomy/`. If signal is ambiguous across two topics, load the two — never more. Never load all six to compare.
   - "Emitting structured output?" → `output-schemas/item.json`
   - "Don't know where to start?" → read the item's type field (Zoning / Ordinance / Public Hearing / Consent / Briefing) and pick the most likely taxonomy.

2. **Scope.** Source domains, cadence, what lands in Supabase tables.

3. **Hard rules (≤6 bullets).**
   - Emit no item without a citable `source_url` (Legistar LegislationDetail URL).
   - Capture BOTH Legistar ID and GUID — one alone fails.
   - District assignments come from `reference/council-districts.md` or an explicit geocode; never infer from a street name.
   - If Legistar DOM differs from `scrapers/legistar-agenda.md`, stop and flag — don't guess selectors.
   - Taxonomy classifier loads the ONE relevant topic file by signal-word routing. Two files max if ambiguous. Never six.
   - Zoning sub-fields extracted via LLM get a `confidence` and a `raw_passage`. No confidence = no extraction.

4. **Divergences from PRD §17.1** (one paragraph pointing to this plan doc).

**What loads it.** Every session that routes to anything Austin. This is the always-loaded entry.
**Type.** Judgment guidance (routing) + scope rules (mechanical).

---

### `scrapers/legistar-agenda.md` — new (target ~120 lines)

Judgment guidance + mechanical reference. Loaded only when the agent is scraping Legistar.

Contents:
- **URL chain.** Calendar.aspx → MeetingDetail.aspx?ID=X&GUID=Y → LegislationDetail.aspx?ID=X&GUID=Y. Both ID and GUID required; ID-only returns `Invalid parameters!` (confirmed live in Phase 1).
- **Attachment URLs.** `View.ashx?M=F&ID=<fileId>&GUID=<fileGuid>`. Static PDFs, simple GET.
- **Agenda packet URL.** `View.ashx?M=A&ID=<meetingId>&GUID=<meetingGuid>`. Single PDF.
- **Field-extraction patterns.** Do NOT use ASP.NET-generated selector IDs (`ctl00$ContentPlaceHolder1$gridLegislation`) — they're stable but fragile. Use label-value lookup: find the cell containing `File #:` (or `Type:`, `Status:`, `On agenda:`, etc.) and read the next cell. Sample Cheerio snippets.
- **ASP.NET WebForms caveats.** ViewState + postback for year navigation, group-by, export. Default current-window GET works for current and prior month. Backfilling past that needs a ViewState-aware client or the Legistar RSS feed — out of scope for T-06. Flag for T-11.
- **Video.** MeetingDetail does NOT link video. ATXN YouTube discovery is T-11's problem — leave `video: null` for now.
- **Failure modes.** If the agenda table has zero rows, flag and stop. If the "File #" column is missing, flag and stop. Scrapers that silently guess are worse than scrapers that halt.
- **Example pass.** Walk through File #26-1501 end-to-end: meeting URL → item URL → fields captured → attachments → source-hash.

**What loads it.** Scraping work only. Does NOT load during classification or output emission.
**Type.** Mixed — judgment (when to halt) + mechanical (selectors, URL patterns).

---

### `reference/council-districts.md` — new (target ~60 lines)

Mechanical reference. Loaded for address → district resolution.

Contents:
- Table of 10 districts: number, current councilmember name, short descriptor ("East Austin, Holly/Cesar Chavez/MLK corridor" for D3; "Northwest, Anderson Mill area" for D6; etc.).
- District 3 flagged with a **demo note** — both Maya and Jason live here; File #26-1501 is in this district.
- Authoritative boundary source: `https://www.austintexas.gov/council` (boundary GIS not included — geocode service belongs in T-11's scraper).
- Hard rule (repeated from SKILL.md): don't infer district from an address; return `council_district: null` if no geocode available, and let downstream decide.
- Pointer: the mayor is elected citywide (District 0 / at-large); never infer a council district from a mayor's sponsorship.

**What loads it.** Any time an item has an address and we need a district. Also any time the agent asks "who sponsors / represents this?".
**Type.** Mechanical reference.

---

### `taxonomy/housing.md` — new (target ~55 lines)

Judgment guidance. Loaded when classifier routes to housing.

Contents:
- **Scope.** Residential rezonings (including mixed-use with residential component); affordability policy (SMART Housing, density bonus, inclusionary zoning where applicable); renter protections (source-of-income, relocation assistance, notice requirements); homelessness funding with housing components; short-term-rental *supply* rules (caps, licensing for housing impact).
- **Out of scope.** Commercial-only rezonings (→ `commercial-regulation`); parkland/open-space (→ `land-use`); property-tax rate setting (→ `budget`); STR *operating* rules (→ `commercial-regulation`).
- **Signal words.** "residential", "rezoning", "MF-", "SF-", "density bonus", "SMART Housing", "affordability", "renter", "displacement", "relocation", "homeless", "permanent supportive housing".
- **Demo item.** File #26-1501 1811 East Cesar Chavez — primary topic housing (residential-adjacent rezoning on a commercial corridor), secondary commercial-regulation (CS-1 adds liquor sales).
- **Three worked examples** with real-feeling titles and correct classification outcomes.

**What loads it.** Classification step only, and only when signal words match. Never pre-loaded.
**Type.** Judgment guidance with signal-word mechanics.

---

### `taxonomy/transportation.md` — new (target ~55 lines)

Judgment guidance.

- **Scope.** Transit (CapMetro coordination, bus-lane ordinances, rail integration), streets (repaving, signal tech, TxDOT grants), sidewalks/bike infra, parking, e-scooters, airport-landside ground transport.
- **Out of scope.** Traffic enforcement (grey area — keep here unless it's a personnel/oversight item, then `public-safety`); airside airport ops (rarely personas-relevant).
- **Signal words.** "transit", "MetroRail", "CapMetro", "signal", "TxDOT", "sidewalk", "bikeway", "bike lane", "scooter", "parking", "repave", "mobility".
- **Demo-adjacent items.** Item 34 (April 9 meeting) — $7.9M TxDOT traffic signal grant.

**Type.** Judgment guidance.

---

### `taxonomy/public-safety.md` — new (target ~50 lines)

- **Scope.** APD contract, Office of Police Oversight, fire/EMS, emergency management, body-cam policy, use-of-force, 911 operations.
- **Out of scope.** Traffic safety infrastructure (→ `transportation`); domestic-violence *services* funding (→ `budget` if that's the lever, else stay here).
- **Signal words.** "APD", "police", "oversight", "use of force", "body-worn", "fire", "EMS", "emergency", "911", "public safety".

**Type.** Judgment guidance.

---

### `taxonomy/budget.md` — new (target ~50 lines)

- **Scope.** Tax rate adoption, annual budget and amendments, fee schedules, franchise agreements, grant acceptances with city matches over a threshold (rule of thumb: $1M+).
- **Out of scope.** Program funding where the vote is about the program, not the money (→ the program's topic). Budget here is the *aggregate* and *rate* level.
- **Signal words.** "tax rate", "adopt budget", "amend FY", "fee schedule", "franchise", "grant acceptance", "general fund", "CIP".

**Type.** Judgment guidance.

---

### `taxonomy/land-use.md` — new (target ~50 lines)

- **Scope.** Parkland dedication, historic preservation, Land Development Code amendments (citywide setbacks, compatibility standards), watershed/environmental rules, tree protection.
- **Out of scope.** Residential rezonings (→ `housing`); commercial-only zoning (→ `commercial-regulation`).
- **Signal words.** "parkland", "historic", "LDC", "Land Development Code", "setback", "compatibility", "watershed", "tree ordinance", "Heritage".

**Type.** Judgment guidance.

---

### `taxonomy/commercial-regulation.md` — new (target ~55 lines)

- **Scope.** TABC / liquor-license overlays (the `CS-1` in File #26-1501), sidewalk-café permits, Public Improvement Districts (PIDs), outdoor-seating rules, mobile food vendors, signage code, STR *operating* rules, noise ordinances affecting business operation.
- **Out of scope.** Construction permitting (→ `land-use` if LDC, else unassigned). General business licensing (city doesn't do it). Commercial tax incentives (→ `budget` if it's a rate/exemption vote).
- **Signal words.** "TABC", "liquor", "CS-1", "sidewalk café", "PID", "public improvement", "outdoor seating", "food truck", "mobile food", "signage", "short-term rental operator", "STR permit", "noise".
- **Demo-adjacent.** Item 43 (April 9) — Downtown PID expansion.

**Type.** Judgment guidance.

---

### `output-schemas/item.json` — new (target ~150 lines with JSDoc comments)

Mechanical schema. Single source of truth for the ingestion record shape.

Format: JSON Schema (Draft 2020-12) for machine validation. Mirror TypeScript interface in `packages/shared/src/types/item.ts` (Session 2 or T-11 follow-up — for now schema-only).

Fields (flat view):

```
id                         string (e.g. "26-1501")
jurisdiction               const "austin-city-council"
meeting_id                 integer (Legistar)
meeting_date               string, ISO8601 date
legistar_item_id           integer
legistar_item_guid         string, uuid
agenda_item_number         integer
type                       enum:
                             - "motion"            (votes, ordinances, resolutions)
                             - "public_hearing"    (scheduled public comment)
                             - "staff_report"      (briefings, updates)
                             - "consent"           (items moved en bloc)
                             - "proclamation"      (usually skipped; included for completeness)
status                     enum: "Agenda Ready" | "Approved" | "Denied" |
                                 "Postponed" | "Withdrawn" | "Enacted"
title                      string (official posting title)
body                       string | null (full description block)
sponsors                   string[]   (councilmember names; empty for applicant-driven items)
applicants                 string[] | null  (for zoning: owner/applicant/agent)
location                   object | null
  ├── address              string | null
  ├── council_district     integer 0..10 | null    (0 = citywide/at-large)
  ├── neighborhood         string | null
  └── watershed            string | null
hearing_details            object | null    (only when type="public_hearing")
  ├── comment_deadline     ISO8601 | null
  └── in_person_time       ISO8601 | null
staff_report_details       object | null    (only when type="staff_report")
  └── authoring_department string | null
zoning                     object | null    (only when Legistar "Type" = "Zoning...")
  ├── current              { value: string, confidence: enum, raw_passage: string | null }
  ├── proposed             { value: string, confidence: enum, raw_passage: string | null }
  ├── staff_recommendation { value: enum("approve"|"deny"|"other"|null),
                             confidence: enum, raw_passage: string | null }
  ├── planning_commission_recommendation  { same shape }
  └── opposition_petition_filed  { value: boolean | null, confidence: enum,
                                   raw_passage: string | null }
topics                     string[]   (taxonomy matches, ≥1; empty rejected)
sources                    array<SourceRef>
  where SourceRef is a discriminated union:
    - { type: "agenda_pdf",  url: string, page?: integer }
    - { type: "item_detail", url: string }
    - { type: "staff_report", url: string, title?: string }
    - { type: "ordinance",    url: string, title?: string }
    - { type: "exhibit",      url: string, title?: string }
    - { type: "map",          url: string, title?: string }
    - { type: "public_comment", url: string, title?: string }
    - { type: "video",        url: string, timestamp_seconds?: number }
    - { type: "other",        url: string, title?: string }
scraped_at                 ISO8601 timestamp
source_hash                string, sha256 hex of raw HTML at scrape time
```

`confidence` enum: `"high" | "medium" | "low" | null`.

Required: `id`, `jurisdiction`, `meeting_id`, `meeting_date`, `legistar_item_id`, `legistar_item_guid`, `agenda_item_number`, `type`, `status`, `title`, `sources` (non-empty), `topics` (non-empty), `scraped_at`, `source_hash`.

Nullable: `body`, `sponsors` (empty array OK), `applicants`, `location` (and all sub-fields), `hearing_details`, `staff_report_details`, `zoning` (and all sub-fields — present only when type-relevant).

**What loads it.** Any extraction step that emits a record. Often paired with `scrapers/legistar-agenda.md`.
**Type.** Pure mechanical reference.

---

### `BACKLOG.md` — new (target ~30 lines)

Deferred work with explicit owner tasks.

```
# austin-city-council — BACKLOG

## Deferred files

| File                               | Owner | Why deferred |
|------------------------------------|-------|--------------|
| scrapers/atxn-youtube-archive.md   | T-11  | Needs YouTube discovery subsystem. Schema already holds video via sources[type="video"]. |
| reference/committee-structure.md   | T-14? | Only relevant when ingesting committee items; council-proper is the current scope. |
| reference/parliamentary-procedure.md | —   | Procedural interpretation out of scope for v1. Skip unless a verification failure surfaces demand. |
| scripts/                           | T-11  | Deterministic extractors (regex, PDF text, Cheerio helpers) land when we have code to hold. |

## Deferred behaviors

- ASP.NET ViewState handling for Legistar calendar backfill (T-11).
- Per-speaker public-comment parsing (T-34 stretch).
- History-trail vote-total extraction (re-scrape pass; not v1).
- Per-meeting full transcript joining (owned by `meetings` table, T-11).
```

**Type.** Mechanical reference.

---

## Progressive-disclosure audit

**Claim.** No single query causes Claude to load more than 5 files from this skill pack. In practice, **no query exceeds 3 files** if routing is followed.

### Query-load budget

| Query shape | Files loaded | Count |
|---|---|---|
| "Scrape a Legistar meeting" | SKILL.md + scrapers/legistar-agenda.md + output-schemas/item.json | 3 |
| "What district is 1811 E Cesar Chavez in?" | SKILL.md + reference/council-districts.md | 2 |
| "Classify this item" (signal-word-routed, 1 topic) | SKILL.md + taxonomy/<topic>.md | 2 |
| "Classify this item" (signal ambiguous, 2 topics) | SKILL.md + taxonomy/<A>.md + taxonomy/<B>.md | 3 |
| "Emit an item.json record" | SKILL.md + output-schemas/item.json | 2 |
| End-to-end ingest (sequential steps) | Step 1: 3 · Step 2: 2 · Step 3: 3 · never simultaneous | 3 max per step |

**The critical routing rule** (enforced in SKILL.md): the taxonomy classifier is a **separate step** from scraping and from emission. Each step loads its own minimal file set. Classification never loads all six taxonomy files — it loads the ONE matching file by signal words, occasionally TWO if the signal spans two topics.

### Failure modes to prevent

| Failure | Symptom | Prevention |
|---|---|---|
| Agent pre-loads all 6 taxonomies to "compare" | 7 files in context | SKILL.md rule: classify by signal-word scan on input first, then load ONE file. Two max if ambiguous. |
| Agent loads `output-schemas/item.json` during classification | +1 file, bloated context | SKILL.md separates classification (topic-only) from emission (schema-only). |
| Agent loads `scrapers/legistar-agenda.md` during classification | +1 file when not needed | SKILL.md separates scrape step from classify step. |

### Verification

At T-06's subagent test, capture the exact sequence of files the classifier loads. Acceptance: ≤3 files per step of the classification pipeline.

---

## Gates

### T-05 gate — skill entry point loads and routes correctly

**Test.** In a fresh subagent session with the `austin-city-council` skill registered, issue each of these prompts and record which file(s) the agent reads:

1. "I need to scrape agenda items from austintexas.legistar.com — what's the URL pattern?" → Expected: reads only `scrapers/legistar-agenda.md`. No taxonomy files loaded.
2. "What council district is 1811 East Cesar Chavez in?" → Expected: reads only `reference/council-districts.md`.
3. "This item is titled 'Rezoning 2400 E 5th from SF-3 to MF-4'. What topic?" → Expected: reads only `taxonomy/housing.md` (signal words: "Rezoning", "SF-", "MF-"). No other taxonomy files.

Pass: all three route correctly with no over-loading.
Save the transcript as `docs/verification/t-05-routing.md`.

### T-06 gate — real agenda item classifies end-to-end

**Test.** In a fresh subagent session with the full skill pack and only WebFetch + Read tools:

Input: the LegislationDetail URL for File #26-1501. Ask the agent to return a complete `item.json` record matching the schema.

Ground-truth checks (each must pass):

| Field | Expected value |
|---|---|
| `id` | `"26-1501"` |
| `jurisdiction` | `"austin-city-council"` |
| `meeting_date` | `"2026-04-09"` |
| `legistar_item_id` | `7962865` |
| `legistar_item_guid` | `"86EA5612-F32D-4555-B234-2FAD60D7AF26"` |
| `type` | `"motion"` (zoning ordinance vote) OR `"public_hearing"` — item is both; document which won and why |
| `status` | `"Agenda Ready"` |
| `title` | matches "C14-2025-0080 - 1811 East Cesar Chavez - …" |
| `location.address` | `"1811 East Cesar Chavez Street"` |
| `location.council_district` | `3` |
| `location.watershed` | `"Lady Bird Lake Watershed"` |
| `zoning.current.value` | `"CS-MU-CO-NP"` |
| `zoning.proposed.value` | `"CS-1-CO-NP"` |
| `zoning.staff_recommendation.value` | `"deny"` |
| `zoning.planning_commission_recommendation.value` | `"approve"` |
| `zoning.opposition_petition_filed.value` | `true` |
| `topics` | contains `"housing"` AND `"commercial-regulation"` (both apply) |
| `sources` | ≥4 entries: `item_detail`, `staff_report`, `ordinance`, `recommendation_for_action`. Each with absolute URL. `video` omitted (T-11). |
| `source_hash` | present, 64-char hex |
| `scraped_at` | ISO8601 within the last hour |

For each zoning sub-field, confidence must be `"high"` or `"medium"` and `raw_passage` must contain the supporting text. If any sub-field returns `confidence: "low"` or `null`, that's an acceptable honest miss — but the item must still validate against the schema.

Pass criteria: schema-valid JSON + all ground-truth field matches. Single "low" confidence allowed. Any field mismatch fails.

Save the transcript + emitted JSON as `docs/verification/t-06-classification.md`.

---

## Execute order (Phase 3)

Each step ends with a commit using `T-05:` or `T-06:` prefix.

1. Create directory structure; touch empty placeholder files for every new file in the tree. Commit: `T-05: create austin-city-council skill pack scaffold`.
2. Rewrite SKILL.md with topic-first routing decision tree + hard rules + divergence note. Commit: `T-05: skill entry point loads`.
3. Write `taxonomy/housing.md`. Commit: `T-06: add housing taxonomy`.
4. Write `taxonomy/transportation.md`. Commit: `T-06: add transportation taxonomy`.
5. Write `taxonomy/public-safety.md`. Commit: `T-06: add public-safety taxonomy`.
6. Write `taxonomy/budget.md`. Commit: `T-06: add budget taxonomy`.
7. Write `taxonomy/land-use.md`. Commit: `T-06: add land-use taxonomy`.
8. Write `taxonomy/commercial-regulation.md`. Commit: `T-06: add commercial-regulation taxonomy`.
9. Write `output-schemas/item.json`. Commit: `T-06: add item.json output schema`.
10. Write `scrapers/legistar-agenda.md` + `reference/council-districts.md` + `BACKLOG.md`. Commit: `T-06: add Legistar scraper, council-districts reference, and backlog`.
11. Run the T-05 routing test in a subagent. Save transcript. Commit: `T-05: routing test passes`.
12. Run the T-06 classification test in a subagent. Save transcript + emitted JSON. Commit: `T-06: real Austin agenda item classifies end-to-end`.

Report after each commit: filepath, gate evidence (which lines changed / which subagent output landed), token cost so far, next step. Halt immediately on a failed test; do not push past a failing gate.

**Stop at the end of step 12.** Do not touch T-07 (AISD), T-08 (verification skill), or anything in the `packages/` or `apps/` trees.

---

## Session-scope rules (reminder)

- Sonnet 4.6 for mechanical writing (taxonomy enumerations, schema field lists, reference tables).
- Opus 4.7 for judgment calls (routing description wording, signal-word selection, zoning extraction schema).
- If a WebFetch fails or returns something unexpected, surface it — never fabricate DOM structure.
- If a reference file looks like it wants to grow past ~150 lines, split before shipping.
- Anything not required by T-06's gate goes in BACKLOG.md.
