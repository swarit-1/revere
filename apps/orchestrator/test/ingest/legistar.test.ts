// Unit tests for the Legistar parsers, against vendored fixtures from the
// April 9, 2026 Austin City Council meeting (#1362247) and File #26-1501
// (1811 East Cesar Chavez rezoning). Fixtures live under
// apps/orchestrator/test-fixtures/austin/ and were curl'd live during T-11.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Hex } from "@revere/shared";
import {
  buildMeetingUrl,
  parseMeetingHtml,
  parseMeetingRefFromUrl,
} from "../../src/ingest/legistar/meeting.js";
import {
  buildItemUrl,
  parseItemHtml,
} from "../../src/ingest/legistar/item.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = (name: string): string =>
  join(here, "..", "..", "test-fixtures", "austin", name);

const meetingHtml = readFileSync(fixturePath("meeting-1362247.html"), "utf8");
const itemHtml = readFileSync(fixturePath("26-1501-item.html"), "utf8");

const MEETING_REF = {
  id: 1362247,
  guid: "E88FC106-FB9A-490E-8D98-56E7BEA33687",
};
const ITEM_REF = {
  id: 7962865,
  guid: "86EA5612-F32D-4555-B234-2FAD60D7AF26",
};

describe("legistar URL helpers", () => {
  it("buildMeetingUrl uses the canonical Legistar URL chain", () => {
    expect(buildMeetingUrl(MEETING_REF)).toBe(
      "https://austintexas.legistar.com/MeetingDetail.aspx?ID=1362247&GUID=E88FC106-FB9A-490E-8D98-56E7BEA33687&Options=info|&Search=",
    );
  });

  it("parseMeetingRefFromUrl recovers the ref pair", () => {
    const ref = parseMeetingRefFromUrl(
      "https://austintexas.legistar.com/MeetingDetail.aspx?ID=1362247&GUID=E88FC106-FB9A-490E-8D98-56E7BEA33687&Options=info|&Search=",
    );
    expect(ref).toEqual(MEETING_REF);
  });

  it("buildItemUrl uses the canonical Legistar URL chain", () => {
    expect(buildItemUrl(ITEM_REF)).toBe(
      "https://austintexas.legistar.com/LegislationDetail.aspx?ID=7962865&GUID=86EA5612-F32D-4555-B234-2FAD60D7AF26&Options=&Search=",
    );
  });
});

describe("parseMeetingHtml against the April 9, 2026 fixture", () => {
  const parsed = parseMeetingHtml(meetingHtml, MEETING_REF);

  it("extracts meeting_date as ISO YYYY-MM-DD", () => {
    expect(parsed.meeting_date).toBe("2026-04-09");
  });

  it("identifies the body as City Council", () => {
    expect(parsed.body).toContain("City Council");
  });

  it("captures the meeting location", () => {
    expect(parsed.location).toContain("Austin City Hall");
  });

  it("enumerates 56 agenda items (matches Phase 1 reconnaissance)", () => {
    expect(parsed.items.length).toBe(56);
  });

  it("contains File #26-1501 with the correct GUID and item URL", () => {
    const item = parsed.items.find((i) => i.file_id === "26-1501");
    expect(item).toBeDefined();
    expect(item?.ref.id).toBe(7962865);
    expect(item?.ref.guid).toBe("86EA5612-F32D-4555-B234-2FAD60D7AF26");
    expect(item?.item_url).toContain("LegislationDetail.aspx?ID=7962865");
  });

  it("ranks 26-1501 as agenda item 56", () => {
    const item = parsed.items.find((i) => i.file_id === "26-1501");
    expect(item?.agenda_item_number).toBe(56);
  });
});

describe("parseItemHtml against the 26-1501 fixture", () => {
  const parsed = parseItemHtml(itemHtml, ITEM_REF);

  it("extracts file_id 26-1501", () => {
    expect(parsed.file_id).toBe("26-1501");
  });

  it("extracts type as Zoning and Neighborhood Plan Amendments", () => {
    expect(parsed.type).toContain("Zoning");
  });

  it("extracts status as Agenda Ready", () => {
    expect(parsed.status).toBe("Agenda Ready");
  });

  it("extracts title containing 1811 East Cesar Chavez", () => {
    expect(parsed.title).toContain("1811 East Cesar Chavez");
  });

  it("collects the three known attachment URLs", () => {
    const urls = parsed.attachments.map((a) => a.url);
    expect(urls.some((u) => u.includes("ID=15343428"))).toBe(true); // Staff Report
    expect(urls.some((u) => u.includes("ID=15343429"))).toBe(true); // Draft Ordinance
    expect(urls.some((u) => u.includes("ID=15343662"))).toBe(true); // Recommendation for Action
  });
});

describe("source_hash on fixture HTML", () => {
  it("meeting-1362247.html sha256 matches the recorded fixture hash", () => {
    expect(sha256Hex(meetingHtml)).toBe(
      "ca2546bc8a58cc1a199a21fdbe7e4694876e6f27bf33c2af6f85e9ae7ed1a49d",
    );
  });

  it("26-1501-item.html sha256 matches the recorded fixture hash", () => {
    expect(sha256Hex(itemHtml)).toBe(
      "5bb6e949dd87c229c76642ee6796044d39d5912f5967251f8ac495cdf43d9f3a",
    );
  });
});
