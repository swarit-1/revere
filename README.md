# Revere

Personal civic chief of staff. Runs overnight, reads the public record,
filters through a voice-built civic fingerprint, verifies every claim,
and delivers a morning briefing + draft replies. Never autosends.

Hackathon submission · Built with Opus 4.7 · April 2026.

## Getting started

```bash
corepack enable
pnpm install
pnpm dev   # boots apps/web at http://localhost:3000
```

## Layout

- `apps/web` — Next.js 16 frontend (deploy: Vercel)
- `apps/orchestrator` — Node + TS backend (deploy: Cloud Run)
- `packages/shared` — cross-workspace TypeScript types
- `packages/managed-agents` — Managed Agents configs + environments
- `.claude/` — skills, subagents, slash commands, hooks
- `docs/` — architecture, demo script, plans, setup log

## References

- Product spec: [revere-prd.md](revere-prd.md)
- Working constitution: [CLAUDE.md](CLAUDE.md)
- Claude Code workflow: [revere-claude-code-setup.md](revere-claude-code-setup.md)
