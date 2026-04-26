// "Your government" ladder — the bodies that represent the user.
// Stacks vertically; each row: level kicker, body name, district label.
// Clarifies why ballot races + briefing items showed up.

import type { RepresentationEntry } from "@revere/shared";

interface Props {
  ladder: RepresentationEntry[];
}

const LEVEL_LABEL: Record<RepresentationEntry["level"], string> = {
  municipal: "City",
  county: "County",
  school: "School",
  state: "State",
  federal: "Federal",
};

export function RepresentationLadder({ ladder }: Props) {
  return (
    <aside className="animate-fade-up border-y border-whisper py-8">
      <p className="text-label uppercase tracking-[0.16em] text-district">
        Your government
      </p>
      <p className="mt-2 max-w-prose text-body-sm text-ink/60">
        The bodies that represent your address. Each one shows up in your
        briefing when they meet, and on your ballot when they're up.
      </p>
      <ul className="mt-6 grid grid-cols-1 gap-x-12 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
        {ladder.map((r, i) => (
          <li
            key={`${r.level}-${r.body}-${i}`}
            className="border-l-2 border-district/30 pl-4"
          >
            <p className="text-label uppercase tracking-[0.12em] text-district">
              {LEVEL_LABEL[r.level]}
            </p>
            <p className="mt-1 font-serif text-body-sm font-semibold text-ink">
              {r.body}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-ink/70">
              {r.district_label}
            </p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
