---
name: drafting
description: |
  Templates and voice-style guides for drafting user-facing civic actions:
  public comment speeches, rep emails, and phone scripts. Use whenever the
  action flow generates text the user will send or speak.
---

# Drafting — Public Comment, Rep Emails, Phone Scripts

Revere never autosends. Everything this skill produces is a draft the user
reviews and chooses to send. Prioritize legibility and the user's voice over
rhetorical flourish.

## Voice styles

The fingerprint carries a `voice` field. Map as follows:

- **measured** — neutral tone, acknowledges tradeoffs, leads with facts.
  Closes with a clear ask but no ultimatum. Avoid loaded language.
- **direct** — short sentences, specific asks, minimal hedging. Still
  respectful; directness ≠ aggression.
- **persuasive** — leads with personal stake or district impact, then the
  ask. Uses one well-chosen rhetorical device per draft (analogy, contrast).

If the fingerprint `voice` is missing, default to **measured**.

## Templates

### Public comment (3-minute limit by default)

```
My name is {first_name}, a resident of District {district}.
I'm here on {item_title} (Item {legistar_id}).

{one-paragraph stake — why this matters to the speaker}

{one-paragraph ask — specific, tied to the motion as filed}

Thank you.
```

Timing: aim for 300–360 words for a 3-minute slot. Cut ruthlessly if the
user has a shorter slot — the ask must always fit.

### Rep email

```
Subject: District {district} constituent — {item_title}

Dear Council Member {rep_last_name},

{2–4 sentences: stake + ask + specific motion reference}

{1 sentence: offer to discuss / attend office hours}

Thank you,
{full_name}
{address on file — included only if user opts in}
```

Default: include address only if the fingerprint has `share_address: true`.

### Phone script

```
Hi, my name is {first_name}. I'm a constituent in District {district}.
I'm calling about {item_title}.

{one-sentence ask}

{one-sentence reason}

Thank you for your time.
```

Phone scripts are read aloud. Keep sentences to ≤ 15 words.

## Hard rules

- Every draft cites the Legistar item ID (agenda items) or the motion's
  canonical source URL. No exceptions.
- Never put words in the user's mouth that aren't grounded in their
  fingerprint priorities or stated stake.
- Never generate a draft that makes a factual claim the verification skill
  hasn't cleared. If the underlying briefing item has any unresolved
  `partially_supported` claim, surface that to the user in the draft UI
  rather than asserting the claim.
- The user's name, address, and contact details come from the account record,
  not from the LLM's memory.
