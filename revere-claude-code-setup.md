# Revere — Claude Code Setup Guide

> **Status note.** §§1, 2, and 3.1 are TBD — they weren't included in the
> source material Claude Code was handed at session-0. They should be pasted
> in before T-05 so `@revere-claude-code-setup.md §1`/`§2` references resolve.
> §3.2 onward is verbatim from the source. When §§1–2 land, re-title this
> note or delete it.

## 3.2 Community skill worth installing

obra/superpowers — Jesse Vincent's skills library. 20+ skills including TDD
and debugging patterns, widely used in the community. Install selectively —
don't bulk-install everything.

## 3.3 Skills you write for Revere

These are the ones you build yourself, following the CrossBeam pattern. Every
SKILL.md has YAML frontmatter (name, description — Claude uses description as
a routing hint) and a body with clear instructions.

**Priority 1 (T-05, T-06 — unblocks all ingestion):**

`.claude/skills/jurisdictions/austin-city-council/SKILL.md`

```yaml
---
name: austin-city-council
description: |
  Reference for ingesting Austin City Council meetings. Use when working on
  Legistar agenda scraping, ATXN YouTube video processing, council-district
  data, or anything involving austintexas.gov. Covers scrapers, taxonomy,
  and output schemas.
---
```

Body contains: Legistar URL patterns, HTML selectors, ATXN archive structure,
district map, committee list, taxonomy files, output schema references.
Follow CrossBeam's pattern of a decision tree that loads 3–5 files max per
query, not a dump.

**Priority 2 (T-08, T-09 — unblocks verification and fingerprint matching):**

- `.claude/skills/verification/SKILL.md` — the source-check protocol, claim
  typology, quote-extraction rules. Used by the verification loop.
- `.claude/skills/fingerprint/SKILL.md` — how to interpret a civic fingerprint,
  the relevance-scoring rubric, anti-priority rules.

**Priority 3 (T-10 — unblocks the action flow):**

- `.claude/skills/drafting/SKILL.md` — public-comment templates, rep-email
  templates, phone-script templates, voice-style guides (measured/direct/
  persuasive).

**Priority 4 (T-07 — can run in parallel with Priority 2 once Priority 1 is done):**

- `.claude/skills/jurisdictions/aisd/SKILL.md`
- `.claude/skills/jurisdictions/texas-lege/SKILL.md`

## 3.4 Skill authoring rules

Four rules from the canonical Anthropic guidance:

1. **Frontmatter description is a routing hint.** Write it so Claude can decide
   "yes, this applies" in one pass. Mention concrete trigger phrases (the
   claude-api skill does this well).
2. **Progressive disclosure.** Break big skills into a SKILL.md entry point
   plus referenced files in the same folder. Claude loads the entry, then
   pulls only the referenced files it needs.
3. **Keep skills portable.** A skill should work across Claude.ai, Claude Code,
   and the API. No tool-specific assumptions unless you explicitly scope it.
4. **Script when deterministic.** If the work is better done by code than by
   reasoning (regex extraction, file conversion), put it in
   `skills/<name>/scripts/` and have the skill call it. More token-efficient.

## 4. Subagents — used sparingly

Shrivu Shankar's warning is worth absorbing: custom subagents gatekeep context
and force human-defined workflows onto the model. Anthropic's preferred
pattern is letting the main agent spawn clones of itself via `Task(...)` when
it needs isolation, rather than over-engineering a fleet of specialists.

That said, a few tightly-scoped subagents genuinely help Revere. Build these.

### `.claude/agents/legistar-scraper.md`

```yaml
---
name: legistar-scraper
description: Extracts structured agenda data from austintexas.legistar.com pages. Use when you need to parse a specific meeting's agenda or verify a scraper change.
tools: Read, Bash, WebFetch, Grep
model: sonnet
---
```

Body: "You are a scraper specialist. Given a Legistar meeting URL, extract
the agenda as structured JSON matching
`@.claude/skills/jurisdictions/austin-city-council/output-schemas/motion.json`.
Be strict about matching the schema. If the page structure looks different
from what's documented in the skill, flag it and stop — do not guess."

### `.claude/agents/verification-auditor.md`

```yaml
---
name: verification-auditor
description: Audits a candidate briefing item against its source material. Use when you need to check whether claims in a briefing are actually supported. This is the quality gatekeeper.
tools: Read, Grep
model: opus
---
```

Body: "You are a fact-checker. Given a candidate briefing item and its source
materials, return for each factual claim in the item one of:
supported / partially_supported / unsupported / contradicted. Be literal.
If the source says 'up to 12%' and the claim says '12%', that's
partially_supported, not supported. Use the protocol in
`@.claude/skills/verification/SKILL.md`."

### `.claude/agents/demo-rehearser.md`

```yaml
---
name: demo-rehearser
description: Runs through the 2-minute demo script and catches timing, wording, and failure-point issues. Use on tasks T-33 and during submission prep.
tools: Read
model: opus
---
```

Body: "You are a picky PM reviewing a demo. Given `@docs/demo-script.md`, check:
- Total time under 2:00
- Hook lands in first 10 seconds
- The Maya/Jason reveal is visible and undeniable
- Managed Agents trace is shown live
- 'Never autosends' is explicitly stated
Identify the weakest beat and suggest a tighter version."

Three subagents, not thirty. If you're tempted to add more, ask: "could the
main agent do this with @-references to a skill?" Usually yes.

## 5. Custom slash commands — just these three

Commands are shortcuts. Don't build dozens — that's anti-pattern territory.
Build these three for Revere.

### `.claude/commands/plan.md`

```yaml
---
description: Enter Plan Mode with a Revere-specific preamble
---
```

Body: "Enter Plan Mode. Before planning, re-read `@revere-prd.md §7`
(product spec) and `§12` (architecture). Then plan the requested change.
After the plan is approved, write it to `docs/plans/<slug>.md` so future
sessions can resume."

### `.claude/commands/verify.md`

```yaml
---
description: Run all verification steps on the current working tree
---
```

Body: "Run in this order:
1. `pnpm typecheck` in apps/web and apps/orchestrator
2. `pnpm test` in any package that has tests
3. `pnpm lint`
4. If any frontend changed, use Claude in Chrome to screenshot and verify.
Report results. Do NOT fix anything yet — just report."

### `.claude/commands/stage-demo.md`

```yaml
---
description: Prep the staging environment for a demo run
---
```

Body: "Verify:
- Supabase has last night's ingestion results (query `briefings` table)
- Maya and Jason fingerprints exist in `fingerprints` table
- The Managed Agents session from last night is accessible for trace view
- Frontend deploys to the demo URL are current
Report any gaps."

## 6. Hooks — one hook, used well

Hooks are deterministic and run on every event. Unlike CLAUDE.md rules
(advisory), hooks guarantee the action happens. Use for things that must
happen every time.

`.claude/hooks/post-edit.sh` (make executable with `chmod +x`):

```bash
#!/bin/bash
# Runs after Claude edits any file. Runs typecheck on TS files only.
FILE_PATH="$1"
if [[ "$FILE_PATH" == *.ts ]] || [[ "$FILE_PATH" == *.tsx ]]; then
  cd "$(git rev-parse --show-toplevel)" || exit 0
  pnpm typecheck 2>&1 | tail -20
fi
```

Wire it in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": ".claude/hooks/post-edit.sh" }]
      }
    ]
  }
}
```

This makes Claude's edits self-verifying on TypeScript. One hook, high value,
no ceremony.

## 7. MCP servers — only if they pay for themselves

MCP is powerful but adds surface area. For Revere, the one MCP server worth
considering is **Supabase MCP**, because Claude will query and mutate the
database constantly during development. Install it once T-12 (schema
migration) is complete:

```bash
claude mcp add supabase <args-from-supabase-mcp-docs>
```

**Skip:** GitHub MCP (use `gh` CLI instead — smaller context), Slack MCP
(irrelevant for v1), filesystem MCP (Claude Code already has file tools).

## 8. The workflow — how to actually use this setup every day

This is the Anthropic-internal pattern: **Research → Plan → Execute → Review
→ Ship**. Every non-trivial change goes through it.

### 8.1 Start of day

```bash
claude --resume   # pick up yesterday's session if you left something mid-task
# or
claude            # new session for a new task
```

Quick orientation prompt: "Read `@revere-prd.md §20` to see the task graph.
Search the git log for commits prefixed `T-` to find completed tasks. Tell
me which tasks have all their dependencies satisfied but aren't yet done,
and recommend the next one to pull. Don't code yet."

### 8.2 For any feature work

1. **Research phase.** `/plan` to enter Plan Mode. Let Claude read relevant
   files and the PRD section. Don't rush this. The PRD is your best defense
   against scope drift.
2. **Plan phase.** Ask Claude to write a detailed plan and save it to
   `docs/plans/<slug>.md`. Read it. Push back. Iterate until you'd approve it.
3. **Execute phase.** Exit Plan Mode. "Implement the plan. Commit after each
   task step."
4. **Review phase.** Use the `verification-auditor` subagent or `/verify`.
   Or start a fresh session for code review (avoids the bias of reviewing
   your own just-written code).
5. **Ship phase.** "Commit with a descriptive message and open a PR with
   `gh pr create`."

### 8.3 Context hygiene (this is the thing that separates pros)

- `/clear` between unrelated tasks. Don't carry tomorrow's problem into
  today's session. This is the single biggest practice from every canonical
  source.
- `/btw` for quick questions that shouldn't enter conversation history.
- Delegate research to subagents so exploration doesn't eat your main
  context: "Use a subagent to investigate how we're handling fingerprint
  persistence in Supabase."
- `Esc Esc` or `/rewind` when Claude goes off track. Don't argue — roll back
  and re-prompt.
- **Two strikes rule.** If you've corrected Claude on the same issue twice,
  `/clear` and write a better initial prompt. Long sessions with accumulated
  corrections perform worse than fresh sessions with a sharper prompt.

### 8.4 Non-interactive mode for scale

When you need to run the same operation across many files — like tuning a
scraper against 20 different Austin Council meetings — use non-interactive
mode:

```bash
for meeting in meetings/*.json; do
  claude -p "Validate $meeting against the schema. Return OK or FAIL with reason." \
    --allowedTools "Read,Bash" \
    --output-format json
done
```

Scoped permissions, no interactive interruptions, parseable output.

### 8.5 Parallel sessions for the Writer/Reviewer pattern

When you've just built something important (verification loop, adversarial
loop), run two Claude sessions in parallel:

- **Session A (writer):** keeps the implementation context.
- **Session B (reviewer):** fresh context, reviews A's work without bias.

The fresh context on Session B catches things you can't see from inside the
implementation. Use this after any critical-path task that lands substantial
code — **T-11, T-15, T-17, T-21, T-29** are the strongest candidates.

### 8.6 Auto mode — for long runs

**T-19** (the first unattended overnight run) and **T-31** (visual polish
sweep) are the strongest candidates:

```bash
claude --permission-mode auto -p "Apply the linter fixes across all TS files in apps/web. Don't change logic. Commit per directory."
```

The classifier reviews each command and blocks anything risky. You can step
away.

## 9. Session rhythm for the task graph

The PRD (§20) organizes work as a task graph, not a calendar. This section
maps those tasks to Claude Code session patterns — which prompt to open with,
which subagents and commands to use, and which context discipline to apply —
regardless of which day you reach them.

### 9.1 Pulling the next task

At the start of any session:

> Open `@revere-prd.md §20`. Show me every task whose dependencies are all
> marked complete in git log (search commits for "T-XX:" prefix) and that
> isn't yet started. Rank them by: critical-path first, then by estimated
> effort (small first) to let me build momentum. Tell me the next one I
> should pull. Don't code yet.

This turns the task graph into a live queue. You always know what's next
without re-reading the whole PRD.

### 9.2 Session patterns by task type

Each task in §20 of the PRD falls into one of four shapes. Apply the matching
session pattern:

- **Setup tasks (T-01 through T-04).** Single session, `/plan` mode for T-03
  and T-04, auto mode off. Verification: check gates manually in each
  service's web UI. Prompt opener: "Execute T-XX per PRD §20. After each
  sub-step, tell me what you did and where to click to verify."
- **Skill authoring (T-05 through T-10).** Fresh session per skill. Use the
  skill-creator skill from `anthropics/skills` to scaffold, then refine.
  Verification: manual test prompt that should route to the new skill.
  Prompt opener: "Use skill-creator to scaffold T-XX. Reference CrossBeam's
  pattern of SKILL.md + referenced files loaded on demand."
- **Ingestion pipeline (T-11 through T-18).** These are the heaviest tasks.
  Use Plan Mode liberally. Pair with the `legistar-scraper` and
  `verification-auditor` subagents. Writer/Reviewer pattern: one session
  writes the pipeline, a fresh second session reviews it. Prompt opener:
  "Plan T-XX. Reference `@revere-prd.md §12` (architecture) and
  `@.claude/skills/jurisdictions/austin-city-council/SKILL.md`. Identify
  the gate from §20 and propose how we'll verify it fires."
- **Frontend + action flow (T-21 through T-29).** Use the Claude in Chrome
  extension for visual verification — Anthropic's single highest-leverage
  recommendation. Prompt opener: "Implement T-XX. After each visible change,
  take a screenshot and compare to the design direction in
  `@revere-prd.md §12.6`."
- **Rehearsal + polish (T-30 through T-33).** Use the `demo-rehearser`
  subagent. Fresh sessions for each rehearsal so prior critiques don't bias
  the next round. Prompt opener: "Run demo-rehearser on `@docs/demo-script.md`.
  Identify the weakest beat and propose a tighter version."

### 9.3 Context discipline per task

One rule that applies to every task: **`/clear` when you pull a new task
that isn't a direct continuation of the previous one.** The PRD's task IDs
give you a clean way to decide — if the new task's dependencies don't
include the task you just finished, `/clear`.

Two exceptions where you keep context:

- Pulling a parallel task in the same section (e.g., finishing T-05 and
  pulling T-06 — they share the same skill-authoring headspace).
- Finishing a task and immediately pulling its direct downstream (e.g.,
  T-11 then T-13 — the second task builds on state from the first).

Everything else: fresh session.

### 9.4 Commit-per-gate protocol

Every time a PRD gate fires, commit with the task ID as a prefix:

```bash
git commit -m "T-15: verification loop rejects unsupported claims on real data"
```

This does three things: makes your git log double as a task status board,
gives the "pull the next task" prompt in §9.1 something concrete to query,
and creates natural rollback points if a later task reveals a problem
upstream.

### 9.5 Parallel sessions — when to actually do this

Two Claude Code sessions in parallel pays off when:

- You've just finished a critical-path implementation task (T-11, T-15,
  T-17, T-21, T-29). A fresh second session reviews it without bias.
- You're blocked on a parallel task's external dependency (Outcomes access,
  a recruited user's reply) and want to work on a later critical-path task
  simultaneously.
- You're inside T-33 (demo rehearsals) and want one session critiquing
  while the other fixes.

Don't run parallel sessions just because you can. Three concurrent sessions
is a ceiling, not a target.

### 9.6 Non-interactive mode — where it pays off

When a task has the shape "apply the same operation across many inputs,"
batch it:

```bash
for meeting_url in $(cat austin-meetings-backfill.txt); do
  claude -p "Ingest $meeting_url per the austin-city-council skill. Return OK or FAIL with reason." \
    --allowedTools "Read,Bash,WebFetch" \
    --output-format json
done
```

Specific Revere tasks where this helps: **T-11** (backfill ingestion across
multiple recent meetings for richer demo data), **T-15** (re-run verification
across all candidate items after a scraper fix), **T-17** (regenerate both
personas' briefings after a fingerprint tweak).

### 9.7 Auto mode — where it pays off

Three places in the task graph where auto mode earns its keep:

- **T-19:** the first unattended overnight run. You're asleep; auto mode is
  the whole point.
- **T-31:** applying a sweep of visual-polish fixes across many components.
- **T-33:** any rehearsal's tooling — running lint, typecheck, and screenshot
  comparison without hand-approving each.

Everywhere else: keep permissions tight.
