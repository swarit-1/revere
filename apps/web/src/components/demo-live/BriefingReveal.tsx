// Step 3 of the live demo: editorial briefing reveal. Same visual
// language as /demo?fp=...'s real briefing — newspaper cover header
// with vermilion numerals, hairline-divided items, why_this in mono.
// Re-uses the same item shape produced by the live scorer.

"use client";

import type { Persona } from "@/lib/demo/personalities";
import type { LiveDemoPayload } from "@/lib/demo/types";

interface Props {
  persona: Persona;
  payload: LiveDemoPayload;
  onPickAgain: () => void;
}

export function BriefingReveal({ persona, payload, onPickAgain }: Props) {
  const { briefing } = payload;
  return (
    <main className="grain bg-dawn relative min-h-screen overflow-hidden bg-cream text-ink">
      <div className="above-grain mx-auto max-w-3xl px-6 pb-32">
        <header className="mb-12 mt-20 pb-8">
          <p className="animate-fade-down font-mono text-label uppercase tracking-[0.18em] text-district">
            Step 3 of 3 · For {persona.display_name} · D
            {persona.fingerprint.location.council_district} · {persona.fingerprint.relevance_slider}
          </p>
          <h1 className="mt-6 animate-fade-up-lg font-serif text-cover font-bold leading-tight tracking-tighter text-ink delay-200">
            {emphasizeNumerals(briefing.cover_header)}
          </h1>
          <p className="animate-fade-up mt-4 max-w-prose font-serif text-body-lg text-ink/75 delay-400">
            {briefing.surfaced.length > 0
              ? <>From <span className="font-mono text-body-sm">{briefing.considered}</span> agenda items, scored against {persona.display_name}'s fingerprint. Anything below the {briefing.threshold} threshold was suppressed; everything above appears here, ranked.</>
              : <>Nothing above {persona.display_name}'s {briefing.threshold} threshold today. The pipeline considered {briefing.considered} items.</>}
          </p>
          <div
            aria-hidden
            className="mt-12 h-[2px] w-full origin-left animate-draw-rule bg-gradient-to-r from-vermilion via-vermilion/60 to-transparent delay-700"
          />
        </header>

        <div>
          {briefing.surfaced.map((item, i) => (
            <article
              key={item.candidate_item_id}
              className="animate-fade-up border-b border-whisper py-8 last:border-b-0"
              style={{ animationDelay: `${800 + i * 100}ms` }}
            >
              <p className="text-metadata uppercase text-district">
                {item.council_district !== null ? `D${item.council_district}` : "Citywide"}
                {" · "}{payload.meeting.meeting_date}
                {" · "}<span className="text-vermilion">post={item.post_score.toFixed(3)}</span>
              </p>
              <h2 className="mt-4 font-serif text-headline font-semibold leading-[1.15] text-ink">
                {item.headline}
              </h2>
              <div className="mt-6 border-l-2 border-vermilion/60 pl-4">
                <p className="text-label uppercase tracking-[0.12em] text-district">
                  Why this matters to {persona.display_name}
                </p>
                <p className="mt-2 break-words font-mono text-body-sm text-ink">
                  {item.why_this}
                </p>
              </div>
              <p className="mt-6 max-w-prose text-body text-ink/80">
                {item.what_happened}
              </p>
              {item.matched_priorities.length > 0 ? (
                <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink/50">
                  matched: {item.matched_priorities.join(" · ")}
                </p>
              ) : null}
            </article>
          ))}
        </div>

        <p className="animate-fade-up mt-10 font-mono text-label uppercase tracking-[0.12em] text-district">
          {briefing.surfaced.length} surfaced of {briefing.verified} verified /{" "}
          {briefing.considered} considered
        </p>

        <div className="mt-12 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={onPickAgain}
            className="group inline-flex items-center gap-3 border border-ink bg-ink px-6 py-3 font-mono text-label uppercase tracking-[0.16em] text-cream transition-all duration-300 hover:-translate-y-0.5 hover:bg-vermilion-deep"
          >
            <span aria-hidden>◇</span>
            Run on someone else
            <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">↗</span>
          </button>
          {persona.source === "persisted" ? (
            <a
              href={`/demo?fp=${persona.id}`}
              className="link-draw self-center font-mono text-label uppercase tracking-[0.16em] text-ink"
              data-vermilion
            >
              Open the polished briefing →
            </a>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function emphasizeNumerals(s: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let buf = "";
  let inDigit = false;
  for (const ch of s) {
    const isDigit = /\d/.test(ch);
    if (isDigit !== inDigit) {
      if (buf) parts.push(inDigit ? <span key={parts.length} className="text-vermilion">{buf}</span> : <span key={parts.length}>{buf}</span>);
      buf = ch;
      inDigit = isDigit;
    } else buf += ch;
  }
  if (buf) parts.push(inDigit ? <span key={parts.length} className="text-vermilion">{buf}</span> : <span key={parts.length}>{buf}</span>);
  return parts;
}
