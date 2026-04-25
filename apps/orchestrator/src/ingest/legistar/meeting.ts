// Parses MeetingDetail.aspx HTML.
// Selector strategy: stable Telerik-generated span IDs
// (#ctl00_ContentPlaceHolder1_lbl<Field>) for label-value fields, plus a
// per-row scan of the gridMain agenda items table.
//
// Hard rule: if the agenda items table has zero rows, OR the meeting date
// can't be parsed, throw. Never emit a meeting with an empty/incoherent
// payload (legistar-agenda.md scraper note).

import { load, type CheerioAPI } from "cheerio";
import {
  LEGISTAR_BASE_URL,
  type MeetingRef,
  type ParsedMeeting,
  type ParsedMeetingItem,
} from "./types.js";

export function buildMeetingUrl(ref: MeetingRef): string {
  return `${LEGISTAR_BASE_URL}/MeetingDetail.aspx?ID=${ref.id}&GUID=${ref.guid}&Options=info|&Search=`;
}

export function parseMeetingRefFromUrl(url: string): MeetingRef {
  const u = new URL(url);
  const id = u.searchParams.get("ID");
  const guid = u.searchParams.get("GUID");
  if (!id || !guid) {
    throw new Error(`URL missing ID and/or GUID: ${url}`);
  }
  const idNum = Number.parseInt(id, 10);
  if (!Number.isFinite(idNum)) {
    throw new Error(`URL ID not a number: ${id}`);
  }
  return { id: idNum, guid };
}

function readSpan($: CheerioAPI, lblId: string): string | null {
  const text = $(`#ctl00_ContentPlaceHolder1_${lblId}`).text().trim();
  return text.length > 0 ? text : null;
}

function readLinkHref($: CheerioAPI, lblId: string): string | null {
  // The element may itself be an <a> (e.g. #hypAgenda) OR contain an <a>
  // (e.g. a <span> wrapping the link). Try both.
  const el = $(`#ctl00_ContentPlaceHolder1_${lblId}`);
  if (el.length === 0) return null;
  const ownHref = el.attr("href");
  const childHref = el.find("a").first().attr("href");
  const href = ownHref ?? childHref;
  if (!href) return null;
  return new URL(href, `${LEGISTAR_BASE_URL}/`).toString();
}

// "4/9/2026" or "4/9/2026 10:00 AM" → "2026-04-09"
function parseLegistarDate(raw: string): string {
  const m = raw.match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) {
    throw new Error(`unrecognized Legistar date: ${raw}`);
  }
  const month = m[1]!.padStart(2, "0");
  const day = m[2]!.padStart(2, "0");
  const year = m[3]!;
  return `${year}-${month}-${day}`;
}

function parseAgendaItemNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

export function parseMeetingHtml(html: string, ref: MeetingRef): ParsedMeeting {
  const $ = load(html);

  const dateRaw = readSpan($, "lblDate");
  if (!dateRaw) throw new Error("meeting page missing lblDate");
  const meeting_date = parseLegistarDate(dateRaw);

  // Meeting body name (e.g. "City Council") lives in #hypName anchor, not a span.
  const body = $(`#ctl00_ContentPlaceHolder1_hypName`).text().trim();
  const location = readSpan($, "lblLocation") ?? "";
  const agenda_url = readLinkHref($, "hypAgenda") ?? readLinkHref($, "lblAgenda");
  const agenda_packet_url =
    readLinkHref($, "hypAgendaPacket") ?? readLinkHref($, "lblAgendaPacket");

  // Each row in #ctl00_ContentPlaceHolder1_gridMain has a <a id="..._hypFile">
  // anchor whose href is "LegislationDetail.aspx?ID=...&GUID=...&Options=&Search="
  // and whose text is the File # (e.g. "26-1501"). Sibling cells in the same
  // <tr> carry agenda item number, type, title.
  const items: ParsedMeetingItem[] = [];
  $(`#ctl00_ContentPlaceHolder1_gridMain tr.rgRow, #ctl00_ContentPlaceHolder1_gridMain tr.rgAltRow`).each(
    (_index, row) => {
      const $row = $(row);
      const cells = $row.find("td");
      if (cells.length < 4) return;
      const fileLink = $row.find("a[id$=_hypFile]").first();
      const href = fileLink.attr("href");
      const file_id = fileLink.text().trim();
      if (!href || !file_id) return;
      const itemUrl = new URL(href, `${LEGISTAR_BASE_URL}/`).toString();
      const u = new URL(itemUrl);
      const idStr = u.searchParams.get("ID");
      const guid = u.searchParams.get("GUID");
      if (!idStr || !guid) return;
      const id = Number.parseInt(idStr, 10);
      if (!Number.isFinite(id)) return;
      // cells[0] = File # (with the link), cells[1] = Agenda #, cells[2] = Type,
      // cells[3] = Title (may be HTML; collapse to text)
      const agenda_item_number = parseAgendaItemNumber($(cells[1]).text());
      const type = $(cells[2]).text().trim();
      const title = $(cells[3]).text().trim().replace(/\s+/g, " ");
      items.push({
        ref: { id, guid },
        item_url: itemUrl,
        file_id,
        agenda_item_number,
        type,
        title,
      });
    },
  );

  if (items.length === 0) {
    throw new Error(
      `meeting ${ref.id} has 0 items in gridMain — DOM drift or empty agenda; halting`,
    );
  }

  return {
    ref,
    meeting_url: buildMeetingUrl(ref),
    meeting_date,
    body,
    location,
    agenda_url,
    agenda_packet_url,
    items,
  };
}
