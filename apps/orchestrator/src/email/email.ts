// Entry point for T-24 morning briefing email.
//   pnpm email --user maya
//   pnpm email --user jason --briefing-date 2026-04-09
//   pnpm email --user maya --to alt@example.com   # override DEMO_INBOX
//   pnpm email --user maya --dry-run              # render but don't send

import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Resend } from "resend";
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

interface Args {
  userId: string;
  briefingDate: string | null;
  to: string | null;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    if (!flag?.startsWith("--")) continue;
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      flags.add(flag.slice(2));
      continue;
    }
    args.set(flag.slice(2), value);
    i++;
  }
  const userId = args.get("user");
  if (!userId) throw new Error("expected --user <id>");
  const briefingDate = args.get("briefing-date") ?? null;
  if (briefingDate && !/^\d{4}-\d{2}-\d{2}$/.test(briefingDate)) {
    throw new Error("expected --briefing-date YYYY-MM-DD");
  }
  return {
    userId,
    briefingDate,
    to: args.get("to") ?? null,
    dryRun: flags.has("dry-run"),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const sb = supabase();
  const startedAt = new Date().toISOString();

  // Open agent_sessions row.
  const sessionInsert = await sb
    .from("agent_sessions")
    .insert({
      jurisdiction_id: "austin-city-council",
      meeting_id: null,
      runtime: "emailer",
      started_at: startedAt,
      status: "running",
      items_processed: 0,
      notes: `T-24 email user=${args.userId}${args.briefingDate ? ` date=${args.briefingDate}` : ""}${args.dryRun ? " --dry-run" : ""}`,
    })
    .select("id")
    .single();
  if (sessionInsert.error || !sessionInsert.data) {
    throw new Error(`agent_sessions insert: ${sessionInsert.error?.message}`);
  }
  const sessionId = sessionInsert.data.id as number;

  try {
    // 1. Load briefing — latest by date if not pinned.
    const q = sb
      .from("briefings")
      .select("user_id, briefing_date, payload")
      .eq("user_id", args.userId)
      .order("briefing_date", { ascending: false });
    const { data: row, error } = args.briefingDate
      ? await q.eq("briefing_date", args.briefingDate).maybeSingle()
      : await q.limit(1).maybeSingle();
    if (error) throw new Error(`briefing load: ${error.message}`);
    if (!row) throw new Error(`no briefing for user=${args.userId}`);

    // 2. Render.
    const appUrl = process.env["APP_URL"] ?? "http://localhost:3000";
    const rendered = renderBriefingEmail({
      payload: row.payload as Parameters<typeof renderBriefingEmail>[0]["payload"],
      briefingDate: row.briefing_date as string,
      userId: row.user_id as string,
      appUrl,
    });

    console.log(`[T-24] rendered subject="${rendered.subject}"`);
    console.log(`[T-24] text length=${rendered.text.length} html length=${rendered.html.length}`);

    if (args.dryRun) {
      console.log("[T-24] dry-run: skipping send");
      console.log("\n--- text ---\n");
      console.log(rendered.text);
      await sb
        .from("agent_sessions")
        .update({
          finished_at: new Date().toISOString(),
          status: "success",
          items_processed: 0,
          notes: `T-24 email DRY-RUN user=${args.userId} subject="${rendered.subject}"`,
        })
        .eq("id", sessionId);
      return;
    }

    // 3. Send via Resend.
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) throw new Error("RESEND_API_KEY not set");
    const from = process.env["EMAIL_FROM"] ?? "Revere <onboarding@resend.dev>";
    const to = args.to ?? process.env["DEMO_INBOX"];
    if (!to) throw new Error("expected --to <email> OR DEMO_INBOX env var");

    const resend = new Resend(apiKey);
    const { data: sendData, error: sendErr } = await resend.emails.send({
      from,
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    if (sendErr) {
      throw new Error(`resend send: ${sendErr.name} — ${sendErr.message}`);
    }
    console.log(`[T-24] sent id=${sendData?.id ?? "?"} to=${to}`);

    await sb
      .from("agent_sessions")
      .update({
        finished_at: new Date().toISOString(),
        status: "success",
        items_processed: 1,
        notes: `T-24 email DONE user=${args.userId} to=${to} resend_id=${sendData?.id ?? "?"} subject="${rendered.subject}"`,
      })
      .eq("id", sessionId);
  } catch (err) {
    await sb
      .from("agent_sessions")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        notes: `T-24 email failed: ${(err as Error).message}`,
      })
      .eq("id", sessionId);
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
