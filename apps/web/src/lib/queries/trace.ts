// Joined query for the T-27 trace modal: agent_sessions for the meeting,
// the verification_report for the item, and the briefing_items.score
// (the relevance breakdown). All read via the admin client — same
// service-role pattern as the source-proof modal data resolution.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RelevanceScore, VerificationReport } from "@revere/shared";

export type AgentRuntime =
  | "orchestrator"
  | "verifier"
  | "matcher"
  | "composer"
  | "vision-extractor"
  | string;

export interface AgentSessionRow {
  id: number;
  runtime: AgentRuntime;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "failed" | string;
  items_processed: number;
  notes: string | null;
}

export interface TracePayload {
  candidate_item_id: number;
  meeting_id: number | null;
  meeting_date: string | null;
  meeting_body: string | null;
  // Per-runtime sessions for the meeting that contain (or are scoped to)
  // this item. notes is the v1 trust-surface text — humanized prose lives
  // in the modal; raw notes is shown via "View raw record ↗".
  ingestion_sessions: AgentSessionRow[];
  verification_report: VerificationReport | null;
  score: RelevanceScore | null;
}

export async function loadTraceWithAdmin(
  admin: SupabaseClient,
  fingerprintUserId: string,
  briefingDate: string,
  candidateItemId: number,
): Promise<TracePayload | null> {
  // 1. Resolve meeting + briefing_item.score for this user/item/date.
  const { data: bi, error: biErr } = await admin
    .from("briefing_items")
    .select("candidate_item_id, score, candidate_items!inner(meeting_id)")
    .eq("user_id", fingerprintUserId)
    .eq("briefing_date", briefingDate)
    .eq("candidate_item_id", candidateItemId)
    .maybeSingle();
  if (biErr) throw new Error(`trace briefing_item load: ${biErr.message}`);
  if (!bi) return null;
  type BiRow = {
    candidate_item_id: number;
    score: RelevanceScore;
    candidate_items: { meeting_id: number };
  };
  const briefingItem = bi as unknown as BiRow;

  const meetingId = briefingItem.candidate_items.meeting_id;

  // 2. Meeting metadata (date, body) for the humanized prose.
  const { data: meeting, error: mErr } = await admin
    .from("meetings")
    .select("meeting_date, body")
    .eq("id", meetingId)
    .maybeSingle();
  if (mErr) throw new Error(`trace meeting load: ${mErr.message}`);

  // 3. agent_sessions for that meeting — orchestrator, verifier,
  // vision-extractor are scoped via meeting_id. matcher and composer
  // run per-fingerprint and have meeting_id=NULL, so we union them in
  // by runtime. Fine-grained per-item filtering would need a
  // candidate_item_id column on agent_sessions (T-27.5 follow-up).
  const meetingScoped = await admin
    .from("agent_sessions")
    .select("id, runtime, started_at, finished_at, status, items_processed, notes")
    .eq("meeting_id", meetingId)
    .order("started_at", { ascending: true });
  if (meetingScoped.error) throw new Error(`trace meeting sessions: ${meetingScoped.error.message}`);

  const fpScoped = await admin
    .from("agent_sessions")
    .select("id, runtime, started_at, finished_at, status, items_processed, notes")
    .is("meeting_id", null)
    .in("runtime", ["matcher", "composer"])
    .order("started_at", { ascending: true });
  if (fpScoped.error) throw new Error(`trace fp-scoped sessions: ${fpScoped.error.message}`);

  const ingestion_sessions = [
    ...((meetingScoped.data ?? []) as AgentSessionRow[]),
    ...((fpScoped.data ?? []) as AgentSessionRow[]),
  ].sort((a, b) => a.started_at.localeCompare(b.started_at));

  // 4. Latest verification_report for this candidate.
  const { data: vr, error: vErr } = await admin
    .from("verification_reports")
    .select("report")
    .eq("candidate_item_id", candidateItemId)
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (vErr) throw new Error(`trace verification_report load: ${vErr.message}`);
  const verification_report =
    (vr?.report as VerificationReport | undefined) ?? null;

  return {
    candidate_item_id: candidateItemId,
    meeting_id: meetingId,
    meeting_date: (meeting?.meeting_date as string | null) ?? null,
    meeting_body: (meeting?.body as string | null) ?? null,
    ingestion_sessions,
    verification_report,
    score: briefingItem.score ?? null,
  };
}
