// Browser-side Supabase client. Used only by the persona-switcher path
// (T-28) for the post-mutation session refresh. Reads NEXT_PUBLIC_* from
// process.env at build time.

import { createBrowserClient } from "@supabase/ssr";

export function supabaseBrowser() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set",
    );
  }
  return createBrowserClient(url, key);
}
