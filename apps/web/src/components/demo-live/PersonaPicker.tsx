// Step 1 of the live demo: pick a persona. Six cards (Maya + Jason
// from the seeded fingerprints, plus four synthesized ones the
// matcher will score live) plus a "Surprise me" button that picks
// at random with a slot-machine flicker so the user can rerun the
// pipeline against a different person each time.

"use client";

import { useState } from "react";
import type { Persona } from "@/lib/demo/personalities";
import { PERSONALITIES } from "@/lib/demo/personalities";

interface Props {
  onPick: (persona: Persona) => void;
}

export function PersonaPicker({ onPick }: Props) {
  const [shuffling, setShuffling] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  function shuffle() {
    if (shuffling) return;
    setShuffling(true);
    let count = 0;
    const total = 14; // ~1.4s of flicker
    const tick = setInterval(() => {
      const idx = Math.floor(Math.random() * PERSONALITIES.length);
      setHighlightId(PERSONALITIES[idx]!.id);
      count += 1;
      if (count >= total) {
        clearInterval(tick);
        const final = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)]!;
        setHighlightId(final.id);
        setTimeout(() => {
          setShuffling(false);
          onPick(final);
        }, 350);
      }
    }, 100);
  }

  return (
    <section className="animate-fade-up mx-auto max-w-5xl px-6 py-16 sm:py-24">
      <header className="mb-14 max-w-3xl">
        <p className="animate-fade-down font-mono text-label uppercase tracking-[0.18em] text-district">
          Step 1 of 3 · Pick a person
        </p>
        <h1 className="mt-6 animate-fade-up-lg font-serif text-display font-light tracking-tighter text-ink delay-100">
          Run Revere on someone
          <br />
          <span className="text-vermilion">specific.</span>
        </h1>
        <p className="animate-fade-up mt-6 max-w-prose font-serif text-body-lg text-ink/75 delay-300">
          Each Austinite below has a real, distinct civic fingerprint —
          their priorities, district, household. Pick one, and watch the
          agents score the same{" "}
          <span className="font-mono text-body-sm">56-item</span> Council
          meeting from <em>their</em> point of view.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PERSONALITIES.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => !shuffling && onPick(p)}
            disabled={shuffling && highlightId !== p.id}
            className={`group relative animate-fade-up overflow-hidden border bg-cream p-6 text-left transition-all duration-300
              ${highlightId === p.id ? "border-vermilion ring-2 ring-vermilion/40" : "border-whisper hover:-translate-y-1 hover:border-ink"}
              ${shuffling && highlightId !== p.id ? "opacity-50" : ""}
            `}
            style={{ animationDelay: `${500 + i * 80}ms` }}
          >
            <div className="flex items-start gap-4">
              <span
                aria-hidden
                className={`flex h-12 w-12 shrink-0 items-center justify-center border font-serif text-2xl font-semibold transition-colors duration-300
                  ${highlightId === p.id ? "border-vermilion bg-vermilion text-cream" : "border-ink text-ink group-hover:bg-ink group-hover:text-cream"}
                `}
              >
                {p.initials}
              </span>
              <div className="flex-1">
                <h3 className="font-serif text-headline-sm font-semibold text-ink">
                  {p.display_name}
                </h3>
                <p className="mt-1 text-body-sm text-ink/70">{p.blurb}</p>
              </div>
            </div>
            <ul className="mt-5 space-y-1 font-mono text-[11px] uppercase tracking-[0.08em] text-district">
              {p.signature_priorities.map((pri) => (
                <li key={pri}>
                  <span className="mr-2 text-vermilion">·</span>
                  {pri}
                </li>
              ))}
            </ul>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/40">
              D{p.fingerprint.location.council_district} · {p.fingerprint.relevance_slider}
            </p>
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-vermilion transition-transform duration-300 group-hover:scale-x-100"
            />
          </button>
        ))}
      </div>

      <div className="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
        <button
          type="button"
          onClick={shuffle}
          disabled={shuffling}
          className="group inline-flex items-center gap-3 border border-ink bg-ink px-6 py-3 font-mono text-label uppercase tracking-[0.16em] text-cream transition-all duration-300 hover:-translate-y-0.5 hover:bg-vermilion-deep disabled:opacity-50"
        >
          <span aria-hidden className={shuffling ? "animate-blink-cursor" : ""}>
            ◇
          </span>
          {shuffling ? "Picking…" : "Surprise me"}
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
            ↗
          </span>
        </button>
        <p className="font-mono text-label uppercase tracking-[0.12em] text-district">
          Or click a card to pick deliberately.
        </p>
      </div>
    </section>
  );
}
