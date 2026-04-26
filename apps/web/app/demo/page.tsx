// Demo override route. Service-role client, RLS bypassed by design.
// This is the conference-Wi-Fi-fails safety net — DO NOT consolidate
// with /briefing's auth path. See docs/plans/session-6-briefing-ui.md
// and supabase/migrations/20260426112824_v3_rls_policies.sql for the
// reasoning. URL is non-public; the bypass is the deliberate emergency lane.

import { notFound } from "next/navigation";
import type { Item, VerificationReport } from "@revere/shared";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadLatestBriefing } from "@/lib/queries/briefing";
import { pickSourceProof } from "@/lib/source-proof";
import { BriefingView, type ItemEnrichment } from "@/components/briefing/BriefingView";
import { EmptyState } from "@/components/briefing/EmptyState";

export const dynamic = "force-dynamic";

const ALLOWED_FP = new Set(["maya", "jason"]);

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ fp?: string }>;
}) {
  const params = await searchParams;
  const fp = params.fp ?? "";
  if (!ALLOWED_FP.has(fp)) notFound();

  const admin = supabaseAdmin();
  const briefing = await loadLatestBriefing(admin, fp);
  if (!briefing) return <EmptyState meetingDate={null} />;

  const itemIds = briefing.payload.items.map((i) => i.candidate_item_id);
  const { data: rows, error } = await admin
    .from("briefing_items")
    .select(
      "candidate_item_id, score, candidate_items!inner(item), verification_reports!inner(report)",
    )
    .eq("user_id", fp)
    .eq("briefing_date", briefing.briefing_date)
    .in("candidate_item_id", itemIds);
  if (error) throw new Error(`/demo enrichments: ${error.message}`);

  type Row = {
    candidate_item_id: number;
    score: { breakdown: { action_window_boost: number } };
    candidate_items: { item: Item };
    verification_reports: { report: VerificationReport };
  };

  const enrichmentsByItemId: Record<string, ItemEnrichment> = {};
  for (const r of rows as unknown as Row[]) {
    const item = r.candidate_items.item;
    const proof = pickSourceProof(r.verification_reports.report);
    const itemContext = r.score.breakdown.action_window_boost === 1 ? "Imminent vote" : null;
    enrichmentsByItemId[item.id] = { item, proof, itemContext };
  }

  return (
    <>
      <BriefingView
        payload={briefing.payload}
        briefingDate={briefing.briefing_date}
        enrichmentsByItemId={enrichmentsByItemId}
      />
      <DemoBanner fp={fp} />
    </>
  );
}

function DemoBanner({ fp }: { fp: string }) {
  // Tiny corner ribbon so the demo route is visually distinguishable from
  // the auth /briefing route during rehearsal. T-28 replaces this with
  // the production-shape persona switcher.
  return (
    <div className="fixed bottom-6 right-6 border border-whisper bg-cream px-4 py-2 text-label uppercase tracking-[0.12em] text-district">
      demo · fp={fp}
    </div>
  );
}
