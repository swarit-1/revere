---
description: Run all verification steps on the current working tree
---

Run in this order:
1. `pnpm typecheck` in apps/web and apps/orchestrator
2. `pnpm test` in any package that has tests
3. `pnpm lint`
4. If any frontend changed, use Claude in Chrome to screenshot and verify.
Report results. Do NOT fix anything yet — just report.
