// Intentional empty state. Copy locked in docs/plans/session-6-briefing-ui.md
// — emptiness is a design moment, not a rendering bug. Subliminally
// communicates that the system was watching, weighed everything, and
// surfaced nothing on purpose.

interface Props {
  meetingDate: string | null;
}

function formatMeetingDate(iso: string): string {
  const [, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${months[(m ?? 1) - 1]} ${d}`;
}

export function EmptyState({ meetingDate }: Props) {
  const datePhrase = meetingDate
    ? `the ${formatMeetingDate(meetingDate)} meeting`
    : "yesterday's meeting";
  return (
    <main className="mx-auto max-w-2xl px-6 pb-24">
      <header className="mb-16 mt-24 border-b border-whisper pb-12">
        <p className="text-label uppercase text-district">
          The morning briefing
        </p>
        <h1 className="mt-6 font-serif text-headline-lg font-semibold tracking-tighter text-ink">
          Nothing for you today.
        </h1>
      </header>
      <p className="max-w-prose text-body text-ink/80">
        No new items in your fingerprint range today. The system watched{" "}
        {datePhrase} and surfaced nothing for your priorities.
      </p>
      <div className="mt-12 flex items-center gap-6">
        <a
          href="/trace"
          className="border-b border-whisper pb-px text-body-sm text-ink hover:border-ink"
        >
          See what was filtered ↗
        </a>
      </div>
    </main>
  );
}
