# reference/council-districts

Load when you need to map an address or neighborhood to a council
district, or check which council member represents a given district.

## Structure

Austin has ten single-member council districts (since 2014's "10-1"
geographic-representation charter change) plus a citywide Mayor. On item
records we represent the mayor as `council_district: 0` for at-large
sponsorship; districts 1–10 are geographic.

## District descriptors

Descriptors below are stable geographic anchors, not precise boundaries.
For exact lines, use the authoritative source (`boundary_source` below)
or a geocode lookup (T-11+ feature).

| D  | Anchor                                                  | Personas-demo relevance           |
|----|---------------------------------------------------------|-----------------------------------|
| 1  | Northeast — MLK Blvd / Manor Rd / Mueller               | —                                 |
| 2  | Southeast — Dove Springs / Montopolis / Del Valle-adj.  | —                                 |
| 3  | **East — Holly / Cesar Chavez / parts of E MLK**        | **Maya and Jason both live here. File #26-1501 is in D3.** |
| 4  | North — north of 290 / Wooten / Crestview east          | —                                 |
| 5  | South — Barton Hills / South Lamar / Westgate           | —                                 |
| 6  | Northwest — Anderson Mill / Jollyville                  | —                                 |
| 7  | North-Central — Allandale / Crestview / Brentwood       | —                                 |
| 8  | Southwest — Oak Hill / Circle C                         | —                                 |
| 9  | Central — UT / Downtown / Hyde Park                     | Jason's coffee shop operates here (E 6th). Downtown PID overlaps D9. |
| 10 | West — Rollingwood-adjacent / Northwest Hills / Tarrytown | —                               |

## Council member roster

**Do not hard-code member names here.** The roster changes with each
election (most recently the Nov 2024 cycle). When an item needs a
sitting-member name, fetch from the authoritative source or use the
user's fingerprint `location.council_district` + a roster table
populated at ingestion time.

`boundary_source`: `https://www.austintexas.gov/council`.
`members_source`: `https://www.austintexas.gov/council-member` (linked
pages per district from the `/council` landing).

## Hard rules

- **Never infer a council district from a street name alone.** A street
  can cross two districts; boundaries don't follow arterials. If a
  reliable geocode is unavailable, set `council_district: null` and let
  downstream decide. Wrong-district assignment is worse than null.
- **Mayor = 0, not a district.** When the sponsor is the Mayor, record
  them as `council_district: 0` on sponsor metadata; keep the item's
  `location.council_district` pinned to the geographic district if the
  item has a specific location.
- **Demo note on District 3.** File #26-1501 (1811 East Cesar Chavez)
  is the load-bearing demo item. Both personas live in D3; that's what
  makes "same meeting, different briefings" contrastive rather than
  geography-explained.
