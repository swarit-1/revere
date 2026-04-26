// One briefing item, hairline-divided, no card chrome.
// Visual anatomy locked in docs/plans/session-6-briefing-ui.md.
// The why_this is rendered verbatim in JetBrains Mono — that's the trust
// receipt, not editorial paraphrase.

import type { BriefingPayloadItem } from "@/lib/queries/briefing";

interface Props {
  item: BriefingPayloadItem;
  meetingDate: string;
  councilDistrict: number | null;
  itemType: string;
  onSourceClick: (itemId: string) => void;
  onTraceClick: (itemId: string) => void;
  onDraftClick: (itemId: string) => void;
  hasDrafts: boolean;
  itemContext?: string | null; // e.g. "Imminent vote" if action_window_boost was 1
}

function formatMeetingDate(iso: string): string {
  // YYYY-MM-DD → "Apr 9"
  const [, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[(m ?? 1) - 1]} ${d}`;
}

export function BriefingItem({
  item,
  meetingDate,
  councilDistrict,
  itemType,
  onSourceClick,
  onTraceClick,
  onDraftClick,
  hasDrafts,
  itemContext,
}: Props) {
  const districtLabel = councilDistrict
    ? `D${councilDistrict}`
    : "Citywide";
  const typeLabel = itemType[0]?.toUpperCase() + itemType.slice(1);

  return (
    <article className="border-b border-whisper py-8 last:border-b-0">
      <p className="text-metadata uppercase text-district">
        {districtLabel} · {formatMeetingDate(meetingDate)} · {typeLabel}
        {itemContext ? <> · {itemContext}</> : null}
      </p>

      <h2 className="mt-4 font-serif text-headline font-semibold leading-[1.15] text-ink">
        {item.headline}
      </h2>

      <div className="mt-6">
        <p className="text-label uppercase tracking-[0.12em] text-district">
          Why this matters to you
        </p>
        <p className="mt-2 break-words font-mono text-body-sm text-ink">
          {item.why_this}
        </p>
      </div>

      <p className="mt-6 max-w-prose text-body text-ink/80">
        {item.what_happened}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-body-sm">
        <button
          type="button"
          onClick={() => onSourceClick(item.item_id)}
          className="border-b border-vermilion pb-px text-ink hover:text-vermilion"
        >
          See source ↗
        </button>
        <button
          type="button"
          onClick={() => onTraceClick(item.item_id)}
          className="border-b border-vermilion pb-px text-ink hover:text-vermilion"
        >
          Why am I seeing this? ↗
        </button>
        {hasDrafts ? (
          <button
            type="button"
            onClick={() => onDraftClick(item.item_id)}
            className="border-b border-vermilion pb-px text-ink hover:text-vermilion"
          >
            Draft a reply ↗
          </button>
        ) : null}
        <span className="flex items-center gap-2 text-district">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-district" />
          High confidence
        </span>
      </div>
    </article>
  );
}
