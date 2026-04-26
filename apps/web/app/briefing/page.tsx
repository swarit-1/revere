// /briefing — server component. Reads session, looks up fingerprint, queries
// today's briefing. T-23 ships the auth-gate skeleton; T-25 fully styles
// the rendered cover header and item list.

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BriefingPage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const fingerprintUserId =
    (user.app_metadata?.["fingerprint_user_id"] as string | undefined) ?? null;
  if (!fingerprintUserId) redirect("/onboarding-pending");

  // Pick the most recent briefing for this user. RLS gates: returns null if
  // the JWT's app_metadata.fingerprint_user_id doesn't match the row.
  const { data: briefing } = await sb
    .from("briefings")
    .select("user_id, briefing_date, payload")
    .eq("user_id", fingerprintUserId)
    .order("briefing_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs uppercase tracking-wider text-ink/60">
        Signed in as {user.email}
      </p>
      <p className="mt-1 text-xs text-ink/40">
        fingerprint: <span className="font-mono">{fingerprintUserId}</span>
      </p>
      {briefing ? (
        <>
          <h1 className="mt-12 font-serif text-3xl text-ink">
            {(briefing.payload as { cover_header: string }).cover_header}
          </h1>
          <p className="mt-4 text-sm text-ink/60">
            T-25 will render the full item list here. For now the auth path
            and RLS are end-to-end verified.
          </p>
        </>
      ) : (
        <p className="mt-12 text-sm text-ink/70">
          No briefing for today.
        </p>
      )}
    </main>
  );
}
