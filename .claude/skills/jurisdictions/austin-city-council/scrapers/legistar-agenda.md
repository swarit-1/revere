# scrapers/legistar-agenda

Load when scraping austintexas.legistar.com. Do not load during topic
classification or schema emission — those are separate pulls.

## URL chain

Three stops, same host:

1. **Calendar index.** `https://austintexas.legistar.com/Calendar.aspx`
   Default view shows the current and recent months. Calendar year nav
   uses ASP.NET postback (see "Backfill caveat" below).

2. **Meeting detail.** `https://austintexas.legistar.com/MeetingDetail.aspx?ID=<meetingId>&GUID=<meetingGuid>`
   Both `ID` and `GUID` are required. ID-only returns the error page
   `Invalid parameters!` — verified live in Phase 1 reconnaissance.

3. **Item detail.** `https://austintexas.legistar.com/LegislationDetail.aspx?ID=<itemId>&GUID=<itemGuid>`
   Same ID+GUID pair requirement as MeetingDetail.

**Hard rule.** Always capture the ID and GUID together on every hop.
Persist both on every item record (`legistar_item_id`, `legistar_item_guid`).

## Attachment + agenda-packet URLs

Static PDFs, plain GET:

- **Individual attachment (staff report, ordinance, exhibit, map):**
  `https://austintexas.legistar.com/View.ashx?M=F&ID=<fileId>&GUID=<fileGuid>`
- **Meeting-level agenda packet (one combined PDF):**
  `https://austintexas.legistar.com/View.ashx?M=A&ID=<meetingId>&GUID=<meetingGuid>`

No authentication, no paywall.

## Field extraction — Telerik span IDs (verified live in T-11)

Legistar pages are Telerik / ASP.NET WebForms. **Stable per-field span IDs
of the form `#ctl00_ContentPlaceHolder1_lbl<Field>` exist on every page**
and are the cleanest selectors. Live verification during T-11 confirmed
these IDs match across MeetingDetail and LegislationDetail.

**One gotcha that bit T-11 on its first run:** the label-vs-value
naming convention differs between pages.

| Page                     | Label (descriptor) span | Value span               |
|--------------------------|-------------------------|--------------------------|
| `MeetingDetail.aspx`     | `lbl<Field>X`           | `lbl<Field>`             |
| `LegislationDetail.aspx` | `lbl<Field>`            | `lbl<Field>2`            |

Inverted. Always read the **non-label** span. The `2` suffix on item
pages denotes the populated-with-value variant; the unsuffixed version
is the static label "File #:" / "Type:" / etc.

Pattern (Cheerio, with the right suffix):

```js
// MeetingDetail (no '2' suffix; the 'X' suffix is the label)
const meetingDate = $('#ctl00_ContentPlaceHolder1_lblDate').text().trim();
const location    = $('#ctl00_ContentPlaceHolder1_lblLocation').text().trim();

// MeetingDetail body name lives in an anchor, not a span:
const body        = $('#ctl00_ContentPlaceHolder1_hypName').text().trim();

// LegislationDetail ('2' suffix on values)
const fileNumber  = $('#ctl00_ContentPlaceHolder1_lblFile2').text().trim();
const type        = $('#ctl00_ContentPlaceHolder1_lblType2').text().trim();
const status      = $('#ctl00_ContentPlaceHolder1_lblStatus2').text().trim();
const title       = $('#ctl00_ContentPlaceHolder1_lblTitle2').text().trim();
```

Fallback: if a `2`-suffixed value span is missing, try the unsuffixed
form (some legacy items render in the older layout). Halt only if both
miss — selector drift is real and silent.

Meeting-level fields available on `MeetingDetail.aspx`:

| Label        | Typical value                       |
|--------------|-------------------------------------|
| Meeting date | `4/9/2026 10:00 AM`                 |
| Meeting time | in the same cell on some layouts    |
| Body         | `City Council` / `Audit & Finance Committee` / etc. |
| Location     | `Austin City Hall`                  |
| Agenda       | link — `View.ashx?M=A&ID=...&GUID=...`  |
| Agenda packet| sometimes present, sometimes blank  |
| Minutes      | blank until after the meeting       |

Item-level fields available on `LegislationDetail.aspx`:

| Label                | Notes                                             |
|----------------------|---------------------------------------------------|
| File #:              | e.g. `26-1501` → maps to `id`                     |
| Type:                | `Zoning and Neighborhood Plan Amendments`, etc.   |
| Status:              | `Agenda Ready`, `Approved`, `Postponed`, ...      |
| File created:        | ISO-ish, needs parse                              |
| In control:          | body the item is before (`City Council`)          |
| On agenda:           | meeting date — cross-reference meeting record     |
| Final action:        | meeting date of final vote                        |
| Title:               | single-sentence posting title                     |
| Enactment #:         | present only after final ordinance passage        |
| Attachments:         | numbered list — each row is `<a href="View.ashx?M=F&ID=...&GUID=...">Label</a>` |
| History:             | table of prior actions — empty pre-enactment      |

## Agenda items table (on MeetingDetail)

Columns: `File #`, `Agenda #`, `Type`, `Title`.
Each `File #` cell contains an anchor linking to the item's
LegislationDetail URL. Capture both the href's `ID` and `GUID`.

Sanity checks:
- If the table has zero rows → **stop and flag**. Never emit an empty
  agenda as "no items".
- If the `File #` column is missing from the header → stop and flag.
  Legistar has added/removed columns before; a silent selector drift
  corrupts every item.

## Backfill caveat (ASP.NET ViewState)

The calendar's "earlier years" navigation uses `__VIEWSTATE` +
`__EVENTVALIDATION` + `__EVENTTARGET` in a POST form, not a `?year=`
GET parameter. For v1 (current + recent months) GET works.

If you ever need to backfill past the default window, use one of:
- A ViewState-aware scraper that grabs the hidden fields from the initial
  GET and posts them back with `__EVENTTARGET` = the year-link's control
  name.
- Legistar's RSS feed (`Calendar.aspx?Mode=Rss`) for a bounded window.

Either way: **out of scope for T-06**. Flagged for T-11 planning.

## Video gap

`MeetingDetail.aspx` does NOT link the ATXN YouTube video. Leave
`video: null` and `sources[type="video"]` omitted for T-06. T-11 owns
the ATXN discovery subsystem (match by date + title against
`https://www.youtube.com/@atxnchannel`).

## Worked example — File #26-1501

Meeting page:
`https://austintexas.legistar.com/MeetingDetail.aspx?ID=1362247&GUID=E88FC106-FB9A-490E-8D98-56E7BEA33687`

Item page:
`https://austintexas.legistar.com/LegislationDetail.aspx?ID=7962865&GUID=86EA5612-F32D-4555-B234-2FAD60D7AF26`

Expected extractions (verified live in Phase 1):

- `id = "26-1501"`
- `legistar_item_id = 7962865`, `legistar_item_guid = "86EA5612-F32D-4555-B234-2FAD60D7AF26"`
- `type: "Zoning and Neighborhood Plan Amendments"` → maps to
  `item.type = "motion"` (zoning is voted as an ordinance) with
  `hearing_details` populated because it is also a public hearing.
- `status: "Agenda Ready"`, `meeting_date: "2026-04-09"`, `agenda_item_number: 56`
- Three attachments → three `sources` entries
  (`staff_report`, `ordinance`, `other` for "Recommendation for Action").

## Failure modes

| Symptom                                   | Action                          |
|-------------------------------------------|---------------------------------|
| `Invalid parameters!` in response body    | Check that BOTH ID and GUID sent |
| Agenda items table has 0 rows             | Halt, flag the meeting record   |
| `File #:` cell missing                    | Halt, flag DOM drift            |
| Attachment link returns 404               | Record the gap, continue        |
| Unicode mojibake in title                 | Response is mis-decoded — request `utf-8` |
