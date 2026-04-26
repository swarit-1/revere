// /briefing — server component. Reads session, RLS-gated briefing query,
// resolves item enrichments (item record + source-proof claim) for the
// modal. The render goes inside a Suspense boundary so a slow query
// shows the editorial skeleton, not blank cream.

import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { Item, VerificationReport } from "@revere/shared";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadLatestBriefing } from "@/lib/queries/briefing";
import { pickSourceProof } from "@/lib/source-proof";
import { BriefingView, type ItemEnrichment } from "@/components/briefing/BriefingView";
import { BriefingSkeleton } from "@/components/briefing/BriefingSkeleton";
import { EmptyState } from "@/components/briefing/EmptyState";

export const dynamic = "force-dynamic";

export default async function BriefingPage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const fingerprintUserId =
    (user.app_metadata?.["fingerprint_user_id"] as string | undefined) ?? null;
  if (!fingerprintUserId) redirect("/onboarding-pending");

  return (
    <Suspense fallback={<BriefingSkeleton />}>
      <BriefingContent fingerprintUserId={fingerprintUserId} />
    </Suspense>
  );
}

async function BriefingContent({ fingerprintUserId }: { fingerprintUserId: string }) {
  const sb = await supabaseServer();
  const briefing = await loadLatestBriefing(sb, fingerprintUserId);

  if (!briefing) {
    return <EmptyState meetingDate={null} />;
  }

  // candidate_items + verification_reports are admin-only in v1 (no RLS
  // policy exists for authenticated). We resolve item enrichments
  // server-side via the admin client so the modal renders instantly.
  const admin = supabaseAdmin();
  const itemIds = briefing.payload.items.map((i) => i.candidate_item_id);
  const { data: rows, error } = await admin
    .from("briefing_items")
    .select(
      "candidate_item_id, score, candidate_items!inner(item), verification_reports!inner(report)",
    )
    .eq("user_id", fingerprintUserId)
    .eq("briefing_date", briefing.briefing_date)
    .in("candidate_item_id", itemIds);
  if (error) throw new Error(`enrichments load: ${error.message}`);

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
    <BriefingView
      payload={briefing.payload}
      briefingDate={briefing.briefing_date}
      enrichmentsByItemId={enrichmentsByItemId}
    />
  );
}
