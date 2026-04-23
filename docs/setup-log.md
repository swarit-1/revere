# Setup Log

Frozen snapshot of the Session 0 environment. Updated each time a new tool
or account is wired in.

## Session 0 — 2026-04-23

### Toolchain
- Node `v24.13.0` (system)
- Corepack `0.34.5`
- pnpm `9.12.0` (pinned via root `packageManager` + Corepack shim)

### External services (T-03 — auth'd)
- GitHub — account `swarit-1`, scopes `gist, read:org, repo, workflow`
- Supabase — project `exuqzhnbffpsxxhkcciq` ("swarit-1's Project"), region
  **West US (Oregon)**. Not yet linked to this repo; defer to T-12 (schema
  migration), at which point run `supabase link --project-ref exuqzhnbffpsxxhkcciq`.
- Vercel — account `swarit-1`. Project not linked yet; defer to T-23 (web
  deploy).
- Google Cloud — account `swaritsrivastava22@gmail.com`. Project not yet
  created; defer to T-13 (orchestrator deploy). Cloud Run region will be
  `us-west1` to colocate with the Supabase Oregon project.

### Research previews (T-02 — DEFERRED)
Not submitted this session. Three applications still owed to Anthropic:
- Managed Agents Outcomes research preview (blocks native T-16; we build
  the Messages-API grader anyway)
- Managed Agents Memory research preview (nice-to-have; Supabase is the
  honest fallback per PRD §12.5)
- Multi-agent research preview (strengthens T-13/T-14 narrative if granted)

### API credentials (T-01)
Hackathon registration + `$1,000` credit grant assumed complete on
Anthropic Console (external confirmation, not captured here). API key is
never committed; it lives in `apps/orchestrator/.env.local` once drafting
work begins.
