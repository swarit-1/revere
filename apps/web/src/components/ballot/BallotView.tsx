// Ballot wrapper — cover header + representation ladder + race list +
// editorial closer. The shared "main" wrapper at apps/web/app/ballot/
// or /demo/ballot/ handles auth/admin routing; this component is
// presentational.

import type { Fingerprint } from "@revere/shared";
import { buildRepresentationLadder } from "@revere/shared";
import type { BallotRace } from "@/lib/queries/ballot";
import { RaceCard } from "./RaceCard";
import { RepresentationLadder } from "./RepresentationLadder";

interface Props {
  fingerprint: Fingerprint;
  briefingDate: string;
  ballot: BallotRace[];
}

function formatBriefingDate(iso: string): string {
  const [, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[(m ?? 1) - 1]} ${d}`;
}

export function BallotView({ fingerprint, briefingDate, ballot }: Props) {
  const ladder = buildRepresentationLadder(fingerprint);
  const surfaced = ballot.filter((b) => b.relevance?.surfaced);
  const dateLabel = formatBriefingDate(briefingDate);

  return (
    <main className="mx-auto max-w-4xl px-6 pb-32">
      <header className="mb-12 mt-24 pb-8">
        <p className="animate-fade-down text-label uppercase tracking-[0.16em] text-district">
          Your ballot · {dateLabel}
        </p>
        <h1 className="mt-6 animate-fade-up-lg font-serif text-cover font-bold tracking-tighter text-ink delay-200">
          {surfaced.length} race{surfaced.length === 1 ? "" : "s"} on{" "}
          <span className="text-vermilion">your</span> ballot
        </h1>
        <p className="animate-fade-up mt-4 max-w-prose font-serif text-body-lg text-ink/70 delay-400">
          Same elections, different lives. Promises here are scored against{" "}
          <span className="font-mono text-body-sm">@{fingerprint.user_id}</span>'s
          fingerprint — what each candidate said, sourced; and whether the
          office can actually deliver it.
        </p>
        <div
          aria-hidden
          className="mt-12 h-[2px] w-full origin-left animate-draw-rule bg-gradient-to-r from-vermilion via-vermilion/60 to-transparent delay-700"
        />
      </header>

      <RepresentationLadder ladder={ladder} />

      <section className="mt-12">
        {surfaced.length === 0 ? (
          <p className="font-serif text-body-lg text-ink/70">
            No races on your ballot right now. We'll surface them when
            their election dates approach.
          </p>
        ) : (
          surfaced.map((race, i) => (
            <RaceCard key={race.race.id} race={race} index={i} />
          ))
        )}
      </section>

      <footer className="mt-16 border-t border-whisper pt-8">
        <p className="text-label uppercase tracking-[0.16em] text-district">
          What Revere does · what it doesn't
        </p>
        <ul className="mt-4 max-w-prose space-y-2 font-serif text-body-sm text-ink/80">
          <li>
            <strong className="text-ink">Does:</strong> match races to your
            fingerprint, source-verify each promise, classify whether the
            office can actually deliver it.
          </li>
          <li>
            <strong className="text-ink">Doesn't:</strong> pick a candidate,
            score ideology, predict who will win, or aggregate endorsements.
            That's still your call.
          </li>
        </ul>
      </footer>
    </main>
  );
}
