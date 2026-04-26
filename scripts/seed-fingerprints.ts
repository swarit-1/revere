// Seeds the fingerprints table from JSON fixtures in
// apps/orchestrator/test-fixtures/fingerprints/. Idempotent — UPSERT on user_id.
// T-29 (voice onboarding) replaces this seed pathway with a real intake flow.

import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Fingerprint } from "@revere/shared";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

const envCandidates = [
  resolve(repoRoot, "apps", "orchestrator", ".env.local"),
  resolve(repoRoot, ".env.local"),
];
for (const p of envCandidates) {
  if (existsSync(p)) {
    loadEnv({ path: p });
    break;
  }
}

const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!url || !key) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
}
const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const fixturesDir = join(
  repoRoot,
  "apps",
  "orchestrator",
  "test-fixtures",
  "fingerprints",
);

async function seedOne(filename: string): Promise<void> {
  const path = join(fixturesDir, filename);
  const fp = JSON.parse(readFileSync(path, "utf8")) as Fingerprint;
  const { error } = await sb
    .from("fingerprints")
    .upsert(
      {
        user_id: fp.user_id,
        fingerprint: fp,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("user_id");
  if (error) {
    throw new Error(`failed to seed ${fp.user_id}: ${error.message}`);
  }
  const counts = `priorities=${fp.priorities.length} anti=${fp.anti_priorities.length} slider=${fp.relevance_slider}`;
  console.log(`[seed] ${fp.user_id}: ${counts}`);
}

async function main(): Promise<void> {
  const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    throw new Error(`no .json fixtures in ${fixturesDir}`);
  }
  console.log(`[seed] seeding ${files.length} fingerprint(s) from ${fixturesDir}`);
  for (const f of files) {
    await seedOne(f);
  }
  console.log(`[seed] done`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
