// Admin / service-role Supabase client. SERVER-ONLY — never import into a
// Client Component. Two deliberate uses:
//   1. /demo?fp=maya|jason renders briefings via this client, bypassing
//      RLS. This is the conference-Wi-Fi-fails safety net documented in
//      docs/plans/session-6-briefing-ui.md.
//   2. /api/persona/switch updates auth.users.app_metadata via this
//      client's auth.admin.* APIs.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (server-only)",
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
