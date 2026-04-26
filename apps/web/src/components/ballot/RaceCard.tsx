// One race in the ballot list. Editorial direction:
//  - office line + district label as kicker
//  - office title in serif headline
//  - election date + voting windows as a metadata strap
//  - two candidate columns side-by-side at md+, stacked at sm
//  - each column shows top promises (sorted by per-user relevance)
//
// Hairlines, no cards. The whole race is one article block.

import type { BallotRace } from "@/lib/queries/ballot";
import { PromiseRow } from "./PromiseRow";

interface Props {
  race: BallotRace;
  index: number;
}

const MAX_PROMISES_PER_COLUMN = 5;

export function RaceCard({ race: r, index }: Props) {
  const { race, columns, relevance } = r;
  const electionDateLabel = formatBallotDate(race.election_date);
  const earlyVoting = race.early_voting_window
    ? `${formatBallotDate(race.early_voting_window.start)} – ${formatBallotDate(race.early_voting_window.end)}`
    : null;

  // 600ms initial offset (header settles around there) + 200ms per race.
  const delayMs = Math.min(600 + index * 200, 1800);

  return (
    <article
      className="animate-fade-up border-t border-whisper py-12 first:border-t-0"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <p className="text-label uppercase tracking-[0.16em] text-district">
        {race.body} · {race.district_label}
      </p>
      <h2 className="mt-3 font-serif text-headline-lg font-semibold leading-[1.1] text-ink">
        {race.office_title}
      </h2>

      <dl className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-2 text-label uppercase tracking-[0.12em]">
        <span className="text-district">
          Election · <span className="text-vermilion">{electionDateLabel}</span>
        </span>
        {earlyVoting ? (
          <span className="text-district">Early voting · {earlyVoting}</span>
        ) : null}
        {race.registration_deadline ? (
          <span className="text-district">
            Register by {formatBallotDate(race.registration_deadline)}
          </span>
        ) : null}
      </dl>

      {relevance?.why_this ? (
        <p className="mt-4 max-w-prose break-words font-mono text-[11px] text-ink/70">
          <span className="text-vermilion">why this race →</span>{" "}
          {relevance.why_this}
        </p>
      ) : null}

      <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-2">
        {columns.map((col, ci) => (
          <section
            key={col.candidate.id}
            className="animate-fade-up"
            style={{ animationDelay: `${delayMs + 250 + ci * 150}ms` }}
          >
            <header className="border-b border-whisper pb-4">
              <p className="text-label uppercase tracking-[0.12em] text-district">
                Candidate
              </p>
              <h3 className="mt-2 font-serif text-headline-sm font-semibold text-ink">
                {col.candidate.display_name}
              </h3>
              {col.candidate.notes ? (
                <p className="mt-2 max-w-prose text-body-sm text-ink/60">
                  {col.candidate.notes}
                </p>
              ) : null}
              {col.candidate.campaign_url ? (
                <a
                  href={col.candidate.campaign_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-draw mt-2 inline-block font-mono text-body-sm text-ink"
                  data-vermilion
                >
                  Campaign site ↗
                </a>
              ) : null}
            </header>

            <div className="mt-2">
              {col.promises.slice(0, MAX_PROMISES_PER_COLUMN).map((p, pi) => (
                <PromiseRow
                  key={p.promise.id}
                  promise={p.promise}
                  relevance={p.relevance}
                  index={pi}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

function formatBallotDate(iso: string): string {
  const [, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[(m ?? 1) - 1]} ${d}`;
}
