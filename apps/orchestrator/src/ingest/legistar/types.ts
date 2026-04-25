// Internal types for the Legistar scraper. These are the raw shapes the
// parser emits — not the same as the canonical item.json schema. The
// classifier (T-13) bridges from ParsedItem → @revere/shared Item.

export const LEGISTAR_BASE_URL = "https://austintexas.legistar.com";

export interface MeetingRef {
  id: number;
  guid: string;
}

export interface ItemRef {
  id: number;
  guid: string;
}

export interface ParsedMeetingItem {
  ref: ItemRef;
  item_url: string;
  file_id: string;
  agenda_item_number: number | null;
  type: string;
  title: string;
}

export interface ParsedMeeting {
  ref: MeetingRef;
  meeting_url: string;
  meeting_date: string; // ISO YYYY-MM-DD
  body: string;
  location: string;
  agenda_url: string | null;
  agenda_packet_url: string | null;
  items: ParsedMeetingItem[];
}

export interface ParsedAttachment {
  url: string;
  title: string;
}

export interface ParsedItem {
  ref: ItemRef;
  item_url: string;
  file_id: string;
  type: string;
  status: string;
  title: string;
  in_control: string | null;
  on_agenda: string | null;
  attachments: ParsedAttachment[];
}
