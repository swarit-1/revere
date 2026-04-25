# reference/voice-resolver

Load when T-10 (drafting) or T-21 (adversarial loop) needs to know
which voice to use for a given user. Returns a voice tag + advisory
hints; T-10 takes the tag and loads the matching voice file.

## Input

The user's `Fingerprint` object. No item or call-specific payload
needed.

## Output

```
{
  voice: "measured" | "direct" | "warm",
  length_preference: "concise" | "thorough" | null,
  formality: "casual" | "neutral" | "formal" | null,
  source: "learned_voice_style" | "explicit_voice_field" | "default"
}
```

`voice` is the load-bearing field — drives which voice file T-10
loads. `length_preference` and `formality` are advisory; T-10 may
use them for tone modulation but isn't required to. `source` is
trace metadata for T-27.

## Resolution order

1. **`fingerprint.learned_voice_style.tone` is non-null** → use it.
   `source = "learned_voice_style"`. Pull `length_preference` and
   `formality` from the same object (each may be null
   independently).
2. **Else `fingerprint.voice` is non-null** (an explicit top-level
   field, set during onboarding) → use it. `source =
   "explicit_voice_field"`. `length_preference` and `formality` =
   null.
3. **Else default to `voice: "measured"`**. `source = "default"`.
   `length_preference` and `formality` = null.

## The three voice tags

The three drafting voices map to three voice files in
`@.claude/skills/drafting/voice-styles/` (which T-10 owns). T-09
doesn't load those files — it only emits the tag.

- **`measured`** — neutral, factual, civic-formal. The sane default
  for users who haven't expressed a preference. T-10's
  `voice-styles/measured.md` defines the prose register.
- **`direct`** — short, plainspoken, action-oriented. For users who
  edit drafts to remove hedging.
- **`warm`** — narrative, personal, "tell a story." For users whose
  edits add context and lived-experience framing. The PRD §10.3
  third-voice option (which it labeled "persuasive") collapses into
  `warm` here — the operative trait the longitudinal loop measures
  is warmth, not the rhetorical persuasion mode.

(Note: PRD §10.3 used `persuasive`. The plan's divergences table
records the rename to `warm` because the longitudinal-learning loop
reads the *trait of the user's edits*, not the rhetorical category
of the output. Drafting voices in T-10 may keep the `persuasive`
file name if that's clearer for the prompt; what matters here is the
tag mapping is consistent.)

## Hard rules

- T-09 reads `learned_voice_style`; it does not compute or write it.
  The longitudinal loop is owned by T-21 follow-up (driven by user
  edit patterns).
- The `voice` tag is the only required output. The other two fields
  are advisory; downstream may pass null through to T-10.
- The voice resolver does NOT call the scoring rubric, the synthesis
  resolver, or any output schema beyond the voice tag. It's a pure
  fingerprint read.
- A user with a fully empty fingerprint still gets a voice
  (`measured` via the default branch). The skill never refuses to
  resolve a voice — there's always a tag.

## Caller protocol

T-10 calls the voice resolver once at the start of a drafting flow
and caches the result for the duration of the draft (including all
adversarial-loop iterations in T-21). The voice doesn't change
mid-draft — that would produce inconsistent prose.

When the user edits a draft and the longitudinal loop updates
`learned_voice_style`, the next drafting flow picks up the change.
This matches the score-going-forward policy in the plan: voice changes
take effect on the next draft, not retroactively.
