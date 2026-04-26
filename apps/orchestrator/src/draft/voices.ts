// Voice prompt bodies for the writer + refiner. Mirrors
// .claude/skills/drafting/voice-styles/{direct,measured,persuasive}.md
// at the prompt level — the .md files are the canonical source for
// docs/policy; this is the inlined-into-prompts working copy.

import type { Voice } from "@revere/shared";

export const VOICE_PROMPTS: Record<Voice, string> = {
  direct: [
    "DIRECT — short, plainspoken, action-oriented.",
    "Sentence cap: 12 words. Most sentences 6–10.",
    "Lead with the ask in the first sentence after the procedural preamble.",
    "Avoid: 'I would respectfully', 'it seems to me', conditional moods, stacked qualifiers.",
    "Length target: 180–240 words. The shortest of the three voices.",
    "Closing: 'Thank you for your time.' One sentence.",
  ].join("\n"),
  measured: [
    "MEASURED — civic-formal default. Acknowledges tradeoffs without surrendering the ask.",
    "Sentences 18–22 words on average; max 28. Vary length.",
    "One acknowledgement of the opposing concern, then the ask. Never more than one hedge.",
    "Avoid: stacked qualifiers, 'clearly'/'obviously', rhetorical questions.",
    "Length target: 300–340 words.",
    "Closing: a single-line thank-you. No 'in conclusion'.",
  ].join("\n"),
  persuasive: [
    "PERSUASIVE — leads with personal stake or district impact, then the ask.",
    "Use exactly ONE rhetorical device per draft (analogy, contrast, vivid concrete detail).",
    "Open with a 1–2 sentence concrete vignette grounded in the user's fingerprint (a corner, a route, a weekly experience).",
    "Sentence length varies widely. One short sentence (4–6 words) used as a punctuation mark.",
    "Avoid: empty rhetoric ('the very fabric of our community'), more than one rhetorical device, speculation about other voters' motives.",
    "Length target: 320–360 words.",
    "Closing: a one-sentence callback to the opening vignette, then thank you.",
  ].join("\n"),
};

export const VOICE_LIST: Voice[] = ["direct", "measured", "persuasive"];
