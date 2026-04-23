# Revere — Session 0: Setup (T-01 → T-04)

## Context

Revere is a one-person, one-week hackathon build ([revere-prd.md §20](../../../Documents/revere/revere/PRD.md)). The Setup cluster (T-01 → T-04, all Critical) has to land before any product work can begin: hackathon + API access, Managed Agents research-preview applications (gate time unknown — submit TODAY), external services (GitHub/Supabase/Vercel/Cloud Run), and a TypeScript-strict monorepo skeleton that every downstream task (T-05+) plugs into. The goal of Session 0 is a clean, committed scaffold that matches PRD §12.1 and setup-guide §1.4, with a root CLAUDE.md that captures the non-negotiables so the rest of the week doesn't drift.

> **Plan file location note.** Plan Mode only permits edits to this file (`~/.claude/plans/revere-session-iterative-spark.md`). Execute step 0 below copies this plan to `docs/plans/session-0-setup.md` inside the repo per the Session 0 spec.

---

## Operating constraints this session

- TypeScript strict from commit 1. `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. No `any`, no `// @ts-ignore`.
- pnpm workspaces. Next.js 16. Node 20.11+.
- Commit per gate: `git commit -m "T-XX: <gate description>"`. Push to origin after each gate.
- Don't skip a gate. If T-0X gate doesn't fire, the task stays open regardless of code written.
- External write actions (push, provisioning, spending credits) require explicit confirmation before I run them.

---

## Execution order

External dependencies are flagged with 🕓 (wait on user/provider) and 🔨 (I can run).

### T-01 — Hackathon registration + API credits confirmed

| Step | Who | Action |
|---|---|---|
| 1 | 🕓 you | Confirm you're registered for the "Built with Opus 4.7" hackathon (check confirmation email). Paste the confirmation URL/ID back into the session. |
| 2 | 🕓 you | Log in to console.anthropic.com → Billing. Confirm $1,000 hackathon credits are visible on the account. Screenshot or paste balance. |
| 3 | 🕓 you | Create an API key labeled `revere-dev` (console.anthropic.com → API Keys). Store in 1Password or equivalent; paste into `apps/orchestrator/.env.local` later (NOT in repo). |
| 4 | 🔨 me | Smoke-test the key with a 10-token `claude-haiku-4-5-20251001` call via `curl` + `jq`. (Only after you paste the key into a local env var — I will not read the key from disk.) |

**Gate.** Console shows balance; smoke-test returns a 200 + token usage log.
**Commit.** `T-01: hackathon credentials + API smoke test confirmed` (commit is empty or just touches a .md log — the gate is external).

### T-02 — Research-preview applications (DO IN PARALLEL WITH T-01)

🕓 You do all three today. Submission-gate time is unknown; earlier = more runway.

| Preview | Where | Why it matters |
|---|---|---|
| Managed Agents Outcomes | Anthropic research-preview form | T-16 — native outcomes-graded briefings. Fallback = Messages API grader (we build it anyway). |
| Managed Agents Memory | Anthropic research-preview form | Optional nice-to-have; Supabase is the honest fallback (PRD §12.5). |
| Multi-agent research preview | Anthropic research-preview form | Strengthens T-13/T-14 story if granted. |

**Gate.** Three submission confirmations (email or submission-ID). Paste into session; I'll add them to `docs/research-preview-applications.md` as a tracking log.
**Commit.** `T-02: research-preview applications submitted`.

### T-03 — Provision external services

Order: GitHub first (T-04 needs an origin), then Supabase/Vercel/Cloud Run in parallel.

| Service | Manual (🕓 you) | CLI (🔨 me, after you auth) |
|---|---|---|
| **GitHub** | Run `gh auth login` in your terminal once (browser OAuth). Pick the org/account for the repo. | `gh repo create revere --private --source=. --remote=origin` (public vs. private confirmed below). |
| **Supabase** | Create project at supabase.com/dashboard. Pick region (`us-central-1` recommended — closest to Cloud Run us-central1). Save project ref + anon/service keys. | Install CLI (`brew install supabase/tap/supabase`). `supabase login`. `supabase link --project-ref <ref>`. |
| **Vercel** | Create account if new (vercel.com). | `npm i -g vercel`. `vercel login`. We link the project after first deploy in T-23. |
| **Google Cloud** | Create GCP project `revere-prod` in console.cloud.google.com. Enable billing. Enable Cloud Run + Cloud Scheduler + Secret Manager APIs. | `gcloud auth login`. `gcloud config set project revere-prod`. |
| **Domain** (optional) | Skip for v1; Vercel-generated URL is fine for demo. Buy later if needed. | n/a |

**Gate.** A single shell check passes:
```bash
gh auth status && supabase projects list >/dev/null && vercel whoami && gcloud auth list --filter=status:ACTIVE --format=value\(account\)
```
All four print a logged-in identity.
**Commit.** `T-03: external services provisioned + auth'd` (touches `docs/setup-log.md` with the four tool versions).

### T-04 — Repo skeleton + constitution

Executed in order. Every sub-step runs typecheck at the end.

**Step 0 — Rename + save referenced files.**
- `rm revere-prd.md` (current empty placeholder created by earlier `touch`).
- `git mv PRD.md revere-prd.md` — matches every existing `@revere-prd.md` reference.
- `Write revere-claude-code-setup.md` at repo root with the §3–§9 content from this conversation. Add a top-of-file note: `§§1, 2, 3.1 TBD — paste before T-05`. (See "Open questions" below.)
- Copy this plan file → `docs/plans/session-0-setup.md`.

**Step 1 — Root tooling.**
Write these files (contents drafted below):
- `pnpm-workspace.yaml`
- `package.json` (root)
- `tsconfig.base.json`
- `.gitignore`
- `.nvmrc`
- `README.md` (rewrite current empty)

**Step 2 — Root CLAUDE.md.**
Rewrite current empty `CLAUDE.md` with the draft in the "Proposed root CLAUDE.md" section below. **You review before I write.**

**Step 3 — apps/web scaffold.**
Next.js 16 + TS + Tailwind. Minimal home page (one route). Uses `@revere/shared` via workspace link. Files:
- `apps/web/package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`
- `apps/web/app/layout.tsx`, `page.tsx`, `globals.css`

**Step 4 — apps/orchestrator scaffold.**
Node + TS. Stub entry point that logs a startup message. Deps: `@anthropic-ai/sdk`, `@supabase/supabase-js`, `@revere/shared`.
- `apps/orchestrator/package.json`, `tsconfig.json`, `src/index.ts`

**Step 5 — packages/shared.**
TypeScript types package. Seed `types/fingerprint.ts` matching PRD §8.2 exactly. Export barrel in `src/index.ts`.
- `packages/shared/package.json`, `tsconfig.json`, `src/index.ts`, `src/types/fingerprint.ts`

**Step 6 — packages/managed-agents.**
Stub for agent/environment definitions (T-13 fills it out).
- `packages/managed-agents/package.json`, `tsconfig.json`, `src/index.ts`

**Step 7 — Install + verify.**
- `pnpm install` at root
- `pnpm typecheck` at root (fans out to all workspaces) → must be zero errors
- `pnpm --filter @revere/web dev` briefly to confirm Next.js boots

**Step 8 — Commit + push.**
- `git add -A`
- `git commit -m "T-04: repo skeleton + constitution"`
- `git push -u origin main`

**Gate.**
- `git status` clean on `main`
- `git log --oneline` shows T-01/T-02/T-03/T-04 commits in order
- `gh repo view` shows the pushed tree

---

## Account/service matrix (summary)

| Task | You do (🕓 manual) | I do (🔨 CLI) | Gate artifact |
|---|---|---|---|
| T-01 | Register hackathon; confirm $1k credits; create API key | API smoke-test | Console screenshot + 200 response |
| T-02 | Submit 3 research-preview forms | n/a | 3 submission confirmations |
| T-03 | `gh auth login`; create Supabase/Vercel accounts + GCP project; enable billing | `gh repo create`; `supabase link`; `vercel login`; `gcloud auth login` | 4-tool auth-status check passes |
| T-04 | Review CLAUDE.md draft; approve repo visibility | Everything else | `git push` succeeds; clean status |

---

## Proposed root `CLAUDE.md` (review before I write)

```markdown
# Revere — Claude Code Constitution

Personal civic chief of staff. Runs overnight, reads city/ISD/state public
record, filters through a voice-built civic fingerprint, verifies every claim
against source, and delivers a morning briefing + draft replies.
**Never autosends.**

## Source of truth
- Product spec: @revere-prd.md
- Workflow: @revere-claude-code-setup.md
- Conflict rule: PRD wins on product; setup guide wins on process.

## Stack
- pnpm workspaces
- apps/web — Next.js 16 + TS + Tailwind (deploy: Vercel)
- apps/orchestrator — Node + TS on Cloud Run
- packages/shared — workspace-shared types
- packages/managed-agents — agent + environment configs
- Data: Supabase (Postgres + Auth)
- Scheduling: Claude Code Routines; fallback Cloud Run Scheduled Jobs
- Models: Opus 4.7 (synthesis, verification, drafting), Sonnet 4.6 (scraping),
  Haiku 4.5 (classification). See PRD §15 for routing.

## TypeScript rules (non-negotiable from commit 1)
- `strict: true`, `noUncheckedIndexedAccess: true`,
  `exactOptionalPropertyTypes: true`
- No `any`. No `// @ts-ignore`. No `// @ts-expect-error` without a linked
  issue in the adjacent comment.
- Errors surface; they do not get swallowed.

## Skills, subagents, commands
Skills — `.claude/skills/`:
- `jurisdictions/austin-city-council/SKILL.md` — Austin ingestion
- `jurisdictions/aisd/SKILL.md` — AISD (shallower)
- `jurisdictions/texas-lege/SKILL.md` — Texas Lege (shallower)
- `verification/SKILL.md` — per-claim source-check protocol
- `fingerprint/SKILL.md` — relevance scoring + anti-priority rules
- `drafting/SKILL.md` — public-comment / rep-email / phone-script templates

Subagents — `.claude/agents/`: `legistar-scraper`, `verification-auditor`,
`demo-rehearser`. Use sparingly — prefer @-referencing a skill from the main
agent over spawning a subagent.

Slash commands — `.claude/commands/`: `/plan`, `/verify`, `/stage-demo`.

## Workflow
- Every task in @revere-prd.md §20 has a gate. The task isn't done until the
  gate fires.
- Commit per gate: `git commit -m "T-XX: <gate description>"`. Git log is the
  status board.
- `/clear` between unrelated tasks; a fresh session beats an
  accumulated-correction session.
- Research → Plan → Execute → Review → Ship. Don't skip Plan Mode for
  non-trivial work (see setup guide §8).

## The ethical floor (production + development)
- Product: never autosends (PRD §10.4).
- Development: never skip hooks (`--no-verify`), never force-push to `main`,
  never commit secrets. External writes (push, deploy, provision) wait for
  explicit approval.

## Verification
- Post-edit hook (`.claude/hooks/post-edit.sh`) runs `pnpm typecheck` on TS
  edits automatically.
- Before any "done" claim: `/verify` or manual `pnpm typecheck && pnpm test
  && pnpm lint`.
- For UI changes: boot `pnpm dev`, visit the page, screenshot.

## Hard don'ts
- Don't create planning or summary markdown files unless asked.
- Don't write comments explaining what code does — only why, when non-obvious.
- Don't add abstractions for hypothetical future needs.
- Don't commit without a gate firing.
- Don't conflate Opus 4.7 model features with platform features (see PRD §13).
```

---

## Proposed root tooling files

### `pnpm-workspace.yaml`
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### `package.json` (root)
```json
{
  "name": "revere",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "dev": "pnpm --filter @revere/web dev"
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  },
  "packageManager": "pnpm@9.12.0",
  "engines": {
    "node": ">=20.11.0"
  }
}
```

### `tsconfig.base.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "jsx": "preserve"
  }
}
```

### `.gitignore`
```gitignore
# dependencies
node_modules/

# build + cache
dist/
build/
out/
.next/
.turbo/
.vercel/
.tsbuildinfo

# env
.env
.env.local
.env*.local

# logs + coverage
*.log
coverage/

# os / editor
.DS_Store
Thumbs.db
.idea/
```

### `.nvmrc`
```
20.11.0
```

### `README.md` (rewrite)
```markdown
# Revere

Personal civic chief of staff. Runs overnight, reads the public record,
filters through a voice-built civic fingerprint, verifies every claim,
and delivers a morning briefing + draft replies. Never autosends.

Hackathon submission · Built with Opus 4.7 · April 2026.

## Getting started
```bash
pnpm install
pnpm dev   # boots apps/web at http://localhost:3000
```

Full product spec: [revere-prd.md](revere-prd.md).
Working constitution: [CLAUDE.md](CLAUDE.md).
Claude Code workflow: [revere-claude-code-setup.md](revere-claude-code-setup.md).
```

---

## Proposed `apps/web` skeleton

### `apps/web/package.json`
```json
{
  "name": "@revere/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "next lint"
  },
  "dependencies": {
    "@revere/shared": "workspace:*",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.12",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.12.0",
    "eslint-config-next": "^16.0.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.3"
  }
}
```

### `apps/web/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./app/*"] },
    "noEmit": true,
    "incremental": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### `apps/web/next.config.mjs`
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@revere/shared"],
};
export default nextConfig;
```

### `apps/web/tailwind.config.ts`
```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

### `apps/web/postcss.config.mjs`
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

### `apps/web/app/layout.tsx`
```tsx
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Revere",
  description: "Your personal civic chief of staff.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

### `apps/web/app/page.tsx`
```tsx
export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-4xl font-serif">Revere</h1>
      <p className="mt-4 text-neutral-600">
        Your personal civic chief of staff. Wakes up while you sleep.
      </p>
    </main>
  );
}
```

### `apps/web/app/globals.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## Proposed `apps/orchestrator` skeleton

### `apps/orchestrator/package.json`
```json
{
  "name": "@revere/orchestrator",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "echo \"(no tests yet)\""
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.1",
    "@revere/shared": "workspace:*",
    "@supabase/supabase-js": "^2.45.4"
  },
  "devDependencies": {
    "@types/node": "^20.12.12",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}
```

### `apps/orchestrator/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

### `apps/orchestrator/src/index.ts`
```ts
const BOOT_MESSAGE = "[revere-orchestrator] online";

function main(): void {
  // eslint-disable-next-line no-console
  console.log(BOOT_MESSAGE);
}

main();
```

---

## Proposed `packages/shared`

### `packages/shared/package.json`
```json
{
  "name": "@revere/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "echo \"(no tests yet)\""
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
```

### `packages/shared/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src/**/*"]
}
```

### `packages/shared/src/index.ts`
```ts
export * from "./types/fingerprint.js";
```

### `packages/shared/src/types/fingerprint.ts`
```ts
// Matches revere-prd.md §8.2 exactly. Keep this file as the canonical shape.

export type RelevanceSlider = "strict" | "balanced" | "loose";

export type CommuteMode = "car" | "bus" | "bike" | "walk" | "remote";

export type HousingStatus = "renter" | "owner";

export type BuildingType = "market_rate" | "income_restricted" | "owned";

export type HouseholdRole = "self" | "partner" | "child" | "parent" | "other";

export interface HouseholdMember {
  role: HouseholdRole;
  age_bracket?: string;
  age?: number;
  school?: string;
}

export interface Priority {
  topic: string;
  weight: number;
}

export interface FingerprintLocation {
  city: string;
  county: string;
  state: string;
  council_district: number;
  isd: string;
  school_zone?: string;
  state_house_district: number;
  state_senate_district: number;
  us_house_district: number;
}

export interface FingerprintHousing {
  status: HousingStatus;
  unit_type: string;
  approximate_rent?: number;
  building_type?: BuildingType;
}

export interface FingerprintWork {
  commute_mode: CommuteMode;
  commute_route_keywords: string[];
  sector: string;
}

export type FeedbackEvent = "thumb_up" | "thumb_down" | "edit" | "dismiss";

export interface FeedbackHistoryEntry {
  at: string;
  event: FeedbackEvent;
  target_item_id?: string;
}

export interface Fingerprint {
  user_id: string;
  location: FingerprintLocation;
  housing: FingerprintHousing;
  household: HouseholdMember[];
  work: FingerprintWork;
  priorities: Priority[];
  anti_priorities: string[];
  relevance_slider: RelevanceSlider;
  learned_voice_style: Record<string, unknown>;
  feedback_history: FeedbackHistoryEntry[];
}
```

---

## Proposed `packages/managed-agents`

### `packages/managed-agents/package.json`
```json
{
  "name": "@revere/managed-agents",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
```

### `packages/managed-agents/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src/**/*"]
}
```

### `packages/managed-agents/src/index.ts`
```ts
// Agent + environment definitions land here in T-13. See revere-prd.md §12.1.
export {};
```

---

## Gate matrix

| Task | Observable proof |
|---|---|
| T-01 | Hackathon confirmation URL/ID pasted in session + console balance screenshot + `curl` smoke-test returning 200 + token usage |
| T-02 | Three submission confirmations (email subject lines or IDs) pasted into session; logged in `docs/research-preview-applications.md` |
| T-03 | `gh auth status && supabase projects list && vercel whoami && gcloud auth list` all succeed |
| T-04 | `git status` clean; `git log --oneline` shows T-01..T-04 commits; `gh repo view` shows pushed tree; `pnpm typecheck` exits 0 |

---

## End-to-end verification

After T-04 completes:

1. Fresh terminal: `cd /Users/swart/Documents/revere/revere`.
2. `pnpm install` — no errors.
3. `pnpm typecheck` — 4 packages, zero errors.
4. `pnpm dev` — Next.js boots; visit http://localhost:3000; see "Revere" headline.
5. `git log --oneline` — four commits with T-01..T-04 prefixes.
6. `gh repo view --web` — repo exists, README renders, PRD + CLAUDE.md + setup guide visible.
7. Open a new Claude Code session; type `/plan`. The command should pick up the preamble and `@revere-prd.md §7` resolves to real content (not empty).

If any of these fail, T-04 stays open.

---

## Open questions / flags (answer before execute)

1. **Setup-guide §§1, 2, 3.1 missing.** The setup guide content you gave me starts at §3.2. §1.4 (directory tree) was inferred from the tree we already built; §2 (CLAUDE.md) I've reconstructed in the "Proposed root CLAUDE.md" section above. If you have the original §§1–2 text, paste it before Step 0 and I'll reconcile. Otherwise the reconstructed CLAUDE.md stands.
2. **GitHub repo visibility.** PRD §20.11's ship checklist says "GitHub repo public with clean README." Propose `--private` for the build week, flip to `--public` right before submission. OK, or make it public now?
3. **GitHub repo name + org.** Proposing `revere` under your personal account. Confirm.
4. **apps/orchestrator language.** PRD §12.1 says "Node/Python". Proposing Node + TS for stack consistency (one lockfile, one typecheck, one CI story). Confirm.
5. **Cloud Run region + Supabase region.** Proposing both `us-central1` / `us-central-1` to minimize latency between ingestion orchestrator and DB. Confirm.
6. **Domain purchase.** Defer to post-MVP; use the Vercel-generated URL. Confirm.
7. **TypeScript version.** Locking to `^5.6.3`. Confirm.
8. **Package manager version.** Locking to `pnpm@9.12.0` via root `packageManager` field + Corepack. You'll need `corepack enable` once on this machine. Confirm.
