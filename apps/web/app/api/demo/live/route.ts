// POST /api/demo/live
//
// Body: { persona_id: string }
//
// Returns a payload the live demo runner unfolds in stages:
//   • meeting metadata
//   • candidate-item summaries (id, file_id, title, topics, district)
//   • per-item verification rollups (claim counts, sample claims)
//   • zoning-extraction summaries (page_index, bbox, confidence)
//   • per-fingerprint scored items (geography match + topic overlap)
//   • a synthesized briefing snapshot derived from the top scores
//
// All work happens server-side via the admin client. The actual
// pipeline already ran (these are real persisted artifacts); the
// runner replays them with timed visual reveals so a judge sees
// every stage. Live work in this endpoint is the matcher: scores
// recompute fresh against whichever fingerprint the user picked.

import { NextResponse } from "next/server";
import type { Item, VerificationReport } from "@revere/shared";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findPersona } from "@/lib/demo/personalities";
import { scoreLive, summarize } from "@/lib/demo/live-scorer";
import type { LiveDemoPayload } from "@/lib/demo/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface IncomingBody {
  persona_id: string;
}

export async function POST(request: Request) {
  let body: IncomingBody;
  try {
    body = (await request.json()) as IncomingBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const persona = findPersona(body.persona_id);
  if (!persona) {
    return NextResponse.json({ error: `unknown persona ${body.persona_id}` }, { status: 404 });
  }

  const admin = supabaseAdmin();

  // 1. Meeting + candidate items.
  const meetingRes = await admin
    .from("meetings")
    .select("id, body, meeting_date, agenda_url")
    .order("meeting_date", { ascending: false })
    .limit(1)
    .single();
  if (meetingRes.error || !meetingRes.data) {
    return NextResponse.json({ error: `meeting load: ${meetingRes.error?.message}` }, { status: 500 });
  }
  const meeting = meetingRes.data;

  const candRes = await admin
    .from("candidate_items")
    .select("id, item_file_id, item")
    .eq("meeting_id", meeting.id);
  if (candRes.error) {
    return NextResponse.json({ error: `candidates load: ${candRes.error.message}` }, { status: 500 });
  }
  const candidates = (candRes.data ?? []).map((r) => ({
    id: r.id as number,
    item_file_id: r.item_file_id as string,
    item: r.item as Item,
  }));

  // 2. Verification rollups (latest per candidate).
  const vrRes = await admin
    .from("verification_reports")
    .select("candidate_item_id, item_id, report")
    .order("verified_at", { ascending: false });
  if (vrRes.error) {
    return NextResponse.json({ error: `vrs load: ${vrRes.error.message}` }, { status: 500 });
  }
  const seen = new Set<number>();
  const vrs: Array<{
    candidate_item_id: number;
    item_id: string;
    report: VerificationReport;
  }> = [];
  for (const row of vrRes.data ?? []) {
    const cid = row.candidate_item_id as number;
    if (seen.has(cid)) continue;
    seen.add(cid);
    vrs.push({
      candidate_item_id: cid,
      item_id: row.item_id as string,
      report: row.report as VerificationReport,
    });
  }

  // 3. Zoning extractions.
  const zoningRes = await admin
    .from("zoning_map_extractions")
    .select("candidate_item_id, page_index, confidence, bbox");
  const zoningByCid = new Map<number, { page_index: number | null; confidence: string; bbox: LiveDemoPayload["zoning_extractions"][number]["bbox"] }>();
  for (const z of zoningRes.data ?? []) {
    zoningByCid.set(z.candidate_item_id as number, {
      page_index: (z.page_index as number | null) ?? null,
      confidence: z.confidence as string,
      bbox: (z.bbox as LiveDemoPayload["zoning_extractions"][number]["bbox"]) ?? null,
    });
  }
  const zoningExtractions = candidates
    .map((c) => {
      const z = zoningByCid.get(c.id);
      if (!z) return null;
      return {
        candidate_item_id: c.id,
        item_file_id: c.item_file_id,
        page_index: z.page_index,
        confidence: z.confidence,
        bbox: z.bbox,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // 4. Score live against the persona's fingerprint.
  const scored = scoreLive(persona.fingerprint, candidates.map(({ id, item }) => ({ id, item })));

  // 5. Build the briefing snapshot.
  const briefing = summarize(persona.fingerprint, scored, vrs.length);

  // 6. Candidate summaries + topic distribution for the runner UI.
  const candidate_summaries = candidates.map((c) => ({
    candidate_item_id: c.id,
    item_file_id: c.item_file_id,
    title: c.item.title.length > 100 ? `${c.item.title.slice(0, 97).trimEnd()}…` : c.item.title,
    topics: c.item.topics as string[],
    council_district: c.item.location?.council_district ?? null,
    type: c.item.type,
  }));

  const topicCounts = new Map<string, number>();
  for (const c of candidates) {
    for (const t of c.item.topics) topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
  }
  const topic_distribution = [...topicCounts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);

  // 7. Verification rollups w/ sample claims (top 3 supported per item).
  const verification_rollups = vrs.slice(0, 12).map((v) => {
    const sample = v.report.claims
      .filter((c) => c.verdict === "supported" || c.verdict === "unsupported" || c.verdict === "contradicted")
      .slice(0, 3)
      .map((c) => ({
        claim_id: c.claim_id,
        claim_text: c.claim_text.slice(0, 140),
        verdict: c.verdict,
        source_excerpt: c.evidence?.source_excerpt?.slice(0, 200) ?? null,
      }));
    return {
      candidate_item_id: v.candidate_item_id,
      item_id: v.item_id,
      overall_verdict: v.report.overall_verdict,
      coverage: v.report.coverage,
      sample_claims: sample,
    };
  });

  const payload: LiveDemoPayload = {
    persona: {
      id: persona.id,
      display_name: persona.display_name,
      blurb: persona.blurb,
      initials: persona.initials,
    },
    meeting: {
      id: meeting.id as number,
      body: (meeting.body as string | null) ?? null,
      meeting_date: meeting.meeting_date as string,
      agenda_url: (meeting.agenda_url as string | null) ?? null,
    },
    candidate_summaries,
    verification_rollups,
    zoning_extractions: zoningExtractions,
    scored_items: scored,
    briefing,
    topic_distribution,
  };

  return NextResponse.json(payload);
}
