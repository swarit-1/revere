// Seeds Supabase Auth users for the demo personas.
// Idempotent: skips if a user with the target email already exists.
//
// Each user is created with app_metadata.fingerprint_user_id pointing at the
// 'maya' / 'jason' rows in the fingerprints table. The v3 RLS policies key
// off this metadata field; the persona switcher (T-28) mutates it to swap
// personas without re-login.
//
// Demo inbox lives in apps/web/.env.local as DEMO_INBOX (a +alias on the
// user's primary inbox so the magic-link emails land in a filterable folder
// instead of the personal mailbox).

import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

const envCandidates = [
  resolve(repoRoot, "apps", "web", ".env.local"),
  resolve(repoRoot, ".env.local"),
];
for (const p of envCandidates) {
  if (existsSync(p)) loadEnv({ path: p });
}

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const demoInbox = process.env["DEMO_INBOX"];
if (!url || !key) throw new Error("Supabase URL + service-role key required");
if (!demoInbox) throw new Error("DEMO_INBOX must be set in apps/web/.env.local");
if (!demoInbox.includes("+")) {
  console.warn(
    `[seed-auth-users] DEMO_INBOX="${demoInbox}" — missing +alias. Magic-link emails will land in the primary inbox; Gmail "+suffix" alias recommended for filterability.`,
  );
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface PersonaSeed {
  fingerprint_user_id: string;
  email: string;
}

function emailFor(local: string, inbox: string): string {
  // 'me+demo@gmail.com' → 'me+demo-maya@gmail.com'.
  // If no +alias yet, add the local as a +alias.
  const [user, domain] = inbox.split("@");
  if (!user || !domain) throw new Error(`bad DEMO_INBOX: ${inbox}`);
  const base = user.includes("+") ? user : `${user}+demo`;
  return `${base}-${local}@${domain}`;
}

const seeds: PersonaSeed[] = [
  { fingerprint_user_id: "maya", email: emailFor("maya", demoInbox) },
  { fingerprint_user_id: "jason", email: emailFor("jason", demoInbox) },
];

async function findUserByEmail(email: string): Promise<string | null> {
  // listUsers paginates; for two seeds we just fetch the first page.
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  const found = data.users.find((u) => u.email === email);
  return found ? found.id : null;
}

async function ensureUser(seed: PersonaSeed): Promise<void> {
  const existingId = await findUserByEmail(seed.email);
  if (existingId) {
    // Update metadata to current state (idempotent on repeated seeds).
    const { error } = await sb.auth.admin.updateUserById(existingId, {
      app_metadata: { fingerprint_user_id: seed.fingerprint_user_id },
    });
    if (error) throw new Error(`updateUser ${seed.email}: ${error.message}`);
    console.log(`[seed-auth-users] ${seed.email} exists, metadata refreshed`);
    return;
  }

  const { data, error } = await sb.auth.admin.createUser({
    email: seed.email,
    email_confirm: true, // skip the email-confirmation step; magic-link is the entry point
    app_metadata: { fingerprint_user_id: seed.fingerprint_user_id },
  });
  if (error || !data?.user) {
    throw new Error(`createUser ${seed.email}: ${error?.message}`);
  }
  console.log(
    `[seed-auth-users] created ${seed.email} (id=${data.user.id}, fp=${seed.fingerprint_user_id})`,
  );
}

async function main(): Promise<void> {
  console.log(`[seed-auth-users] seeding ${seeds.length} auth user(s)`);
  for (const s of seeds) await ensureUser(s);
  console.log(`[seed-auth-users] done`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
