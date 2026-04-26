// Render briefings to static HTML/text files for visual review.
// Used by Gate 3 evidence capture in lieu of a Resend send (no API key
// available in this environment).

import { config as loadEnv } from "dotenv";
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { supabase } from "../lib/supabase.js";
import { renderBriefingEmail } from "./render.js";

const here = dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  resolve(here, "..", "..", ".env.local"),
  resolve(here, "..", "..", "..", "..", ".env.local"),
];
for (const p of envCandidates) {
  if (existsSync(p)) {
    loadEnv({ path: p });
    break;
  }
}

const OUT_DIR = resolve(here, "..", "..", "..", "..", "docs", "verification", "email-renders");

async function main(): Promise<void> {
  const sb = supabase();
  const personas = ["maya", "jason"];
  for (const userId of personas) {
    const { data, error } = await sb
      .from("briefings")
      .select("user_id, briefing_date, payload")
      .eq("user_id", userId)
      .order("briefing_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) {
      console.error(`${userId}: ${error?.message ?? "no briefing"}`);
      continue;
    }
    const r = renderBriefingEmail({
      payload: data.payload as Parameters<typeof renderBriefingEmail>[0]["payload"],
      briefingDate: data.briefing_date as string,
      userId: data.user_id as string,
      appUrl: "http://localhost:3000",
    });
    writeFileSync(`${OUT_DIR}/${userId}.html`, r.html);
    writeFileSync(`${OUT_DIR}/${userId}.txt`, r.text);
    console.log(
      `${userId}: subject="${r.subject}" html=${r.html.length}B text=${r.text.length}B → ${OUT_DIR}/${userId}.{html,txt}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
