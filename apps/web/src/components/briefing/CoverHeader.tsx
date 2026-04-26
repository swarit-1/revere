// Cover header. Format from PRD §9.1 + composer prompt:
//   "Revere · Thu Apr 9 · 5 items for you"
// Vermilion is reserved for the date numerals + the item-count numeral.
// Nothing else on the cover should pull the accent color.

import type { ReactNode } from "react";

interface Props {
  raw: string; // e.g. "Revere · Thu Apr 9 · 5 items for you"
}

// Wraps every digit run inside the cover text in vermilion. Keeps the
// editorial tone — numerals are the only thing the eye catches first.
function emphasizeNumerals(s: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let buf = "";
  let inDigit = false;
  for (const ch of s) {
    const isDigit = /\d/.test(ch);
    if (isDigit !== inDigit) {
      if (buf) {
        parts.push(
          inDigit ? (
            <span key={parts.length} className="text-vermilion">
              {buf}
            </span>
          ) : (
            <span key={parts.length}>{buf}</span>
          ),
        );
      }
      buf = ch;
      inDigit = isDigit;
    } else {
      buf += ch;
    }
  }
  if (buf) {
    parts.push(
      inDigit ? (
        <span key={parts.length} className="text-vermilion">
          {buf}
        </span>
      ) : (
        <span key={parts.length}>{buf}</span>
      ),
    );
  }
  return parts;
}

export function CoverHeader({ raw }: Props) {
  return (
    <header className="mb-16 mt-24 border-b border-whisper pb-12">
      <p className="text-label uppercase text-district">
        The morning briefing
      </p>
      <h1 className="mt-6 font-serif text-cover font-bold tracking-tighter text-ink">
        {emphasizeNumerals(raw)}
      </h1>
    </header>
  );
}
