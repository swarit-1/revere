// Live-demo wire types. Shared between the API route at
// apps/web/app/api/demo/live/route.ts and the client components.

import type { VerificationReport } from "@revere/shared";
import type { LiveScore, BriefingSnapshot } from "./live-scorer";

export interface LiveDemoPayload {
  persona: {
    id: string;
    display_name: string;
    blurb: string;
    initials: string;
  };
  meeting: {
    id: number;
    body: string | null;
    meeting_date: string;
    agenda_url: string | null;
  };
  candidate_summaries: Array<{
    candidate_item_id: number;
    item_file_id: string;
    title: string;
    topics: string[];
    council_district: number | null;
    type: string;
  }>;
  verification_rollups: Array<{
    candidate_item_id: number;
    item_id: string;
    overall_verdict: string;
    coverage: VerificationReport["coverage"];
    sample_claims: Array<{
      claim_id: string;
      claim_text: string;
      verdict: string;
      source_excerpt: string | null;
    }>;
  }>;
  zoning_extractions: Array<{
    candidate_item_id: number;
    item_file_id: string;
    page_index: number | null;
    confidence: string;
    bbox: { x: number; y: number; w: number; h: number } | null;
  }>;
  scored_items: LiveScore[];
  briefing: BriefingSnapshot;
  topic_distribution: Array<{ topic: string; count: number }>;
}
