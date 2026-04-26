// "Can they actually do that?" badge — the load-bearing differentiator
// per the elections SKILL.md taxonomy. Five tiers + a non-judgmental
// color treatment: vermilion is reserved (per the design ceiling),
// district sage is the affirmative tone, ink/60 is the limitation tone.

import type { PromiseAuthority } from "@revere/shared";
import { AUTHORITY_LABELS } from "@revere/shared";

interface Props {
  authority: PromiseAuthority;
}

const STYLE: Record<PromiseAuthority, string> = {
  direct_authority: "border-district text-district",
  partial_authority: "border-district/60 text-district/80",
  indirect_influence: "border-ink/40 text-ink/70",
  outside_office_scope: "border-vermilion/50 text-vermilion-deep",
  too_vague_to_assess: "border-ink/30 text-ink/50",
};

const SHORT: Record<PromiseAuthority, string> = {
  direct_authority: "Can do",
  partial_authority: "Can move",
  indirect_influence: "Can push",
  outside_office_scope: "Out of scope",
  too_vague_to_assess: "Too vague",
};

export function AuthorityBadge({ authority }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-2 border ${STYLE[authority]} px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]`}
      title={AUTHORITY_LABELS[authority]}
    >
      {SHORT[authority]}
    </span>
  );
}
