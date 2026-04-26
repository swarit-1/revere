// Magic-link callback. Supabase sends the user here after they click the
// email link. We exchange the code for a session, then route based on
// whether the user already has a fingerprint:
//   • no fingerprint → /onboarding (conversational fingerprint builder)
//   • has fingerprint → /briefing (the morning briefing)
//
// `?next=...` overrides the default if present (used during onboarding
// callbacks that want to land on a specific page).

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/sign-in?error=missing_code`);
  }

  const sb = await supabaseServer();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/sign-in?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Honour an explicit ?next override (e.g. someone deep-linked through
  // the magic link). Otherwise route by fingerprint state.
  if (next) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const {
    data: { user },
  } = await sb.auth.getUser();
  const fp = (user?.app_metadata?.["fingerprint_user_id"] as string | undefined) ?? null;
  return NextResponse.redirect(`${origin}${fp ? "/briefing" : "/onboarding"}`);
}
