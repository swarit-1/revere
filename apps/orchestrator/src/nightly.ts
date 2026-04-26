// End-to-end nightly pipeline runner. Per Session 9 / T-19.
//
// Runs the full chain on the latest meeting (or a flagged meeting):
//   ingest (skipped by default — re-ingest is rare) →
//   verify all candidate_items missing reports →
//   match per persona →
//   compose per persona →
//   email per persona (if --email)
//
// Opens an `agent_sessions` row of runtime=`nightly` that ties the
// whole run together. Each phase opens its own session row too;
// the trace modal reads from those independently.
//
// Usage:
//   pnpm nightly                                # latest meeting, no email
//   pnpm nightly --meeting <db_id>              # specific meeting
//   pnpm nightly --meeting 1 --email            # also send Resend emails
//   pnpm nightly --meeting 1 --skip-verify      # match + compose only
//   pnpm nightly --dry-run                      # log plan; no writes

import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { supabase } from "./lib/supabase.js";

const here = dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  resolve(here, "..", ".env.local"),
  resolve(here, "..", "..", "..", ".env.local"),
];
for (const p of envCandidates) {
  if (existsSync(p)) {
    loadEnv({ path: p });
    break;
  }
}

interface Args {
  meetingDbId: number | null;
  skipVerify: boolean;
  skipMatch: boolean;
  skipCompose: boolean;
  email: boolean;
  dryRun: boolean;
  personas: string[];
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

  const meetingRaw = args.get("meeting");
  const personasRaw = args.get("personas");
  return {
    meetingDbId: meetingRaw ? Number.parseInt(meetingRaw, 10) : null,
    skipVerify: flags.has("skip-verify"),
    skipMatch: flags.has("skip-match"),
    skipCompose: flags.has("skip-compose"),
    email: flags.has("email"),
    dryRun: flags.has("dry-run"),
    personas: personasRaw ? personasRaw.split(",").map((s) => s.trim()) : ["maya", "jason"],
  };
}

async function resolveLatestMeeting(): Promise<{ id: number; meeting_date: string }> {
  const { data, error } = await supabase()
    .from("meetings")
    .select("id, meeting_date")
    .order("meeting_date", { ascending: false })
    .limit(1)
    .single();
  if (error || !data) throw new Error(`no meetings: ${error?.message}`);
  return { id: data.id as number, meeting_date: data.meeting_date as string };
}

async function resolveMeeting(id: number): Promise<{ id: number; meeting_date: string }> {
  const { data, error } = await supabase()
    .from("meetings")
    .select("id, meeting_date")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(`meeting ${id} not found: ${error?.message}`);
  return { id: data.id as number, meeting_date: data.meeting_date as string };
}

interface PhaseResult {
  phase: string;
  status: "ok" | "skipped" | "failed";
  duration_ms: number;
  notes?: string;
}

async function runPhase(name: string, cmd: string, args: string[], dryRun: boolean): Promise<PhaseResult> {
  if (dryRun) {
    console.log(`[nightly] DRY RUN ${name}: ${cmd} ${args.join(" ")}`);
    return { phase: name, status: "skipped", duration_ms: 0, notes: "dry-run" };
  }
  const startedAt = Date.now();
  console.log(`\n========== nightly: ${name} ==========`);
  console.log(`[nightly] $ ${cmd} ${args.join(" ")}`);
  return new Promise<PhaseResult>((resolveProm) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("error", (err) => {
      resolveProm({
        phase: name,
        status: "failed",
        duration_ms: Date.now() - startedAt,
        notes: err.message,
      });
    });
    child.on("close", (code) => {
      const duration_ms = Date.now() - startedAt;
      if (code === 0) {
        resolveProm({ phase: name, status: "ok", duration_ms });
      } else {
        resolveProm({
          phase: name,
          status: "failed",
          duration_ms,
          notes: `exit=${code}`,
        });
      }
    });
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const sb = supabase();

  const meeting = args.meetingDbId
    ? await resolveMeeting(args.meetingDbId)
    : await resolveLatestMeeting();
  const meetingId = meeting.id;
  const briefingDate = meeting.meeting_date;
  console.log(
    `[nightly] target meeting_id=${meetingId} date=${briefingDate} personas=${args.personas.join(",")}`,
  );

  // Open the umbrella session row.
  const sessionInsert = await sb
    .from("agent_sessions")
    .insert({
      jurisdiction_id: "austin-city-council",
      meeting_id: meetingId,
      runtime: "nightly",
      started_at: new Date().toISOString(),
      status: "running",
      items_processed: 0,
      notes: `T-19 nightly meeting=${meetingId} personas=${args.personas.join(",")}${args.email ? " +email" : ""}`,
    })
    .select("id")
    .single();
  if (sessionInsert.error || !sessionInsert.data) {
    throw new Error(`agent_sessions insert: ${sessionInsert.error?.message}`);
  }
  const sessionId = sessionInsert.data.id as number;

  const phases: PhaseResult[] = [];
  const tsx = "npx";
  const tsxArgs = (script: string, scriptArgs: string[]) => ["tsx", `src/${script}`, ...scriptArgs];

  try {
    if (!args.skipVerify) {
      phases.push(
        await runPhase(
          "verify",
          tsx,
          tsxArgs("verify/verify.ts", ["--meeting", String(meetingId)]),
          args.dryRun,
        ),
      );
    } else {
      phases.push({ phase: "verify", status: "skipped", duration_ms: 0, notes: "--skip-verify" });
    }

    if (!args.skipMatch) {
      for (const persona of args.personas) {
        phases.push(
          await runPhase(
            `match:${persona}`,
            tsx,
            tsxArgs("match/match.ts", ["--user", persona, "--briefing-date", briefingDate]),
            args.dryRun,
          ),
        );
      }
    } else {
      phases.push({ phase: "match", status: "skipped", duration_ms: 0, notes: "--skip-match" });
    }

    if (!args.skipCompose) {
      for (const persona of args.personas) {
        phases.push(
          await runPhase(
            `compose:${persona}`,
            tsx,
            tsxArgs("compose/compose.ts", ["--user", persona, "--briefing-date", briefingDate]),
            args.dryRun,
          ),
        );
      }
    } else {
      phases.push({ phase: "compose", status: "skipped", duration_ms: 0, notes: "--skip-compose" });
    }

    if (args.email) {
      for (const persona of args.personas) {
        phases.push(
          await runPhase(
            `email:${persona}`,
            tsx,
            tsxArgs("email/email.ts", ["--user", persona, "--briefing-date", briefingDate]),
            args.dryRun,
          ),
        );
      }
    }

    const failures = phases.filter((p) => p.status === "failed");
    const ok = phases.filter((p) => p.status === "ok");
    const skipped = phases.filter((p) => p.status === "skipped");
    const totalMs = phases.reduce((acc, p) => acc + p.duration_ms, 0);

    const summary = [
      `T-19 nightly DONE meeting=${meetingId}`,
      `phases ok=${ok.length} skipped=${skipped.length} failed=${failures.length} total_ms=${totalMs}`,
      ...phases.map((p) => `  ${p.phase}: ${p.status} (${p.duration_ms}ms)${p.notes ? ` — ${p.notes}` : ""}`),
    ].join("\n");

    console.log(`\n${summary}`);

    await sb
      .from("agent_sessions")
      .update({
        finished_at: new Date().toISOString(),
        status: failures.length > 0 ? "failed" : "success",
        items_processed: ok.length,
        notes: summary,
      })
      .eq("id", sessionId);

    if (failures.length > 0) {
      process.exit(1);
    }
  } catch (err) {
    await sb
      .from("agent_sessions")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        notes: `T-19 nightly failed: ${(err as Error).message}`,
      })
      .eq("id", sessionId);
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
