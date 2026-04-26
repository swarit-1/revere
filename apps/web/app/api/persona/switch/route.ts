// POST /api/persona/switch — flip the authenticated user's
// app_metadata.fingerprint_user_id to the requested target ('maya'|'jason')
// and refresh their session so the new JWT carries the new metadata.
//
// RLS evaluates the JWT's app_metadata at query time, so the refresh is
// load-bearing. T-28's gate asserts that the next /briefing render reads
// the new persona's row, which only happens if the cookie was rewritten
// with the post-mutation token.

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ALLOWED = new Set(["maya", "jason"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const target = String(body?.target ?? "");
  if (!ALLOWED.has(target)) {
    return NextResponse.json(
      { error: "target must be 'maya' or 'jason'" },
      { status: 400 },
    );
  }

  const sb = await supabaseServer();
  const { data: { user }, error: userErr } = await sb.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(user.app_metadata ?? {}),
      fingerprint_user_id: target,
    },
  });
  if (updateErr) {
    return NextResponse.json(
      { error: `metadata update failed: ${updateErr.message}` },
      { status: 500 },
    );
  }

  // Force the session to refresh so the JWT picks up the new metadata.
  // Calling refreshSession on the server client rewrites the auth cookies
  // via the supabaseServer's setAll callback (Route Handlers can write
  // cookies; server components cannot — that's why this is a Route Handler
  // and not a server action invoked from the page).
  const { error: refreshErr } = await sb.auth.refreshSession();
  if (refreshErr) {
    return NextResponse.json(
      { error: `session refresh failed: ${refreshErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, fingerprint_user_id: target });
}
