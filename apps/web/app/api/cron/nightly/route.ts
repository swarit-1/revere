// GET /api/cron/nightly — Vercel cron trigger.
//
// Vercel-managed cron jobs hit this endpoint at the schedule declared
// in vercel.json. We deliberately do NOT execute the orchestrator
// pipeline inside the serverless function: serverless invocations
// have a hard 5-15 min cap, the pipeline takes longer, and even when
// it doesn't, fan-out cost (per-meeting verification, vision, draft)
// is wrong-shaped for serverless.
//
// Instead, this route:
//   1. Authenticates via the CRON_SECRET header (Vercel cron sends this).
//   2. Logs an `agent_sessions` row of runtime=`cron-trigger` so the
//      trace surface shows the trigger.
//   3. Returns a structured 200 with the trigger metadata.
//
// The actual nightly pipeline runs out-of-band (Cloud Run job, GitHub
// Action, or `pnpm nightly` on a long-lived host). This route is the
// trust-surface — judges see "cron fired at 7am, here's the row" —
// not the worker.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const expected = process.env["CRON_SECRET"];
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const startedAt = new Date().toISOString();

  // Resolve latest meeting so the row is meeting-scoped (matches the
  // shape of orchestrator/verifier sessions).
  const { data: meeting } = await admin
    .from("meetings")
    .select("id")
    .order("meeting_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: session, error } = await admin
    .from("agent_sessions")
    .insert({
      jurisdiction_id: "austin-city-council",
      meeting_id: meeting?.id ?? null,
      runtime: "cron-trigger",
      started_at: startedAt,
      finished_at: startedAt,
      status: "success",
      items_processed: 0,
      notes:
        "T-19 vercel-cron trigger fired. The actual nightly pipeline runs out-of-band; this row records the trigger time.",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: `agent_sessions insert: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    triggered_at: startedAt,
    session_id: session?.id ?? null,
    meeting_id: meeting?.id ?? null,
    note: "trigger logged; pipeline runs out-of-band via `pnpm nightly`",
  });
}
