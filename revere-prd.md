Revere — Product Requirements Document
Your Personal Civic Chief of Staff
Built with Opus 4.7 · Hackathon Submission · v1.0

0. How to use this document
This PRD is the single source of truth for the Revere hackathon build. It is organized so any collaborator — a teammate, another LLM you use for refinement, an advisor, or a future-you three days from now at 2am — can land on any section and have enough context to reason about it.
Read top-to-bottom for the full story: origin → thesis → product → architecture → build plan. Skim the TOC to jump to a specific decision, rationale, or spec. Tables are load-bearing. If something is in a table, it has been considered deliberately.

Table of Contents
Executive Summary
Origin Story & Ideation Journey
Vision, Thesis & Positioning
The Problem
Target Users & Personas
Competitive Landscape
Product Specification
The Civic Fingerprint
The Morning Briefing
The Action Flow
Multi-Pass Review Systems
System Architecture
Opus 4.7 — Specific Uses
Claude Managed Agents — Specific Uses
Model Routing & the Advisor Strategy
Data Sources
Skills System (CrossBeam-Style)
Security, Privacy & Trust
Demo Specification
Build Plan
API Credit Budget
User Recruitment Plan
Rubric Alignment
Risks & Mitigations
Post-Hackathon Roadmap
Appendix A — Starter Prompts
Appendix B — Data Source Inventory
Appendix C — Glossary

1. Executive Summary
Product. Revere is a personal civic chief of staff. It runs every night while its user sleeps, reads the previous day's output from their local, county, and state governments, filters everything through a detailed personal profile called a civic fingerprint, verifies every factual claim against source, and delivers a ~5-minute morning email plus a deeper interactive briefing in-app. When action makes sense, it drafts three human-reviewed response variants. It never autosends.
Core thesis. The same public record means different things to different people. The product is the proof — item by item, with sources.
Hook. Paul Revere rode through the night so sleeping citizens would wake up knowing what was coming. In 2026, most Americans don't know what their city council voted on last night. Revere is the digital version of the ride.
Hackathon strategy. Compete for the grand prize with an alternate path toward Best use of Claude Managed Agents as a backup. The project sweeps the rubric: documented civic impact (Impact), the "same source, different people" reveal (Demo), five distinct Opus 4.7 capabilities used honestly (Opus 4.7 Use), and multiple review loops + skills-pack extensibility + real recruited users (Depth).
v1 scope. Austin City Council deep; AISD and Texas Legislature working but thinner. Two demo personas: Maya (East Austin renter, parent, car commuter) and Jason (homeowner, small-business owner, same neighborhood). Voice onboarding; email + in-app briefing; draft-but-never-send action flow.
Out of v1. Federal + international (architecture supports it; demo doesn't use it). Election mode. Multi-user journalist/advocate mode. Voice playback of briefings. Autonomous submission of comments.

2. Origin Story & Ideation Journey
This section exists so anyone picking up the project understands why the scope and shape look the way they do. Every deliberate cut was a response to something real.
Starting point. The original pitch was a healthcare facial-recognition-plus-prior-authorization system. Three problems killed it fast: (1) HIPAA and consent optics are uniquely hostile for a hackathon, (2) the prior-auth space has well-funded incumbents (Optum/Humata, Cohere, Availity, Banjo, EasyPA) hitting 96% first-pass approval, (3) the scope was a multi-year enterprise system, not a 7-day demo.
Pattern-matching to past winners. The Opus 4.6 winners (CrossBeam, Elisa, postvisit.ai, Conductr, TARA) all shared four traits: narrow specific workflow, real source material, dramatic before/after demo, and — critically — a real user recruited before submission. Four of five were non-developers, meaning domain knowledge beat engineering chops. CrossBeam specifically won with a skills-pack architecture (28 reference files on California ADU law) that generalized across 480+ cities with the same core agent.
Iteration 1: healthcare variants. SNF bed-matching, insurance denial appeals, discharge translation. All workable, but none grabbed the user.
Iteration 2: civic instinct emerges. The user pitched, in one message, three things they wanted combined: a local-meeting awareness tool, an overnight autonomous agent, and recursive self-improvement. Initial read: civic-only was the strongest standalone.
Iteration 3: synthesis. The three instincts were not three products. They were one product with three surfaces. Personalization via a conversational fingerprint solves civic-tech's discoverability problem. Overnight agents solve the "nobody has time to read 3-hour meetings" problem. Recursive review solves the hallucination problem that every existing tool has struggled with. Working name: TownCrier.
Iteration 4: the critic pass. An external red-team review surfaced real errors: claims I made about competitors were unfair (Aware, Hamlet, citymeetings.nyc, Civic Sunlight each have real strengths), the "AI lobbyist" framing carried astroturfing risk, "3,000 news-desert counties" was factually wrong (correct figure: 213 counties with no source + 1,524 with one source, together ~50M Americans with limited access), and several Opus 4.7 claims were actually 4.6 features or platform features miscategorized as model features.
Iteration 5: second critic pass. Further sharpening: sessions in Claude Managed Agents are ephemeral by default (persistence lives in the user's storage layer), xhigh effort is a Messages API feature and doesn't apply in Managed Agents (where effort is handled automatically), /loop is a Claude Code session primitive not an adversarial-writing primitive, and the winning demo needs one undeniable transformation (the "same source, different person" reveal).
Final pivot. Name changed from Proxy/TownCrier to Revere. The Paul Revere frame is warmer, self-explaining in three seconds, sidesteps the lobbyist baggage, and gives judges an emotional anchor. Lobbyist language survives only as a one-sentence asymmetry hook.
The scope and architecture in this document are what survived all five iterations.

3. Vision, Thesis & Positioning
Vision. Every American wakes up knowing which government decisions actually affect their life, with receipts. Civic information becomes a personal daily briefing, not a public-record scavenger hunt.
Thesis (this is the product). The same public record means different things to different people. Personalized materiality — proving that claim, item by item, with sources — is the product. Not better meeting summaries. Not keyword alerts. Not geographic filtering. The individual life is the lens.
Positioning statement.
For residents who want to know what their government is doing without becoming their own full-time beat reporter, Revere is a personal civic chief of staff that monitors the public record overnight and delivers a morning briefing of only what affects you specifically, with the exact source behind every claim and human-reviewed draft responses when action makes sense. Unlike meeting-summary tools (Hamlet, Aware, citymeetings.nyc, Civic Sunlight) that stop at the meeting, Revere starts at the person.
Hook for demo day (spoken).
"Paul Revere rode through the night so sleeping citizens would wake up knowing what was coming. In 2026, most Americans don't know what their city council voted on last night. Revere is the digital version of the ride."
One-sentence pitch. Revere is a personal civic chief of staff that monitors the public record while you sleep, tells you which decisions affect your life and why, and helps you respond with source-grounded, human-reviewed drafts.

4. The Problem
The accessibility crisis. Medill's 2025 State of Local News report documents ~50 million Americans with limited or no access to local news (213 counties with no local news source and 1,524 counties with only one remaining source). Local journalism has shed more than 75% of its jobs since 2005, and the decline is accelerating among small, independent, locally-owned papers — historically the most trusted sources.
The volume-latency problem. Austin City Council meets weekly for 3–6 hours. Agenda packets routinely exceed 200 pages with embedded staff reports, zoning diagrams, and financial exhibits. The Texas Legislature passes thousands of bills per biennium. Even a highly motivated citizen with two free evenings per week cannot keep up with their own government.
The materiality problem. Existing civic tools answer the question "what happened?" They do not answer the question every resident actually asks, which is "does this affect me?" This is not a solvable problem with summarization alone. It requires a model of the individual.
The trust problem. Civic Sunlight publicly struggled with AI hallucinations in early newsletters — memorably inventing a "Megunticock Lake" that doesn't exist — and now uses human editors in the loop. For any civic AI tool, a single factual error can end the product. Trust is the product.
The participation gap. Even when residents know about an issue, drafting a coherent public comment requires time, procedural knowledge, and the emotional labor of writing something that might fail. Professional advocates do this routinely. Ordinary residents mostly don't. The result: disproportionate influence for organized interests who can afford that labor.

5. Target Users & Personas
Primary user. A civically-curious resident who feels disconnected from local decisions that directly shape their life, and who would show up if they had the information and a low-friction way to act.
Persona 1: Maya (demo persona A)
34, East Austin, rents a 1BR in a market-rate building, $1,850/month.
One kid (age 7) in AISD, Zavala Elementary.
Commutes by car to a software job downtown.
Priorities stated during onboarding: rent/cost of living, transit reliability, school quality, police accountability, childcare access.
"Don't bother me about" list: dog parks, sister cities, ceremonial proclamations.
Why she'd use Revere: no time to attend meetings, vaguely anxious about a rezoning rumor two blocks away, doesn't know her councilmember's name.
Persona 2: Jason (demo persona B)
42, East Austin, owns a duplex (lives in one unit, rents the other), three blocks from Maya.
No kids. Runs a small coffee shop on East 6th Street.
Walks or bikes to work.
Priorities stated during onboarding: property taxes, small-business permitting, commercial zoning, TABC rules, downtown-adjacent safety.
"Don't bother me about" list: school-board politics, suburban annexation.
Why he'd use Revere: TABC changes affect his license; sidewalk rules affect outdoor seating; property tax revaluations affect his mortgage.
Same meeting, same neighborhood, radically different briefing. This is the demo's load-bearing claim. When Maya and Jason both read the Austin City Council meeting of [demo date], they see different items, different emphases, and different suggested actions. That gap is the product.
Secondary personas (not demoed in v1)
Elena: recent immigrant, Spanish-preferred, focused on citizenship, schools, ICE-related city policy. Validates multilingual capability post-hackathon.
Darren: suburban homeowner in Pflugerville ISD, commutes via I-35. Validates multi-jurisdiction scaling post-hackathon.
Rosa: local journalist at the Austin Chronicle. Validates journalist/advocate mode post-hackathon.

6. Competitive Landscape
Honest read of the field — don't overclaim.
Product
What it does well
The gap Revere fills
Hamlet (myhamlet.com)
Alerts on project-relevant keywords, 33,000+ meeting transcripts, 3,000+ governing bodies.
Keyword-matching, not personalized materiality. No model of the whole person's life.
citymeetings.nyc
Chapters NYC hearings by speaker/topic with human oversight; ~10k monthly visitors.
NYC-only; summarization-oriented; no per-individual briefings or action flow.
Aware (awarenow.ai)
AI summaries + "impact your taxes, schools, neighborhood" framing; push/email/WhatsApp delivery.
Markets personalization but executes at geographic/topic granularity, not individual-life granularity. No verified source-tie-back on every claim.
Civic Sunlight
Area-level summaries with a verification pipeline; claims 95–97% accuracy.
Geographic personalization, not individual. After early hallucination incidents, leans on human editors — which caps scale.
Hamlet (Saratoga, Palo Alto pilot)
City-deployed summarization platform.
Institutional/government-facing, not resident-facing.
austincouncil.app
Per-meeting AI summaries specific to Austin.
Generic summaries. Validates the market appetite; no personalization; no action flow.

Our unique wedge: a conversational civic fingerprint + per-item fingerprint-tie-back + verifiable source proof on every claim + draft-never-send action flow. No existing tool combines these four. The wedge is personalized materiality with receipts.

7. Product Specification
7.1 Core user loop
First launch (once): voice intake. Revere conducts a ~10-minute conversation that builds a civic fingerprint. User can edit anytime.
Every night (automatic): Revere ingests the previous day's governmental output and produces tomorrow's briefing.
Every morning (user reads): 5-minute email lands at 7am; longer interactive briefing lives in-app.
Occasionally (user acts): on items that warrant response, user taps "draft a reply." Revere generates three variants via the adversarial refinement loop. User edits and sends themselves.
Ongoing (learning): thumbs-up/down feedback, edits to drafts, and profile updates refine the fingerprint and writing voice. Fingerprint and feedback live in Supabase — a durable store outside any single agent session.
7.2 V1 feature scope (built for demo day)
Voice-first onboarding → civic fingerprint file
Overnight ingestion of Austin City Council (deep), AISD, Texas Legislature
Verification loop on every factual claim before user sees it
Morning email + in-app briefing with per-item source proof
Adversarial refinement loop for drafts
Two-persona switcher (Maya / Jason) for demo
Live Managed Agents session trace visible in-app and on stage
"Never autosends" human-review gate
7.3 Out of scope for v1
Federal, international, and election-mode briefings (architecture supports; demo doesn't show)
Journalist/advocate multi-user mode
Voice playback of briefings (TTS)
Autonomous submission of drafts
Native mobile apps (web-responsive only)
Full calendar integration (links-out only)
7.4 Explicit non-goals
Revere is not a voting platform, not a ballot-measure endorser, not a candidate rater (in v1). These belong in a carefully-scoped election mode later.
Revere is not partisan. It aligns to stated individual priorities, not to a party or ideology.
Revere does not claim to be complete. It filters aggressively; the fingerprint's relevance slider controls how aggressively.

8. The Civic Fingerprint
8.1 What it is
A structured profile of a user's life, stated priorities, and stated anti-priorities. Used by every downstream agent to judge whether an item is material enough to include in a briefing and why.
8.2 Structure (stored as JSON in Supabase)
{
  "user_id": "uuid",
  "location": {
    "city": "Austin",
    "county": "Travis",
    "state": "TX",
    "council_district": 3,
    "isd": "Austin ISD",
    "school_zone": "Zavala Elementary",
    "state_house_district": 51,
    "state_senate_district": 14,
    "us_house_district": 35
  },
  "housing": {
    "status": "renter",
    "unit_type": "1BR apartment",
    "approximate_rent": 1850,
    "building_type": "market_rate"
  },
  "household": [
    {"role": "self", "age_bracket": "30-39"},
    {"role": "child", "age": 7, "school": "Zavala Elementary"}
  ],
  "work": {
    "commute_mode": "car",
    "commute_route_keywords": ["I-35", "downtown"],
    "sector": "software"
  },
  "priorities": [
    {"topic": "housing_cost", "weight": 0.9},
    {"topic": "transit_reliability", "weight": 0.7},
    {"topic": "school_quality", "weight": 0.8},
    {"topic": "police_accountability", "weight": 0.6},
    {"topic": "childcare_access", "weight": 0.5}
  ],
  "anti_priorities": ["dog_parks", "sister_city_proclamations"],
  "relevance_slider": "balanced",
  "learned_voice_style": { /* evolves from user edits */ },
  "feedback_history": [ /* thumbs, edits, dismissals */ ]
}

8.3 How it's built (voice onboarding)
Claude Opus 4.7 (adaptive thinking, effort: high) conducts the conversation via the Messages API. STT via Deepgram, TTS via ElevenLabs. Target length: 8–12 minutes. The conversation is progressive, not a form — Claude asks natural follow-ups based on earlier answers and probes when answers are vague.
Core sections:
Location. Where do you live (address or cross-streets, never stored precisely; stored at district granularity)?
Household. Who lives with you; kids' ages and schools.
Movement. How you get around (car, bus, bike, walk) and your usual routes.
Work. Where and how you commute.
Money. Rent/own; renter protections or property tax; small-business owner status.
Interest areas. What do you pay attention to already?
Anti-interests. What are you sick of hearing about?
Relevance strictness. Would you rather miss a few relevant items, or see a few irrelevant ones? (Sets the slider.)
8.4 Editability and evolution
User can edit any field anytime in settings.
Thumbs-down on a briefing item → Revere asks why (one tap: "not relevant" / "already knew" / "wrong framing"). The relevant priority weight or topic is adjusted.
Edits to generated draft text are captured to refine learned_voice_style over time.
User can export their fingerprint as JSON. This is a trust feature: nothing opaque.

9. The Morning Briefing
9.1 Delivery
Email. 7am local time. Plain text + lightweight HTML. Target length: 5-minute read. Subject line: Revere · Tue Apr 22 · 3 items for you.
In-app. Longer interactive version. Each item expandable to full source proof, related prior coverage, suggested actions.
9.2 Briefing item anatomy
Every item in a Revere briefing must contain:
Headline. One sentence, declarative, no hedging.
Why this matters to you. 1–2 sentences, explicitly tied back to one or more fingerprint bullets.
What happened. 2–3 sentences of neutral summary.
Source proof (one tap). Transcript timestamp + meeting video link, or page number + agenda PDF link, or bill number + Texas Lege Online link. Plus the exact quoted passage (≤15 words).
Confidence indicator. High / Medium / Low, based on verification loop output.
Action panel (when applicable). One tap: "draft a reply" (enters adversarial refinement loop), "add hearing to calendar" (ICS download), "see your rep's position."
9.3 Item types (v1)
Council/board motion or vote. Something was decided.
Upcoming hearing with public comment window. Something is about to be decided; you can weigh in.
Bill progression in Texas Lege. A state bill moved stages; here's how it would affect you.
Staff report / budget item. An administrative decision with downstream impact.
Representative activity. Your councilmember or state rep voted on something relevant.
9.4 What we do NOT include
Nothing below the fingerprint's relevance threshold.
Nothing failing verification.
Nothing from the user's anti-priorities list unless it reaches a "critical override" threshold.
No speculation or editorializing — only what's in the record.

10. The Action Flow
Revere's ethical backbone. Never autosends. Always drafts three variants. Always shows the critic pass.
10.1 Trigger
User taps "draft a reply" on a briefing item.
10.2 Variant generation
The writer agent (Opus 4.7) produces a first draft using:
The item's full source material (not the summary — the actual transcript + agenda text + bill language)
The user's fingerprint
The user's learned_voice_style
The target recipient (council clerk, councilmember's office, rep's office)
The submission channel (email, public comment form, phone script)
10.3 The adversarial refinement loop
The draft is passed to three adversary sub-agents sequentially. Each plays a different role:
Pass
Adversary persona
Attacks
1
Council staffer
Procedural / technical objections: wrong citation, wrong form, filed too late, not in this body's jurisdiction.
2
Opposing constituent
Value / policy objections from the strongest opposing viewpoint, not a strawman.
3
Rep's press shop
Political risk: which framing will be ignored, which will land, which could backfire on the user.

After each attack, a refiner agent rewrites — accepting valid critiques, defending against weak ones, strengthening the argument. The process produces three final variants, each representing a different level of directness: Direct (what the user would say if they had all day to draft it), Measured (conservative, factual, hard to attack), Persuasive (harder-hitting, more advocacy-voiced).
10.4 The gate
User sees all three variants side-by-side with inline annotations showing what the critics caught. User edits freely. Revere never submits. The final tap takes the user to the official submission channel (mailto: link prefilled, or open-in-new-tab to the city's comment form) with the chosen text copied to clipboard. User makes the final affirmative action to submit.
This is non-negotiable. Two reasons: it's the ethical floor for any AI tool touching civic participation, and it's a defensive response to documented concerns from the Brennan Center, pending federal legislation, and multiple state-AG guidance documents on AI-drafted public comments distorting democratic participation.

11. Multi-Pass Review Systems
Two distinct loops. They run in different phases and solve different problems.
11.1 Verification Loop (runs during overnight ingestion)
Purpose: Ensure no unsupported factual claim ever reaches the user.
Mechanism. For every candidate briefing item, a verifier sub-agent (Opus 4.7 with effort: xhigh via Messages API) receives the draft text plus the original source material. For each factual claim, it:
Extracts the claim.
Locates the relevant source passage.
Checks whether the source actually supports the claim as stated.
Returns one of: supported / partially_supported / unsupported / contradicted.
Enforcement. Items with any unsupported or contradicted claim are either rewritten or dropped. partially_supported claims must be rewritten to match what the source actually says.
Why Opus 4.7. The 4.7 launch notes specifically highlight the model's new "rigor" — its tendency to devise its own verification checks before reporting. Our verification loop leverages this natively rather than prompting it from scratch.
11.2 Adversarial Refinement Loop (runs during drafting)
Purpose: Produce persuasive public comments and rep emails that survive real-world pushback.
Mechanism. Described in detail in §10.3. The implementation is sequential multi-turn calls to the Messages API orchestrated from our backend — writer → adversary → refiner, three iterations. Each adversary call uses a different persona prompt.
Why Opus 4.7. More literal instruction-following means the adversary personas actually stay in character rather than softening into agreement. The refiner stays targeted rather than overgeneralizing.

12. System Architecture
12.1 Component overview
┌───────────────────────────────────────────────────────────────────┐
│                           USER SURFACES                            │
│   Web app (Next.js)  ·  Morning email (SendGrid/Resend)           │
└────────────────┬──────────────────────────────────┬───────────────┘
                 │                                  │
                 ↓                                  ↓
┌────────────────────────────┐    ┌──────────────────────────────┐
│   API / Orchestrator       │    │   Storage (Supabase)          │
│   (Cloud Run, Node/Python) │◄──►│   • fingerprints              │
│                            │    │   • briefings                 │
│                            │    │   • action logs               │
│                            │    │   • feedback history          │
│                            │    │   • source cache              │
└──┬──────────┬──────────┬───┘    └──────────────────────────────┘
   │          │          │
   │          │          │
   ↓          ↓          ↓
┌─────────┐ ┌─────────────────────┐ ┌──────────────────────┐
│ CC       │ │  Managed Agents     │ │ Messages API          │
│ Routine  │ │  (per jurisdiction) │ │ (drafting, synth,     │
│ (nightly │ │  • Austin Council   │ │  verification)        │
│  cron)   │ │  • AISD             │ │  Opus 4.7 · Sonnet    │
│          │ │  • Texas Lege       │ │  4.6 · Haiku 4.5      │
└──────────┘ └─────────────────────┘ └──────────────────────┘
                       │
                       ↓
          ┌────────────────────────────────┐
          │     External data sources       │
          │ • Legistar (austintexas.legistar.com) │
          │ • ATXN YouTube archive          │
          │ • AISD BoardDocs                │
          │ • Texas Legislature Online      │
          └────────────────────────────────┘

12.2 Three-layer architecture
Layer 1: Ingestion (async, runs nightly). Per-jurisdiction Managed Agents sessions execute in parallel. Each is a versioned agent configuration with its own system prompt, its own skill pack, and a least-privilege environment with explicit allowed-hosts for that jurisdiction's data sources. Outputs are written to Supabase as structured candidate-item records.
Layer 2: Scheduling. A Claude Code Routine fires at 2am local time, triggers the ingestion layer via its API endpoint, waits for completion, and triggers the synthesis step. Routines run on Anthropic's managed cloud infrastructure, so there is no local machine or custom cron dependency. Auto mode keeps the routine from stalling on permission prompts during unattended runs.
Layer 3: Synthesis & Interactive (on-demand). When a user opens the app or taps "draft a reply," the orchestrator invokes Opus 4.7 via the Messages API to compose the final briefing, run the verification loop, or execute the adversarial refinement loop. Adaptive thinking with display: summarized ensures the user (and demo judges) see real-time reasoning rather than long silent pauses.
12.3 Why this split (Managed Agents vs. Messages API)
Managed Agents is the right tool for the ingestion layer because ingestion is long-running, stateful, tool-heavy (web fetch, file ops, bash), and benefits from the pre-built harness, sandboxing, credential management, and observability tracing.
Messages API is the right tool for the synthesis/drafting layer because these calls are interactive, synchronous, need effort and task_budget controls (which Managed Agents handles automatically but less granularly), and benefit from adaptive thinking streaming to the UI.
This split is also architecturally honest: Managed Agents docs explicitly say xhigh effort and task budgets are Messages API features, so we don't conflate them.
12.4 Storage schema (Supabase, v1)
Core tables:
users — auth, email, plan tier
fingerprints — one per user, JSON column (structure in §8.2); durable across sessions
jurisdictions — Austin City Council, AISD, Texas Lege, each with feed URLs
meetings — one per ingested meeting, with date, jurisdiction, video URL, agenda URL
candidate_items — raw items extracted from meetings before fingerprint filtering
briefing_items — items that passed filtering + verification; linked to meeting + source page/timestamp
briefings — one per user per day; ordered list of briefing_items
drafts — generated response drafts; one row per (briefing_item, user, variant)
feedback_events — thumbs, edits, dismissals; timestamped
agent_sessions — log of every Managed Agents session: jurisdiction, session_id, status, duration, tool calls, cost. Used both for debugging and for the demo trace.
12.5 Why Supabase (and not Managed Agents memory)
Managed Agents sessions are ephemeral by default — each session runs in an isolated container and state does not persist across sessions automatically. The research-preview Agent Memory feature provides durable memory stores, but requires explicit access. For v1 we use Supabase for all user-facing durable state (fingerprints, history, drafts) and treat Managed Agents sessions as stateless workers. If we get Memory research-preview access before demo day, we migrate the learned voice style and feedback history into memory stores and demonstrate it. If not, Supabase is the honest implementation and we say so plainly.
12.6 Frontend
Stack. Next.js 16 + Tailwind. Mobile-responsive (most users read the morning briefing on their phone).
Key views. (1) Onboarding voice interface. (2) Morning briefing. (3) Item detail with source-proof pane. (4) Draft variants side-by-side with inline critic annotations. (5) Session trace ("why am I seeing this?") view.
Design direction. Newspaper-inspired. Serif headlines, generous whitespace, no gratuitous UI chrome. Read like the New York Times morning briefing, not like a dashboard.
Deployment. Vercel.
12.7 Authentication & identity (v1)
Supabase Auth with magic-link email. No social logins in v1 (reduces scope). Every action flow requires an authenticated session. Submission channels (mailto: / open-in-new-tab) include a small confirmation modal to prevent accidental sends.

13. Opus 4.7 — Specific Uses
Five uses, each tied to a 4.7-specific capability documented in Anthropic's launch notes. No conflation of 4.7 model features with platform features.
13.1 Parcel-level map grounding
Capability. 4.7 supports images up to 2576px / 3.75MP with 1:1 coordinate mapping — a ~3× increase over prior models. Use. When a council item involves a zoning map, staff exhibit, or planning diagram, Revere has 4.7 identify the exact parcel, route segment, or school boundary relevant to the user's fingerprint and overlay a visual highlight. Trust becomes visible, not asserted. Demo moment. Click Maya's "rezoning" alert → the exact parcel two blocks from her apartment appears highlighted on the city's zoning map.
13.2 Pixel-level chart transcription
Capability. 4.7's improved chart and figure analysis, including programmatic tool-calling with PIL for pixel-level data transcription. Use. Budget charts, enrollment graphs, transit ridership visuals — where the numbers live — get pulled directly from images and translated into personalized implications ("AISD budget line for your kid's elementary dropped 4.2% year over year"). Demo moment. Optional; shown if time allows during AISD item.
13.3 Tracked-change ordinance redlines
Capability. 4.7 improved at .docx redlining with self-checking of tracked changes. Use. When a city ordinance is amended (vs. newly introduced), Revere generates a tracked-change view rather than a summary. The user sees exactly what language changed, not our interpretation. Demo moment. Optional; kept in-app as a trust surface.
13.4 Strict evidence mode
Capability. 4.7's more literal instruction-following. Launch notes explicitly state it will not silently generalize instructions or infer requests that weren't made. Use. A product rule enforced at the system-prompt level: no "why this matters to you" claim unless both a specific source passage AND a specific fingerprint clause justify it. Previous models would generalize loosely; 4.7 adheres to the constraint. Demo moment. Implicit — but the fact that every item has a source-proof button and a fingerprint-tie-back visible is the manifestation of this.
13.5 Self-verification ("rigor")
Capability. 4.7 devises its own verification steps before reporting a task complete. The most publicized 4.7 launch narrative. Use. Backbone of the verification loop (§11.1). Every factual claim is checked against source before it reaches the user. Demo moment. During the live session trace, judges see a claim get rejected by the grader and the item get rewritten. This is a visible "rigor" moment.
13.6 Complementary 4.7 usage (bonus)
Adaptive thinking with display: summarized during live drafting, so the user (and the demo stage) sees thinking progress rather than silence.
1M context window (a 4.6+ feature, not 4.7-unique) to hold full meeting transcripts + agenda packets + skill pack in a single synthesis call when needed.
Advisor strategy — see §15.

14. Claude Managed Agents — Specific Uses
Five uses, designed to make the Best use of Managed Agents prize case concrete. Judge-facing language: "outcome-graded briefings + human-in-the-loop escalation + traceability."
14.1 Outcome-graded briefings
Capability. Managed Agents' Outcomes feature (research preview) lets an agent define success criteria for an artifact, self-evaluate against them, and iterate until the artifact passes. Use. Every briefing item must meet a four-part rubric: (1) source link present and valid, (2) transcript timestamp or page number present, (3) fingerprint tie-back specific and justified, (4) zero unverified claims. A grader agent runs in a separate session context, evaluates candidate items against the rubric, and returns rewrite instructions until the item passes or is dropped. Why this wins. This is the canonical Managed Agents pattern — defining outcomes, iterating to them — applied to a real, judge-legible quality problem.
14.2 Human-in-the-loop escalation
Capability. Managed Agents exposes session status events including session.status_idled, allowing clean pause/resume rather than keeping connections open. Use. When a draft's confidence is low, or when the adversarial refinement loop surfaces an unresolvable tension between variants, the session idles and surfaces in the app as "needs your attention." The user reviews, edits, or skips. No forced AI autonomy where it doesn't belong. Why this wins. Pairs directly with "never autosends." Shows production-grade workflow thinking, not just demo capability.
14.3 Session tracing as product trust surface
Capability. Managed Agents Console exposes session lists, tracing view, and tool-execution details. Use. The in-app "why am I seeing this?" button on every briefing item opens a simplified trace view: which jurisdiction agent ran, what it read, which verification passes ran, which fingerprint clauses matched. Tracing is both a debugging tool for us and a trust surface for the user. Why this wins. Reframes observability from a developer feature to an end-user feature. Judges get to see it both ways — on stage via the Console trace and in-product via the trust pane.
14.4 Versioned per-jurisdiction agents with least-privilege environments
Capability. Managed Agents supports reusable, versioned agent configurations and environment specs with explicit network access rules. Use. Three agents in v1 — austin-council-v1, aisd-v1, texas-lege-v1 — each with its own skill pack, its own system prompt optimized for that jurisdiction's quirks, and an environment scoped to only that jurisdiction's allowed hosts (e.g., Austin agent can hit austintexas.legistar.com, youtube.com/ATXN, austintexas.gov — and nothing else). Why this wins. Looks like something that would actually ship. Matches CrossBeam's winning per-city skills-pack pattern from the 4.6 round.
14.5 Durable memory (conditional on research preview access)
Capability. Memory research preview provides persistent stores outside any single session. Use (if access granted). Civic fingerprints and learned voice styles migrate from Supabase to Memory stores. Feedback events accrue into a cross-session learning record that sharpens the relevance model over weeks. Use (if access not granted). All durable state stays in Supabase. We say this plainly in the pitch and explain why: sessions are ephemeral by default, and we implemented the durable layer correctly.
14.6 What we deliberately skip
Multi-agent orchestration (research preview). The jurisdiction agents run in parallel but do not coordinate with each other across sessions — each produces independent candidate items, and our orchestrator merges them. This keeps the architecture honest, requestable-access-free, and doesn't overclaim.

15. Model Routing & the Advisor Strategy
Anthropic publicly advocates the advisor strategy: Haiku and Sonnet do the bulk of the work, Opus intervenes only when the case is ambiguous or high-stakes. Revere implements this explicitly.
Task
Primary model
Escalation trigger
Meeting transcript bulk classification
Haiku 4.5
Always primary.
Agenda item classification
Haiku 4.5
If topic doesn't match any skill-pack category → Sonnet 4.6.
First-pass item summary
Sonnet 4.6
Always primary.
Hi-res map / diagram reading
Opus 4.7
Always primary (vision threshold).
Verification loop
Opus 4.7 (xhigh)
Always primary (rigor threshold).
Fingerprint matching
Sonnet 4.6
If item is partially_supported or confidence < 0.7 → Opus 4.7.
Briefing synthesis (final compose)
Opus 4.7 (high)
Always primary.
Adversarial refinement loop
Opus 4.7 (high)
Always primary.
Voice onboarding conversation
Opus 4.7 (high, adaptive thinking)
Always primary.

The result: most tokens are cheap Haiku tokens. Opus 4.7 runs on the few steps where its precision, vision, or rigor meaningfully improve the outcome. This produces a concrete cost-quality story judges recognize ("we use Opus for what Opus is uniquely good at") and keeps the $1K credit budget viable.

16. Data Sources
16.1 Austin City Council (primary)
Agendas, motions, staff reports, voting records. austintexas.legistar.com — Legistar's standard URL structure makes scraping predictable.
Meeting video. ATXN YouTube — archived after each meeting with closed captions available for transcript extraction.
Live stream (if ever needed). atxn.tv — not needed for v1 since we work from archives.
Councilmember-specific data. austintexas.gov/council — member pages, district maps, voting histories.
16.2 AISD (secondary)
Board agendas and docs. AISD uses BoardDocs (standard K-12 agenda platform).
Meeting video. AISD YouTube channel.
16.3 Texas Legislature (secondary)
Bills, votes, committee activity. Texas Legislature Online (TLO) — capitol.texas.gov.
Session video. House/Senate webcasts.
16.4 Data access strategy
All sources are fully public. No API keys, no authentication, no paywalls. Scraping patterns:
Legistar: HTML scraping with Cheerio; predictable DOM structure.
YouTube: yt-dlp for video download and automatic caption extraction.
BoardDocs: HTML scraping.
TLO: HTML scraping; TLO also provides RSS feeds for bill status changes.
All scrapers live inside the per-jurisdiction Managed Agents skill packs (§17).

17. Skills System (CrossBeam-Style)
Mike Brown's CrossBeam won the 4.6 hackathon with a skills-pack architecture — 28 reference files on California ADU law, structured so the agent loaded only the 3–5 files relevant to a specific query. Revere adopts the same pattern, per-jurisdiction.
17.1 Folder structure
/skills/
  /jurisdictions/
    /austin-city-council/
      SKILL.md                      ← entry point, index, when-to-use
      /scrapers/
        legistar-agenda.md          ← scraping instructions + HTML selectors
        atxn-youtube-archive.md
      /reference/
        council-districts.md        ← district boundaries, current members
        committee-structure.md
        parliamentary-procedure.md
      /taxonomy/
        land-use.md                 ← topic ontology for classification
        transportation.md
        public-safety.md
        budget.md
        housing.md
      /output-schemas/
        motion.json
        public-hearing.json
        staff-report.json
    /aisd/
      SKILL.md
      ...
    /texas-lege/
      SKILL.md
      ...
  /fingerprint/
    SKILL.md                        ← how to interpret a civic fingerprint
    matching-rubric.md              ← explicit rubric for relevance scoring
  /drafting/
    SKILL.md
    public-comment-template.md
    rep-email-template.md
    phone-script-template.md
    voice-styles/
      measured.md
      direct.md
      persuasive.md
  /verification/
    SKILL.md                        ← source-check protocol
    quote-extraction.md
    claim-typology.md

17.2 Design principles
One SKILL.md per folder — the entry point that describes what's in the folder and when to load it.
Decision-tree routing. The agent does NOT dump the whole skill pack into context. It reads SKILL.md, identifies the 3–5 reference files relevant to its current query, and pulls only those. (CrossBeam pattern.)
Skills are versioned and checked into git alongside the codebase.
Skills are extensible. Adding a new jurisdiction = adding a new folder under /jurisdictions/ + wiring a new Managed Agent to use it. This is how we demonstrate the "any city" story at the end of the demo.

18. Security, Privacy & Trust
18.1 Data stored
Fingerprint JSON (stored at district granularity, never precise home address).
Briefing history.
Action drafts and edits (never submissions — Revere doesn't handle those).
Feedback events.
18.2 Data not stored
Precise home address (we only need district-level granularity).
Voice audio from onboarding (transcribed once, audio discarded).
Any submissions (user submits through their own email/channel; we never see the send).
18.3 User data rights
Export fingerprint as JSON at any time.
Delete account → all data purged, including agent-session logs tied to the user.
18.4 Trust UX
Every briefing claim has one-tap source proof.
Every item has a "why am I seeing this?" session trace.
Every draft shows the critic pass inline.
Nothing auto-submits.
18.5 Threat model for AI public comment distortion
Specifically addressed because it's a known policy concern (Brennan Center; pending federal legislation; multiple state-AG guidance documents on AI-drafted comments). Revere's mitigations:
Never autosends. The user must take an affirmative action to submit.
Draft variants, not one output. Encourages editorial engagement, not cut-and-paste.
Critic pass inline. Surfaces the weaknesses of each variant so users edit.
Fingerprint-tied reasoning. Draft is anchored in user's actual priorities, not generic talking points.
One draft per user. No bulk generation across accounts.

19. Demo Specification
19.1 Target duration: 120 seconds
Judge attention is a scarce resource. The demo is rehearsed to fit in 2 minutes with 30 seconds of buffer for nerves.
19.2 Demo beat sheet
Time
Beat
What happens on screen
What is said
0:00–0:10
Hook
Black screen, white text: "Paul Revere rode at night so citizens woke up knowing." Fade to: "Most Americans don't know what their city council voted on last night."
"Paul Revere rode through the night so sleeping citizens would know what was coming. In 2026, most Americans don't know what their city council voted on last night. This is Revere."
0:10–0:20
The two people
Split screen: Maya's fingerprint summary left, Jason's right.
"Maya rents in East Austin, one kid in AISD. Jason owns a duplex three blocks away, runs a small coffee shop. Both live in the same district. Last night the council met for 4 hours."
0:20–0:40
Maya's briefing
Her morning email opens. Three alerts.
"Here's what Revere sent Maya at 7am. A rezoning two blocks from her apartment. An AISD budget line affecting her kid's elementary. A transit schedule change on her commute route."
0:40–0:55
The source proof
Click rezoning alert. Hi-res zoning map opens. The parcel two blocks from Maya is highlighted. Transcript timestamp queued to the exact discussion.
"Every claim has receipts. Here's the parcel. Here's the council discussion."
0:55–1:15
The money shot
Switch persona to Jason. Same meeting. Totally different briefing.
"Now watch. Same meeting. Same four hours. Different person. Jason's top alert is about a TABC rule change that affects his liquor license. The rezoning doesn't even make his top three."
1:15–1:35
The Managed Agents trace
Open the live session trace from last night's 2am run. Parallel jurisdiction agents visible. A grader call showing a rejected claim.
"This ran at 2am while both of them were asleep. Three Managed Agents sessions — Austin Council, AISD, Texas Lege — in parallel. Every factual claim verified. This one got rejected because the source didn't support the draft wording, so the briefing rewrote it."
1:35–1:55
The action flow
On Jason's TABC alert, tap "draft a reply." Three variants appear side by side with critic annotations.
"When action makes sense, Revere drafts three variants and argues with itself. Direct. Measured. Persuasive. Jason picks one, edits it, and sends it himself. Revere never submits for you."
1:55–2:05
The ask
Closing card: "Revere. Same public record. Different lives. Receipts on every claim."
"Civic information, personal. Civic action, yours."

19.3 Backup plan
Pre-recorded video of the exact same demo, rendered the night before, available as a fallback if live streaming fails. Judges are told this is available as backup up front so there's no surprise.
19.4 What is live vs. cached
Live: UI, persona switching, source-proof clicks, draft generation, trace view.
Cached: the overnight ingestion run. We do not run it live during the demo — it already ran at 2am that morning. The Managed Agents session trace we show is the real trace from the real run.

20. Build Plan
One person, one week, $1,000 in API credits. Tasks are listed in dependency order, not calendar order. Finish a task, pull the next one whose dependencies are met. If you're ahead, keep pulling; if you're behind, the task graph shows you exactly what's blocking what.
20.1 How to read this plan
Every task has:
ID (e.g., T-12) for referencing in commits and PRs.
Depends on — tasks that must be done first.
Gate — the observable proof that the task is complete. If the gate doesn't fire, the task isn't done, regardless of how much code was written.
Est — rough effort (S = <2h, M = 2–5h, L = 5–10h, XL = 10h+). Use these to batch work, not to commit to schedule.
Critical path / parallel — critical-path tasks block the demo. Parallel tasks can be done by another agent, a second you, or deferred if time runs short.
Two user-facing paths must both land:
Ingestion path: real public record → verified candidate items → personalized briefing. Tasks T-04 through T-18.
Presentation path: clean UI + recruited users + rehearsed demo. Tasks T-19 through T-33.
Demo-day minimum viable set, in priority order: T-01, T-02, T-03, T-04, T-06, T-08, T-09, T-11, T-13, T-15, T-19, T-20, T-21, T-22, T-25, T-28, T-30, T-32, T-33. Everything else strengthens the demo but isn't load-bearing on stage.
20.2 Setup tasks (unblocks everything)
ID
Task
Depends on
Gate
Est
Path
T-01
Hackathon registration + credentials confirmed
—
You have API credit access in Console
S
Critical
T-02
Apply for Managed Agents Outcomes research preview + Memory research preview + multi-agent research preview
T-01
Submission confirmations received (do this TODAY — gate time unknown)
S
Critical
T-03
Create GitHub repo + Supabase project + Vercel project + Cloud Run project + domain (if needed)
T-01
All four services authenticated from local machine
M
Critical
T-04
Repo skeleton per §12.1 layout: .claude/, apps/web, apps/orchestrator, packages/managed-agents, packages/shared, docs/, root CLAUDE.md
T-03
git status clean; first commit pushed
M
Critical

20.3 Knowledge scaffolding (the skills packs)
ID
Task
Depends on
Gate
Est
Path
T-05
Draft .claude/skills/jurisdictions/austin-city-council/SKILL.md with scrapers/, reference/, taxonomy/, output-schemas/ stubs
T-04
Skill loads via progressive disclosure; manual test prompt routes to it
M
Critical
T-06
Populate Austin taxonomy files (land-use, transportation, public-safety, budget, housing) and output schemas (motion.json, public-hearing.json, staff-report.json)
T-05
A known real agenda item classifies correctly end-to-end
M
Critical
T-07
Draft AISD and Texas Lege skill packs (shallower — agenda parsing only, no video)
T-05
Skill loads; schemas mirror Austin's shape
M
Parallel
T-08
Draft .claude/skills/verification/SKILL.md (source-check protocol, claim typology, quote-extraction rules)
T-04
Subagent verification-auditor can load and apply it
M
Critical
T-09
Draft .claude/skills/fingerprint/SKILL.md (interpretation + relevance-scoring rubric + anti-priority rules)
T-04
Test rubric against Maya/Jason personas by hand
M
Critical
T-10
Draft .claude/skills/drafting/SKILL.md (public-comment/rep-email/phone-script templates + voice styles)
T-04
Claude produces a reasonable first draft using the skill
M
Parallel

20.4 Ingestion layer
ID
Task
Depends on
Gate
Est
Path
T-11
Austin Council scraper: Legistar HTML + ATXN YouTube + yt-dlp caption extraction. Persists raw meeting data to Supabase.
T-04, T-06
One known real Austin meeting ingested end-to-end; raw video + captions + agenda text in Supabase
L
Critical
T-12
Supabase schema migration per §12.4 (users, fingerprints, jurisdictions, meetings, candidate_items, briefing_items, briefings, drafts, feedback_events, agent_sessions)
T-03
supabase db push clean; all tables present in Console
M
Critical
T-13
austin-council-v1 Managed Agent: agent config + environment spec with least-privilege allowed-hosts. Runs the full ingestion flow and writes structured candidate-item records.
T-11, T-12, T-05
One Managed Agents session completes and produces ~20 candidate items in candidate_items table
L
Critical
T-14
aisd-v1 + texas-lege-v1 Managed Agents (shallower)
T-07, T-12
Each produces at least a few candidate items from a recent real meeting/session
M
Parallel
T-15
Verification loop: per-claim source-check via Messages API (Opus 4.7, effort: xhigh). Drops or rewrites failing items.
T-08, T-13
At least one candidate item gets rejected on stage-legible grounds; rewritten version passes
L
Critical
T-16
Outcomes-graded briefing pass. If Outcomes access granted → native Managed Agents implementation. Else → equivalent grader as a separate Messages API call in the orchestrator.
T-15, T-02
Same rubric gate enforced either way; rubric failures are observable in logs
M
Parallel
T-17
Fingerprint matching: score each verified item against a fingerprint, produce a ranked briefing. Seed Maya and Jason fingerprints via scripts/seed-fingerprints.ts.
T-09, T-15
Two distinct briefings (Maya's and Jason's) generated from the same meeting, with clearly different top items
M
Critical
T-18
Synthesis step: final per-user briefing compose (Opus 4.7) with headlines, tie-backs, source links
T-17
Produces well-formed briefing JSON that the UI can render
M
Critical

20.5 Scheduling + automation
ID
Task
Depends on
Gate
Est
Path
T-19
Claude Code Routine: nightly trigger at 2am that fans out to all jurisdiction agents and then runs synthesis. Auto mode enabled.
T-13, T-14, T-18
One unattended overnight run completes; morning-of, fresh briefings exist for both personas
M
Critical
T-20
Fallback scheduler (Cloud Run Scheduled Job hitting orchestrator) if Routines research preview is flaky
T-19
Either route can run the nightly; smoke-tested
S
Critical

20.6 Action flow
ID
Task
Depends on
Gate
Est
Path
T-21
Adversarial refinement loop: writer → staffer critic → refiner → opposing-constituent critic → refiner → press-shop critic → refiner → three final variants
T-10, T-18
On a real briefing item, three variants produced with visibly different voicing; critic annotations captured
L
Critical
T-22
Draft-variant UI with side-by-side view, inline critic annotations, and human-review gate (mailto: / clipboard handoff, never autosends)
T-21
Clicking "draft a reply" on a real item produces three variants; "submit" opens external channel
M
Critical

20.7 User-facing surfaces
ID
Task
Depends on
Gate
Est
Path
T-23
Magic-link auth via Supabase Auth
T-03
Sign-in works on deployed URL
S
Critical
T-24
Morning briefing email template (plain + light HTML) + SendGrid/Resend integration
T-18
Test email arrives at a real inbox in correct format
M
Critical
T-25
In-app briefing list view + item detail view
T-18, T-23
Renders Maya's briefing from Supabase data; looks newspaper-clean
M
Critical
T-26
Source-proof pane: hi-res zoning map rendering with parcel highlight (Opus 4.7 vision output), transcript timestamp-deep-link, agenda-page link
T-25
One briefing item shows a real map with a real highlighted parcel
L
Critical
T-27
"Why am I seeing this?" session-trace view in-app
T-13, T-25
Clicking the button shows the real Managed Agents session that generated the item
M
Critical
T-28
Persona switcher for demo (switch between Maya and Jason without re-login)
T-25
Toggle between both personas; briefing reloads correctly
S
Critical
T-29
Voice onboarding flow: Deepgram STT → Claude (Opus 4.7, adaptive thinking) → ElevenLabs TTS. Progressive conversation, not a form.
T-09, T-23
A brand-new user can complete onboarding in 8–12 minutes and produce a valid fingerprint JSON
L
Critical

20.8 Polish + recruit + rehearse
ID
Task
Depends on
Gate
Est
Path
T-30
Recruit 3 real Austinites per §22; schedule demos; record 15-second testimonials
T-29, T-25
Three video clips saved; at least one usable on-stage
L
Critical
T-31
Visual polish pass on frontend: newspaper typography, spacing, responsive layout, empty states
T-25, T-26, T-27, T-28
Full walkthrough looks intentional; no placeholder text or broken edges
M
Parallel
T-32
Pre-recorded demo video (backup if live fails on stage)
T-28
2-minute video exported at 1080p+ with clean audio
M
Critical
T-33
Final demo rehearsal: 3 full dry-runs, timed, using demo-rehearser subagent as editor
T-22, T-26, T-27, T-28, T-30
All three under 2:05; hook lands in first 10s; money-shot visible
M
Critical

20.9 Stretch tasks (only if you're ahead)
ID
Task
Depends on
Gate
Est
Path
T-34
Tracked-change .docx ordinance redline (Opus 4.7 docx capability)
T-18
One ordinance amendment rendered as visible redline in-app
M
Stretch
T-35
Pixel-level budget chart transcription demo
T-11
One AISD budget chart value pulled from image to text in briefing
M
Stretch
T-36
Spanish fingerprint pass: accept onboarding in Spanish, produce briefing in Spanish
T-29
Onboarding works in Spanish end-to-end
L
Stretch
T-37
Election mode teaser: a single candidate-by-fingerprint comparison slide ready to show on the roadmap-slide close
T-18
One side-by-side rendered with real local candidate data
M
Stretch
T-38
Multi-user session tracing in the Console: instrument analytics so the trace view works for any user, not just Maya/Jason
T-27
New user's trace loads correctly
S
Stretch

20.10 Task-graph invariants
A few rules that keep the graph honest as you pull tasks:
Never skip a gate. If a gate doesn't fire, the task is open. No "we'll fix it later." Open tasks compound.
If blocked, pull a parallel task. Every section above has a mix of critical-path and parallel tasks. When ingestion is blocked on a scraper bug, work on the UI.
If ahead, pull from stretch. Tasks T-34 through T-38 each strengthen the pitch without being load-bearing. T-34 and T-37 are the highest-value stretch tasks for demo-day.
Commit per gate. Every time a gate fires, make a commit with the task ID in the message: git commit -m "T-15: verification loop passes on real data". This makes your git log a status board.
Day-6 user recruitment is non-negotiable. T-30 is the only task with an implicit calendar dependency: you need human beings to show up, and humans need lead time. Start DM'ing recruits as soon as T-25 lands, even if polish isn't done.
20.11 When to call it done
Submission is ready when all of the following fire:
[ ] T-01 through T-33 gates all checked.
[ ] At least one user testimonial recorded and edited (T-30).
[ ] Pre-recorded demo exported (T-32).
[ ] Three live rehearsals under 2:05 (T-33).
[ ] Submission blurb written (500 words, covering hook → demo → Opus 4.7 usage → roadmap).
[ ] GitHub repo public with clean README.
If you complete the critical-path tasks (T-01 through T-33) with time remaining, pull from the stretch tasks (T-34 through T-38) in order of demo-day impact. If you're behind, ruthlessly cut parallel tasks (T-07, T-10, T-14, T-16, T-31 can all be trimmed without killing the demo).

21. API Credit Budget
Assumes $1,000 in Claude API credits. Numbers are estimates based on published pricing ($5/M input, $25/M output for Opus 4.7; Sonnet and Haiku materially cheaper) and rough per-call token counts.
Workload
Estimated volume
Model
Unit cost
Full-week cost
Bulk transcript classification
~500K in
Haiku 4.5
~$0.50
~$3.50
Agenda item classification
~200K in
Haiku 4.5
~$0.20
~$1.40
First-pass item summarization
~100K in, 20K out
Sonnet 4.6
~$1
~$7
Hi-res map/diagram reading
~50K in (images), 10K out
Opus 4.7
~$0.50
~$3.50
Verification loop
~150K in, 30K out
Opus 4.7 (xhigh)
~$1.50
~$10.50
Briefing synthesis
~200K in, 50K out
Opus 4.7
~$2.25
~$15.75
Voice onboarding (dev + demo)
~50K in, 20K out
Opus 4.7
(one-shot)
~$3
Adversarial refinement loop (per draft)
~30K in, 10K out
Opus 4.7
(per invocation)
~$10 (est. 20 drafts during dev)
Managed Agents session-hours
~2 hrs/night × 7
$0.08/hr
—
~$1.12
Subtotal






~$55
Reserve for dev iteration, debugging, bad prompts






~$400
Reserve for demo-day rehearsals + live demo






~$100
Emergency buffer






~$445
TOTAL






~$1,000

Aggressive use of prompt caching on the skill pack content (CrossBeam pattern) and on per-jurisdiction system prompts will reduce these numbers substantially. The budget is conservatively sized — we expect to come in well under.

22. User Recruitment Plan
CrossBeam had the Mayor of Buena Park looking at adoption before submission. Our equivalent: three real Austinites on video, completed as task T-30.
22.1 Who to recruit
A renter-parent matching the Maya archetype.
A small-business owner matching the Jason archetype.
One wild card — a civic organizer, local journalist, or neighborhood-association board member who can speak to the broader value.
22.2 Where to find them
Reddit. r/Austin (~550k members) — post a polite ask for volunteers. Offer: 15-minute call, see a demo, give feedback. No payment (can't; hackathon rules).
Austin City Council public-comment archive. People who've filed public comments recently have already demonstrated civic engagement. Look up their contact if publicly listed.
Local FB groups. Specific neighborhood groups (East Austin Neighborhood Association, etc.).
Local advocacy orgs. AURA (Austinites for Urbanism, Reform, Action), ATX Pride, small-business associations, PTA.
22.3 The ask (template)
"Hi — I'm a student building a civic tech tool for the Anthropic hackathon this week. The tool personalizes your local government news so you only see what affects you. I'd love 10 minutes of your time for a demo and an honest reaction. If you like it, I'd love a 15-second video quote I can show the judges. No payment, no commitment."
22.4 The deliverable
A 15–30 second video clip per person. Something like: "I've lived in Austin for 12 years. I had no idea this rezoning was happening two blocks from me until Revere told me. I would have missed it."
These clips replace an entire "impact" argument slide.

23. Rubric Alignment
Anthropic's published judging criteria, mapped to Revere.
Impact (30%) — Real-world potential; does it matter?
~50M Americans with limited/no local news access (Medill 2025).
Personalized civic engagement has been a policy goal across party lines for decades; no existing tool has achieved it.
Universal resonance: every judge has skipped their local elections or ignored their city council.
Recruited users with real testimonials (T-30).
Demo (25%) — Working, impressive, holds up live?
Single undeniable transformation: same meeting → two people → two different briefings with receipts.
Visible Managed Agents trace confirming the overnight run actually happened.
Live adversarial loop producing three variants in real time.
Every claim has an instant-click source proof.
Opus 4.7 Use (25%) — Creative, beyond basic integration?
Five specific, documented 4.7 capabilities used honestly (§13).
Advisor-strategy model routing (§15).
Clean separation between 4.7 model features and Claude platform features.
Depth & Execution (20%) — Wrestled-with craft?
Two distinct review loops (verification + adversarial) serving two different ethical/quality problems.
CrossBeam-style skills-pack architecture that generalizes to any jurisdiction (demonstrated at end of demo).
Recruited real users with recorded feedback.
Multiple deliberate scope cuts documented (§7.3).
Every technical claim in this PRD fact-checked against Anthropic's current public docs.
Secondary prize: Best use of Claude Managed Agents ($5K)
Five concrete Managed Agents uses (§14), emphasizing outcome grading, HITL escalation, tracing as trust surface, versioned agents with least-privilege environments, and durable memory (conditional). Judge-legible quality story, not multi-agent fireworks.
Secondary prize: Keep Thinking ($5K)
If the grand prize goes elsewhere, Revere is a legitimate contender here — personalized civic materiality is a problem nobody has pointed Claude at before, and the demo lands somewhere judges didn't expect.

24. Risks & Mitigations
R1: Hallucinated facts reach the user.
Mitigation. Verification loop is non-optional. Every claim must be supported. This is literally why the verification loop exists.
R2: The two personas' briefings look too similar on demo day.
Mitigation. Deliberate fingerprint contrast (renter vs. owner, parent vs. non-parent, car vs. walker). T-17's gate explicitly tests for visible divergence. If they don't diverge enough, we tune the fingerprints further.
R3: Managed Agents Outcomes access not granted by demo day.
Mitigation. Apply as part of T-02, which is the first substantive task in the plan. If not granted by the time T-16 is pulled, implement an equivalent grader as a simple Messages API call in our orchestrator. Same behavior, just not using the native Outcomes primitive. Judges won't penalize a reasonable fallback; they'd penalize overclaiming a feature we don't have.
R4: Overnight run fails mid-build.
Mitigation. Routines-based scheduler with Auto mode means no local dependency. If the Routines research preview is flaky, we fall back to a Vercel cron or Cloud Run scheduled job hitting the orchestrator.
R5: Live demo video/audio fails.
Mitigation. Pre-recorded backup is task T-32, with its own gate. Rehearsed opening line that works whether video loads or not.
R6: Voice onboarding is harder than expected.
Mitigation. If T-29 stalls, fall back to a conversational text chat that has the exact same content. The conversation quality matters more than the modality. Can demo voice for one persona only if needed.
R7: Scope creep eats polish and rehearsal time (T-31, T-32, T-33).
Mitigation. Every out-of-scope item in §7.3 is there deliberately. Every "would be nice" thought during the week gets written into Post-Hackathon Roadmap (§25), not added to scope. If a new idea hits while building, it goes to the roadmap, not the task graph.
R8: Austin City Council doesn't meet during hackathon week.
Mitigation. Use archived meetings from the past month (publicly available). The demo uses a specific prior meeting that we've pre-ingested. This is fine and honest — we disclose it.
R9: Judge asks "what's your moat / why can't OpenAI do this?"
Answer. The fingerprint + verification + action flow + skills-pack pattern is the moat, not the LLM choice. Any model could theoretically power Revere. Opus 4.7 is what makes it work reliably enough to ship — specifically the rigor and the hi-res vision. We have an opinion about which model, but the product is the wedge.
R10: Judge asks about astroturfing / AI public comments.
Answer. Revere never autosends. Every submission requires the user's affirmative action. The adversarial loop surfaces the weaknesses of each draft to encourage editorial engagement, not cut-and-paste. This is a response to Brennan Center concerns, not an ignorance of them.

25. Post-Hackathon Roadmap (brief)
Only shown if judges ask; otherwise a one-slide tease at demo end.
Election mode. When an election is upcoming in any of the user's jurisdictions, the briefing shifts to candidate-by-candidate cross-referencing against fingerprint priorities.
Federal + international. Congress, Fed, SCOTUS, EU, UN — same architecture, new skill packs.
Journalist/advocate mode. Multi-user with saved fingerprints for "covering" a beat or constituency.
Voice briefing playback. Listen to your morning briefing on your commute.
Multilingual. Spanish-first, then Vietnamese (largest non-English groups in Austin).
Civic group deployment. A neighborhood association or advocacy org can run Revere for its members with a shared fingerprint template.
"Revere for your workplace." HR-beat briefings on labor law, benefits regulation, workers' comp changes.

26. Appendix A — Starter Prompts
Draft prompts, to be refined during the build.
26.1 Austin Council ingestion agent (system prompt, excerpt)
You are a research analyst agent reading the output of Austin City Council. For each meeting, you will read the full agenda packet and the meeting video transcript. For each agenda item, produce a structured candidate-item record with: (1) item_id, (2) topic classification from /skills/jurisdictions/austin-city-council/taxonomy/, (3) 2-sentence neutral summary, (4) list of factual claims with source page/timestamp for each, (5) affected groups (at fingerprint-taxonomy granularity), (6) any upcoming public-comment or hearing window. Do not infer. Do not editorialize. If a claim lacks clear source support, mark it unsupported and move on.
26.2 Verification agent (system prompt, excerpt)
You are a fact-checker. You receive a draft briefing item and the original source material (agenda PDF text, meeting transcript). For each factual claim in the draft, locate the supporting passage in the source. Return exactly one of: supported (claim matches source), partially_supported (claim directionally right but overstated), unsupported (no matching source passage), contradicted (source says something different). For partially_supported and unsupported, return a corrected version. Use your self-verification capabilities to double-check your own judgments before reporting.
26.3 Adversary personas
Council staffer prompt (excerpt): "You are a senior city-council staffer who has read thousands of public comments. Your job is not to agree with this draft — your job is to find the procedural and technical problems: wrong code citation, wrong body's jurisdiction, missed filing deadline, misstated fact, weak ask. Attack specifically. Cite exactly what's wrong."
Opposing constituent prompt (excerpt): "You are a thoughtful resident with the opposite view on this issue. Not a troll — a real person with a coherent opposing position. Your job is to attack this draft's strongest argument from its opposite. What will people on the other side say in rebuttal? What will win at the dais?"
Press shop prompt (excerpt): "You are the communications director for the councilmember this comment is addressed to. Your job is political risk assessment: which framing lands and which invites dismissal? Which words trigger unhelpful responses? Is the ask actionable or performative?"
26.4 Refiner prompt (excerpt)
You have the previous draft, the adversary's attack, and the user's civic fingerprint. Your job is to incorporate every valid critique, defend against weak ones, and produce a hardened draft that stays in the user's stated voice. Do not soften to placate the adversary. Do not stretch facts. Preserve every source citation.

27. Appendix B — Data Source Inventory
(Cross-reference for §16 with specific URLs and access notes.)
Source
URL
Access
Notes
Austin City Council agendas
austintexas.legistar.com
HTML scrape
Standard Legistar structure
Austin meeting video
youtube.com/user/austintexasgov
yt-dlp + captions
Captions available within hours
Austin live stream
austintexas.gov/communications/watch-atxn-live
N/A v1
Use archive instead
Council district maps
austintexas.gov/council
Static HTML + GIS
Needed for parcel-level grounding
AISD board docs
AISD BoardDocs URL
HTML scrape
Standard BoardDocs structure
AISD meetings
YouTube
yt-dlp + captions


Texas Legislature
capitol.texas.gov
HTML scrape + RSS
RSS for bill-status changes
Texas House webcast
house.texas.gov
Conditional v1
Skip unless high priority
Texas Senate webcast
senate.texas.gov
Conditional v1
Skip unless high priority


28. Appendix C — Glossary
Civic fingerprint. The structured per-user profile that drives all personalization decisions.
Skill pack. A folder of reference files, organized per CrossBeam's pattern, loaded selectively by agents.
Verification loop. Per-claim source-check pass; part of overnight ingestion.
Adversarial refinement loop. Three-persona critic + refiner sequence; runs during drafting.
Managed Agents. Anthropic's pre-built agent harness; hosts the jurisdiction ingestion workers.
Routine. Claude Code's cloud-scheduled automation (research preview); fires the nightly cron.
Advisor strategy. Anthropic's pattern of routing most tokens to Haiku/Sonnet, escalating to Opus only on hard cases.
Outcomes (Managed Agents). Feature that lets an agent grade its artifacts against a rubric and iterate (research preview).
Strict evidence mode. Our product rule (enforced via 4.7's literal instruction-following) that no "why this matters to you" claim is allowed unless justified by both source and fingerprint.
Never autosends. The ethical guarantee: every submission requires the user's affirmative action.

End of document. Version 1.0 · Ready for build.

