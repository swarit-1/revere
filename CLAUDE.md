# Revere — Project Constitution

Revere is a personal civic chief of staff: it runs overnight, reads Austin's
public record, filters every item through a user's civic fingerprint, verifies
every claim against source, and delivers a morning briefing. See @revere-prd.md
for full spec. This file is the always-on rules.

## Code style

- TypeScript for all new code. Strict mode on. No `any`.
- Next.js 16 app router. Server components by default.
- Tailwind for styling. No separate CSS files.
- ES modules (`import`/`export`), never CommonJS.
- Destructure imports: `import { foo } from 'bar'`.
- Short functions. Small files. Co-locate tests next to source.

## Claude-specific rules

- Models: Opus 4.7 for verification, drafting, synthesis, vision.
  Sonnet 4.6 for summaries. Haiku 4.5 for bulk classification.
  Always pick the cheapest model that clears the quality bar.
- Always use the Messages API via `@anthropic-ai/sdk`. Never hand-roll HTTP.
- Use prompt caching on every call with a system prompt > 1K tokens
  (skill packs, jurisdiction configs).
- When adding a feature, check @.claude/skills/ first for relevant playbooks.

## Workflow

- Plan mode for anything touching more than one file. Just edit, no plan, for one-line fixes.
- After editing TypeScript: run `pnpm typecheck`. After editing tests: run them.
- Commit after every working task step, not at the end. Small commits ease rollback.
- Branch naming: `feat/<day>-<slug>`, `fix/<slug>`. PRs to `main`.

## Verification (non-negotiable)

- If you write code, you write a verification method. Test, lint, typecheck, or screenshot.
- If you can't verify it, you don't ship it.
- For frontend changes: use the Claude in Chrome extension to screenshot and
  compare visually.

## What this project is NOT

- Not a voting platform. Not partisan. Not a ballot rater in v1.
- Never auto-submits public comments or representative emails on a user's behalf.
- Does not handle PII beyond district-granularity location.

## Common gotchas

- Managed Agents sessions are ephemeral. Durable state lives in Supabase.
- `xhigh` effort and `task_budget` are Messages API features, not Managed Agents.
- Opus 4.7 uses a new tokenizer; rough text input is 1.0–1.35x more tokens than 4.6.
- Adaptive thinking is the only thinking mode on 4.7. Use `display: summarized`
  so UI doesn't go silent during long reasoning.

## References

- Full PRD: @revere-prd.md
- Architecture: @docs/architecture.md
- Demo script: @docs/demo-script.md
- Jurisdiction skills: @.claude/skills/jurisdictions/
