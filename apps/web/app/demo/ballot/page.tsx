// /demo/ballot?fp=maya|jason — URL fallback for the ballot view.
// Mirrors the auth path's /ballot but uses the admin client so the
// demo route survives a Wi-Fi failure on stage. See
// docs/plans/session-6-briefing-ui.md for why these two paths
// deliberately don't share clients.

import { notFound } from "next/navigation";
import type { Fingerprint } from "@revere/shared";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadBallotForUser } from "@/lib/queries/ballot";
import { BallotView } from "@/components/ballot/BallotView";

export const dynamic = "force-dynamic";

const ALLOWED_FP = new Set(["maya", "jason"]);

export default async function DemoBallotPage({
  searchParams,
}: {
  searchParams: Promise<{ fp?: string }>;
}) {
  const params = await searchParams;
  const fp = params.fp ?? "";
  if (!ALLOWED_FP.has(fp)) notFound();

  const admin = supabaseAdmin();
  const { data: fpRow, error } = await admin
    .from("fingerprints")
    .select("user_id, fingerprint")
    .eq("user_id", fp)
    .maybeSingle();
  if (error) throw new Error(`fingerprint load: ${error.message}`);
  if (!fpRow) notFound();

  const briefingRes = await admin
    .from("briefings")
    .select("briefing_date")
    .eq("user_id", fp)
    .order("briefing_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const briefingDate =
    (briefingRes.data?.briefing_date as string | undefined) ??
    new Date().toISOString().slice(0, 10);

  const ballot = await loadBallotForUser(admin, fp, briefingDate);

  return (
    <main className="grain bg-dawn relative min-h-screen overflow-hidden bg-cream text-ink">
      <div className="above-grain">
        <BallotView
          fingerprint={fpRow.fingerprint as Fingerprint}
          briefingDate={briefingDate}
          ballot={ballot}
        />
        <DemoBanner fp={fp} />
      </div>
    </main>
  );
}

function DemoBanner({ fp }: { fp: string }) {
  return (
    <div className="fixed bottom-6 right-6 border border-whisper bg-cream px-4 py-2 text-label uppercase tracking-[0.12em] text-district">
      demo · ballot · fp={fp}
    </div>
  );
}
