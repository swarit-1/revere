# T-19 — Nightly pipeline + Vercel cron

`pnpm nightly` runs the full chain end-to-end. The Vercel-hosted
`/api/cron/nightly` route is the visible trigger surface; the
orchestrator runs out-of-band.

## Pipeline shape

```
ingest        ← skipped by default (re-ingest is rare)
verify        ← Sonnet 4.6 per item missing a report (T-15)
match:maya    ← per-fingerprint scoring → briefing_items
match:jason
compose:maya  ← Opus 4.7 per persona → briefings
compose:jason
email:maya    ← optional --email flag (T-24)
email:jason
```

Each phase is a sub-process spawned from `nightly.ts`. Failures
are surfaced in the umbrella `agent_sessions` row but don't halt
later phases — partial completion is logged with `failed=N` so
the operator can re-run just the missing phase.

## Smoke run

```
$ pnpm nightly --meeting 1 --skip-verify

[nightly] target meeting_id=1 date=2026-04-09 personas=maya,jason
========== nightly: match:maya ==========
[T-17] DONE persisted=37
[T-17] T-17 match complete: 37 briefing_items persisted | surfaced: maya=8/37 | tokens in/out/cache_read/cache_create: 56142/4291/0/0 | sonnet calls: 37
========== nightly: match:jason ==========
[T-17] DONE persisted=37
[T-17] T-17 match complete: 37 briefing_items persisted | surfaced: jason=4/37 | tokens in/out/cache_read/cache_create: 59540/4444/0/0 | sonnet calls: 37
========== nightly: compose:maya ==========
[T-18] maya → briefing_id=2 surfaced=8 top="Rezoning hearing for 1811 East Cesar Chavez to allow liquor "
========== nightly: compose:jason ==========
[T-18] jason → briefing_id=1 surfaced=4 top="Rezoning hearing for 1811 East Cesar Chavez to allow liquor "

T-19 nightly DONE meeting=1
phases ok=4 skipped=1 failed=0 total_ms=224523
  verify: skipped (0ms) — --skip-verify
  match:maya: ok (100248ms)
  match:jason: ok (94515ms)
  compose:maya: ok (17785ms)
  compose:jason: ok (11975ms)
```

End-to-end runtime: **~3.7 minutes** for the seeded 56-candidate
meeting (with verification skipped — verification adds ~10 minutes
on a cold meeting). Within reasonable bounds for a long-lived host.

## agent_sessions row

The umbrella `nightly` row carries the full per-phase summary in
`notes`. Per-phase rows (`matcher`, `composer`, `verifier`,
`emailer`) are still written by their respective CLIs and are the
ones the trace modal consumes for individual items.

```json
{
  "runtime": "nightly",
  "status": "success",
  "items_processed": 4,
  "notes": "T-19 nightly DONE meeting=1\nphases ok=4 skipped=1 failed=0 total_ms=224523\n  verify: skipped (0ms) — --skip-verify\n  match:maya: ok (100248ms)\n  match:jason: ok (94515ms)\n  compose:maya: ok (17785ms)\n  compose:jason: ok (11975ms)"
}
```

## Vercel cron route

`/api/cron/nightly` deliberately does NOT execute the pipeline.
Serverless functions are bounded; the pipeline is multi-minute.
The route logs an `agent_sessions` row of runtime=`cron-trigger`
so the trace surface shows the trigger time. The actual run is
out-of-band via `pnpm nightly` on a long-lived host (Cloud Run,
GitHub Action runner, or screen session during the demo week).

```
=== unauthorized (no Authorization header) ===
$ curl -i 'http://localhost:3000/api/cron/nightly'
HTTP/1.1 401 Unauthorized

=== authorized (Bearer ${CRON_SECRET}) ===
$ curl -H "Authorization: Bearer $CRON_SECRET" 'http://localhost:3000/api/cron/nightly'
{
  "ok": true,
  "triggered_at": "2026-04-26T14:25:38.699Z",
  "session_id": 34,
  "meeting_id": 1,
  "note": "trigger logged; pipeline runs out-of-band via `pnpm nightly`"
}
```

## Vercel cron declaration

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/nightly",
      "schedule": "0 7 * * *"
    }
  ]
}
```

Schedule: 7am UTC daily. CT is UTC-5 (CDT) or UTC-6 (CST), so
this fires at 1am or 2am Austin time depending on DST — matches
PRD §12.2's "fires at 2am local time" intent without requiring
DST-aware cron.

## Architecture notes

- **Out-of-band pipeline**: serverless can't execute a 3-minute
  pipeline; the cron route is the trigger surface, not the
  worker. The pattern matches the PRD §12.2 fallback: "Cloud Run
  Scheduled Job hitting orchestrator". We log the trigger so the
  trust story works ("you got that 7am email because the cron
  fired this morning at 7:00:00"); the worker process is what
  delivered.
- **Phase isolation**: each phase is a separate sub-process spawn
  so a failure in match doesn't take down compose. Failed phases
  return non-zero from the spawn but `nightly.ts` aggregates and
  exits 1 only at the end.
- **Resumability**: each phase is idempotent. Re-running the
  nightly is safe; verification's `(candidate_item_id, verified_at)`
  unique constraint and matching's `(user_id, candidate_item_id,
  briefing_date)` constraint upsert without duplicates.

## Risks observed

- **First-run `--skip-verify` matters**: the seeded meeting has
  37/56 verified; the remaining 19 are intentionally skipped (PDF
  fetches that hung in T-15.5 follow-up). On a cold meeting,
  verify is the long pole.
- **Long-lived process**: the demo runs `pnpm nightly` on a screen
  session the night before. On hackathon week we keep it
  invocation-driven; production would move it to a Cloud Run job.
