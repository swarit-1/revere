// Auth-cookie refresher per the canonical @supabase/ssr pattern for
// Next.js App Router. Runs on every request via apps/web/middleware.ts.
//
// Why: without it, supabase auth cookies (the PKCE code-verifier
// cookie among them) can go stale or fail to round-trip between the
// browser-side sign-in call and the /auth/callback server handler —
// surfacing as "PKCE code verifier not found in storage." With it,
// cookies set by signInWithOtp are visible to the callback's
// exchangeCodeForSession on the very next request.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  if (!url || !key) {
    // Don't crash the request if env is missing — just skip auth refresh.
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  // CRITICAL — do not insert any code between createServerClient and
  // getUser(). Any awaited call here can desync cookie state and make
  // session bugs nearly impossible to track down.
  await supabase.auth.getUser();

  return supabaseResponse;
}
