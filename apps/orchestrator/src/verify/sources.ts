// Builds the sources_map dict expected by the verifier from a candidate item's
// sources[]. Per Session 5 plan:
// - item_detail → re-fetch URL fresh; re-hash; report fetch status
// - agenda_pdf  → pull from meetings.raw_packet_text (already cached from T-11)
// - staff_report / ordinance / exhibit (PDFs) → fetch URL + extractPdfText
// - map / image-typed exhibit → omitted; verifier emits unverifiable

import type { Item } from "@revere/shared";
import { sha256Hex } from "@revere/shared";
import { fetchText } from "../lib/fetch.js";
import type { FetchStatus } from "@revere/shared";

// Strip ASP.NET dynamic chrome from Legistar HTML before hashing or sending
// to the verifier. __VIEWSTATE / __EVENTVALIDATION / __VIEWSTATEGENERATOR
// rotate on every request, producing false hash drift and burning ~5K tokens
// of irrelevant content.
const VIEWSTATE_RE =
  /<input[^>]*name="(?:__VIEWSTATE|__VIEWSTATEGENERATOR|__EVENTVALIDATION|__EVENTTARGET|__EVENTARGUMENT|__LASTFOCUS|__SCROLLPOSITIONX|__SCROLLPOSITIONY)"[^>]*>/gi;

export function stripLegistarChrome(html: string): string {
  return html.replace(VIEWSTATE_RE, "");
}

const PER_SOURCE_CHAR_CAP = 12_000;
function clip(text: string, cap: number = PER_SOURCE_CHAR_CAP): string {
  return text.length > cap
    ? `${text.slice(0, cap)}\n…[truncated ${text.length - cap} chars]`
    : text;
}

export interface SourceFetchResult {
  index: number;
  url: string;
  fetch_status: FetchStatus;
  text: string | null; // null when omitted/failed
  hash_match?: boolean; // only set for item_detail
}

export interface SourcesContext {
  // Indexed by source_index — the verifier consumes this dict.
  sources_map: Record<number, string>;
  // Per-source fetch status for the verifier's sources_reached array.
  fetch_results: SourceFetchResult[];
  // True when item_detail re-fetch hash didn't match item.source_hash.
  drift_detected: boolean;
}

export interface BuildSourcesArgs {
  item: Item;
  agendaPdfText: string | null; // raw_packet_text from meetings table
}

export async function buildSourcesMap(
  args: BuildSourcesArgs,
): Promise<SourcesContext> {
  const { item, agendaPdfText } = args;
  const sources_map: Record<number, string> = {};
  const fetch_results: SourceFetchResult[] = [];
  let drift_detected = false;

  for (let i = 0; i < item.sources.length; i++) {
    const src = item.sources[i]!;
    const url = src.url;
    const baseRow: SourceFetchResult = {
      index: i,
      url,
      fetch_status: "other_error",
      text: null,
    };

    if (src.type === "item_detail") {
      try {
        const rawHtml = await fetchText(url);
        const stripped = stripLegistarChrome(rawHtml);
        const hash = sha256Hex(stripped);
        const match = hash === item.source_hash;
        if (!match) drift_detected = true;
        sources_map[i] = clip(stripped);
        fetch_results.push({
          ...baseRow,
          fetch_status: match ? "ok" : "hash_mismatch",
          text: stripped,
          hash_match: match,
        });
      } catch (err) {
        fetch_results.push({
          ...baseRow,
          fetch_status: classifyFetchError(err),
          text: null,
        });
      }
      continue;
    }

    if (src.type === "agenda_pdf") {
      // The agenda PDF text is provided to the verifier separately as a
      // cached user-content block (identical across all items in the meeting),
      // so we don't include it in sources_map. The verifier still cites this
      // index when claims trace back to the agenda packet.
      if (agendaPdfText && agendaPdfText.length > 0) {
        fetch_results.push({ ...baseRow, fetch_status: "ok", text: null });
      } else {
        fetch_results.push({ ...baseRow, fetch_status: "other_error", text: null });
      }
      continue;
    }

    if (src.type === "map") {
      // Vision verification is T-15.5 stretch. Skip; verifier emits unverifiable.
      fetch_results.push({ ...baseRow, fetch_status: "other_error", text: null });
      continue;
    }

    // Attached PDFs (staff_report, ordinance, exhibit, public_comment, other)
    // and any non-PDF attachments are skipped in v1 — fetching + extracting
    // each PDF was empirically hanging on certain large packets. Claims that
    // depend on these sources fall to verdict=unverifiable with
    // remediation=promote_source per degradation-policy.md, which still
    // produces pass_with_caveats overall (acceptable per the gate). T-15.5
    // re-enables this with a fetch timeout + per-source byte cap.
    fetch_results.push({ ...baseRow, fetch_status: "other_error", text: null });
  }

  return { sources_map, fetch_results, drift_detected };
}

function classifyFetchError(err: unknown): FetchStatus {
  const msg = (err as Error).message ?? "";
  if (/4\d\d/.test(msg)) return "http_4xx";
  if (/5\d\d/.test(msg)) return "http_5xx";
  if (/timeout|ETIMEDOUT|abort/i.test(msg)) return "timeout";
  return "other_error";
}
