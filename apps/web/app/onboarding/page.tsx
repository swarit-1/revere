// /onboarding — the conversational fingerprint builder. Per PRD §8.3.
// Server-side auth gate ensures only authenticated users without a
// fingerprint reach the conversation; redirects on either side.

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { OnboardingConversation } from "@/components/onboarding/OnboardingConversation";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?next=/onboarding");
  }

  const existing = (user.app_metadata?.["fingerprint_user_id"] as string | undefined) ?? null;
  if (existing) {
    // Already onboarded — go to the briefing.
    redirect("/briefing");
  }

  return (
    <main className="grain bg-dawn relative min-h-screen overflow-hidden bg-cream text-ink">
      <div className="above-grain">
        <OnboardingConversation />
      </div>
    </main>
  );
}
