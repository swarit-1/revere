// Hand-written TS mirror of .claude/skills/drafting/output-schemas/draft-variant.json.
// One DraftVariant per voice (direct/measured/persuasive), three per draft request.

export type Voice = "direct" | "measured" | "persuasive";

export type Critic = "council_staffer" | "opposing_constituent" | "press_shop";

export type IssueSeverity = "high" | "medium" | "low";

export type CriticRemediation = "accept_some" | "accept_all" | "defend";

export interface CritiqueIssue {
  severity: IssueSeverity;
  description: string;
  suggested_rewrite?: string;
}

export interface CritiqueEntry {
  critic: Critic;
  issues: CritiqueIssue[];
  remediation: CriticRemediation;
  response: string;
}

export interface DraftVariant {
  voice: Voice;
  text: string;
  references: string[];
  critique_trail: CritiqueEntry[]; // length 3, in order
}

export const VOICES: ReadonlyArray<Voice> = ["direct", "measured", "persuasive"] as const;

export const CRITICS_IN_ORDER: ReadonlyArray<Critic> = [
  "council_staffer",
  "opposing_constituent",
  "press_shop",
] as const;
