// /ballot — election mode. Auth + RLS-gated; on /demo?fp=... routing is
// handled by /demo/ballot which mirrors this with the admin client.

import { redirect } from "next/navigation";
import type { Fingerprint } from "@revere/shared";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadBallotForUser } from "@/lib/queries/ballot";
import { BallotView } from "@/components/ballot/BallotView";

export const dynamic = "force-dynamic";

export default async function BallotPage() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/ballot");

  const fpUserId = (user.app_metadata?.["fingerprint_user_id"] as string | undefined) ?? null;
  if (!fpUserId) redirect("/onboarding");

  const admin = supabaseAdmin();
  const { data: fpRow, error } = await admin
    .from("fingerprints")
    .select("user_id, fingerprint")
    .eq("user_id", fpUserId)
    .maybeSingle();
  if (error) throw new Error(`fingerprint load: ${error.message}`);
  if (!fpRow) redirect("/onboarding");

  // Use the briefing's most recent date as the ballot horizon.
  const briefingRes = await admin
    .from("briefings")
    .select("briefing_date")
    .eq("user_id", fpUserId)
    .order("briefing_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const briefingDate =
    (briefingRes.data?.briefing_date as string | undefined) ??
    new Date().toISOString().slice(0, 10);

  const ballot = await loadBallotForUser(admin, fpUserId, briefingDate);

  return (
    <main className="grain bg-dawn relative min-h-screen overflow-hidden bg-cream text-ink">
      <div className="above-grain">
        <BallotView
          fingerprint={fpRow.fingerprint as Fingerprint}
          briefingDate={briefingDate}
          ballot={ballot}
        />
      </div>
    </main>
  );
}
