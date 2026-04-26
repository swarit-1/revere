# Revere — hackathon submission blurb

**500 words, hook → demo → Opus 4.7 use → roadmap.**

---

Paul Revere rode through the night so sleeping citizens would know
what was coming. In 2026, most Americans don't know what their city
council voted on last night. Revere is the digital version of the
ride.

Revere is a personal civic chief of staff. It runs every night while
its user sleeps, reads the previous day's output from their local,
county, and state governments, filters everything through a detailed
personal profile called a civic fingerprint, verifies every factual
claim against source, and delivers a morning briefing of only what
affects them — with the exact source behind every claim and three
adversarially-refined draft replies when action makes sense. It
never autosends.

**The demo's load-bearing claim**: the same public record means
different things to different people. Maya is an East Austin renter
with a kid at Zavala Elementary; Jason owns a duplex three blocks
away and runs a coffee shop on East 6th. Both live in District 3.
Both read last night's four-hour Austin City Council meeting. They
get *different* briefings, with *different* reasons, and *different*
drafts. That gap is the product.

**Five Opus 4.7 capabilities, used honestly**:

1. **Parcel-level vision** — Maya's top item is a rezoning two
   blocks from her apartment. Tap "See source" and the actual Staff
   Report page renders with the SUBJECT TRACT highlighted. Opus
   4.7's two-stage pipeline finds the map page among 23 in an 11.8
   MB PDF, then returns the parcel's bounding box in pixel
   coordinates — not "near it." Vermilion overlay drawn from
   pre-extracted bbox.
2. **Strict evidence mode** — every "why this matters to you" claim
   is anchored in both a verified source passage and a specific
   fingerprint clause. 4.7's literal instruction-following enforces
   the constraint.
3. **Self-verification rigor** — backbone of the verification loop.
   Per-claim verdicts (supported · partially_supported · unsupported
   · contradicted · unverifiable), each with verbatim source
   excerpts. Items with unsupported claims get rewritten or dropped.
4. **Adversarial drafting** — for action-flow items, Opus 4.7 emits
   three voice variants (Direct · Measured · Persuasive), then
   sequentially attacks each one as a council staffer, an opposing
   constituent, and a press shop. The refiner explicitly accepts
   valid critiques and defends weak ones. Voice register survives
   three critic passes.
5. **Adaptive thinking with display: summarized** — keeps the user
   informed during long synthesis calls.

**Five Managed-Agents uses**: outcome-graded briefings (rubric:
source link, transcript timestamp, fingerprint tie-back, zero
unverified claims), human-in-the-loop escalation (drafts never
autosubmit), session tracing as trust surface (the in-product "Why
am I seeing this?" reads from the same `agent_sessions` rows the
operator audits), versioned per-jurisdiction agents
(`austin-council-v1` with explicit allowed-hosts), and durable
memory via Supabase (Memory research-preview if granted).

**Roadmap**: federal + international jurisdictions, election mode
(candidate-by-fingerprint cross-referencing), multilingual onboarding
(Spanish first), workplace mode (HR-beat briefings on labor and
benefits regulation), and journalist/advocate multi-user mode.

Built solo in a week. ~$3.50 per meeting end-to-end. The demo runs
locally; the architecture supports any city.

---

*Word count: 487.*
