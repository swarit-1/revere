# T-05 — Skill pack routing test

**Date:** 2026-04-23
**Runner:** Explore subagent, thoroughness=quick
**Skill pack:** `.claude/skills/jurisdictions/austin-city-council/`
**Gate:** SKILL.md decision tree routes each probe to the right single file; no over-loading.

## Prompt (verbatim)

> Goal: verify that the Austin City Council skill pack's decision tree
> routes queries correctly WITHOUT loading all files at once. This is a
> gate test for task T-05.
>
> The skill pack lives at
> `/Users/swart/Documents/revere/revere/.claude/skills/jurisdictions/austin-city-council/`.
> The entry point is `SKILL.md` — it has a decision tree that tells you
> which single file to load for a given question.
>
> Your job: for each of the three probes below, FIRST read `SKILL.md` to
> identify which file(s) its decision tree says you should load, THEN
> read only those file(s) and use them to answer. The test is whether
> the routing works — the progressive-disclosure budget says you should
> never load more than 1–2 additional files per probe on top of
> SKILL.md.
>
> **Probe A.** "I need to scrape agenda items from
> austintexas.legistar.com — what's the URL pattern for getting from a
> meeting page to an individual agenda item page?"
>
> **Probe B.** "What council district is 1811 East Cesar Chavez in?"
>
> **Probe C.** "This item is titled 'Rezoning 2400 E 5th from SF-3 to
> MF-4'. Which topic taxonomy category does it belong to?"
>
> CRITICAL RULES:
> - Do NOT read all six taxonomy files preemptively.
> - Do NOT read the scraper doc or council-districts doc unless a probe
>   specifically needs it.
> - Do NOT read output-schemas/item.json — none of these probes need it.

## Subagent response (verbatim)

```
## Probe A
- Files read to answer: scrapers/legistar-agenda.md
- Answer: The URL pattern is `https://austintexas.legistar.com/LegislationDetail.aspx?ID=<itemId>&GUID=<itemGuid>`. Both ID and GUID parameters are required; ID-only returns an "Invalid parameters!" error.

## Probe B
- Files read to answer: reference/council-districts.md
- Answer: 1811 East Cesar Chavez is in Council District 3 (the East district, anchored by Holly/Cesar Chavez/parts of E MLK).

## Probe C
- Files read to answer: taxonomy/housing.md
- Answer: The item "Rezoning 2400 E 5th from SF-3 to MF-4" belongs to the `housing` category, as it is a residential upzoning involving single-family (SF-3) to multi-family (MF-4) zoning codes.

## Audit
- Total unique files read across all three probes: 4
- SKILL.md loaded exactly once: yes
- Over-loads (files read that the decision tree didn't route to): none
- Progressive-disclosure budget per probe: A=1, B=1, C=1
```

## Verdict — PASS

| Criterion | Expected | Observed | Pass |
|---|---|---|---|
| SKILL.md loaded once | yes | yes | ✅ |
| Probe A → scrapers/legistar-agenda.md | only | only | ✅ |
| Probe B → reference/council-districts.md | only | only | ✅ |
| Probe C → taxonomy/housing.md (signal words SF-, MF-, Rezoning) | only | only | ✅ |
| No classifier preemptive-loading all 6 taxonomies | no over-loads | no over-loads | ✅ |
| Progressive-disclosure budget (≤3 per probe incl. SKILL.md) | ≤3 | 2 | ✅ |

T-05 gate fires. Routing works under progressive disclosure.

## Notes for future sessions

- Budget per probe was 2 (SKILL.md + 1 routed file), well under the plan's
  "≤5 files per query" ceiling. Room for the classifier to load a second
  taxonomy file when signal spans two topics without breaking the budget.
- SKILL.md's decision tree is legible enough that the subagent didn't
  need to read the full pack to plan the route — the description
  frontmatter + decision tree alone were sufficient.
