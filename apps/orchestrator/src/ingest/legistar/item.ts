// Parses LegislationDetail.aspx HTML for a single item.
// Same selector strategy as meeting.ts: stable Telerik span IDs.

import { load, type CheerioAPI } from "cheerio";
import {
  LEGISTAR_BASE_URL,
  type ItemRef,
  type ParsedAttachment,
  type ParsedItem,
} from "./types.js";

export function buildItemUrl(ref: ItemRef): string {
  return `${LEGISTAR_BASE_URL}/LegislationDetail.aspx?ID=${ref.id}&GUID=${ref.guid}&Options=&Search=`;
}

function readSpan($: CheerioAPI, lblId: string): string | null {
  const t = $(`#ctl00_ContentPlaceHolder1_${lblId}`).text().trim();
  return t.length > 0 ? t : null;
}

function parseAttachments($: CheerioAPI): ParsedAttachment[] {
  // Attachments live inside #ctl00_ContentPlaceHolder1_lblAttachments (or
  // _lblAttachments2 in the with-text view). Each entry is an <a> with an
  // href like "View.ashx?M=F&ID=...&GUID=...".
  const out: ParsedAttachment[] = [];
  const seen = new Set<string>();
  const containers = [
    "#ctl00_ContentPlaceHolder1_lblAttachments",
    "#ctl00_ContentPlaceHolder1_lblAttachments2",
  ];
  for (const sel of containers) {
    $(`${sel} a`).each((_i, el) => {
      const $a = $(el);
      const href = $a.attr("href");
      if (!href || !href.includes("View.ashx")) return;
      const url = new URL(href, `${LEGISTAR_BASE_URL}/`).toString();
      if (seen.has(url)) return;
      seen.add(url);
      const title = $a.text().trim();
      out.push({ url, title });
    });
  }
  return out;
}

export function parseItemHtml(html: string, ref: ItemRef): ParsedItem {
  const $ = load(html);

  // Validate: Legistar returns "Invalid parameters!" on a bad ID/GUID combo.
  if (/Invalid parameters!/i.test($("body").text())) {
    throw new Error(
      `item ${ref.id} returned 'Invalid parameters!' — check ID/GUID pair`,
    );
  }

  // Item-page convention is inverted from meeting-page: lbl<X> is the LABEL
  // ("File #:"), lbl<X>2 is the VALUE ("26-1501"). Read the 2-suffixed spans.
  const file_id = readSpan($, "lblFile2");
  if (!file_id) {
    throw new Error(`item ${ref.id} missing lblFile2 (File #) — DOM drift; halting`);
  }
  const type = readSpan($, "lblType2") ?? "";
  const status = readSpan($, "lblStatus2") ?? "";
  // Title can carry inner whitespace from HTML formatting; collapse runs.
  const titleRaw = readSpan($, "lblTitle2") ?? readSpan($, "lblTitle") ?? "";
  const title = titleRaw.replace(/\s+/g, " ").trim();
  const in_control = readSpan($, "lblInControlOf2") ?? readSpan($, "lblInControlOf");
  const on_agenda = readSpan($, "lblOnAgenda2") ?? readSpan($, "lblOnAgenda");
  const attachments = parseAttachments($);

  return {
    ref,
    item_url: buildItemUrl(ref),
    file_id,
    type,
    status,
    title,
    in_control,
    on_agenda,
    attachments,
  };
}
