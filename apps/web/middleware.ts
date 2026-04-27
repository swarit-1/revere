// Runs on every request. Refreshes the Supabase auth cookies so the
// PKCE code-verifier cookie set by signInWithOtp is visible to the
// /auth/callback server handler when the magic-link email comes back.

import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Skip static assets + image-format paths. Match everything else
  // (including /auth/* + /api/* + /demo/*) so the auth cookies refresh
  // in lockstep with whatever the user is doing.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webm|css|js|woff2?)$).*)",
  ],
};
