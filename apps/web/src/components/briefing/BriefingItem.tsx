// One briefing item, hairline-divided, no card chrome.
// Visual anatomy locked in docs/plans/session-6-briefing-ui.md.
// The why_this is rendered verbatim in JetBrains Mono — that's the trust
// receipt, not editorial paraphrase.
//
// Session 9 motion pass: each item fades up with a stagger driven by
// `index`.
//
// Session 10 multi-jurisdiction pass: geographyLabel + bodyLabel +
// confidence come in as props (derived by the page), not hardcoded
// "D3" / "Citywide" / "High confidence". Same component renders city,
// school, state, federal, and election items uniformly.

import type { BriefingPayloadItem } from "@/lib/queries/briefing";
import type { ConfidenceTier } from "@revere/shared";
import { CONFIDENCE_LABELS } from "@revere/shared";

interface Props {
  item: BriefingPayloadItem;
  meetingDate: string;
  geographyLabel: string;
  itemType: string;
  bodyLabel?: string | null;
  onSourceClick: (itemId: string) => void;
  onTraceClick: (itemId: string) => void;
  onDraftClick: (itemId: string) => void;
  hasDrafts: boolean;
  itemContext?: string | null; // e.g. "Imminent vote" if action_window_boost was 1
  confidence?: ConfidenceTier;
  index?: number; // for stagger
}

function formatMeetingDate(iso: string): string {
  // YYYY-MM-DD → "Apr 9"
  const [, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[(m ?? 1) - 1]} ${d}`;
}

const CONFIDENCE_DOT: Record<ConfidenceTier, string> = {
  high: "bg-district",
  medium: "bg-district/60",
  low: "bg-vermilion/60",
  unknown: "bg-district/30",
};

export function BriefingItem({
  item,
  meetingDate,
  geographyLabel,
  itemType,
  bodyLabel,
  onSourceClick,
  onTraceClick,
  onDraftClick,
  hasDrafts,
  itemContext,
  confidence = "high",
  index = 0,
}: Props) {
  const typeLabel = itemType[0]?.toUpperCase() + itemType.slice(1);

  // 800ms initial offset (cover header + rule finish around there) +
  // 100ms per item. Caps at 1700ms for #9 so late items aren't laggy.
  const delayMs = Math.min(800 + index * 100, 1700);

  return (
    <article
      className="group animate-fade-up border-b border-whisper py-8 last:border-b-0"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <p className="text-metadata uppercase text-district">
        {bodyLabel ? <>{bodyLabel} · </> : null}
        {geographyLabel} · {formatMeetingDate(meetingDate)} · {typeLabel}
        {itemContext ? (
          <>
            {" · "}
            <span className="text-vermilion">{itemContext}</span>
          </>
        ) : null}
      </p>

      <h2 className="mt-4 font-serif text-headline font-semibold leading-[1.15] text-ink transition-colors duration-300 group-hover:text-ink/90">
        {item.headline}
      </h2>

      <div className="mt-6 border-l-2 border-district/30 pl-4 transition-colors duration-300 group-hover:border-vermilion">
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
          className="link-draw text-ink transition-colors duration-200 hover:text-vermilion"
          data-vermilion
        >
          See source ↗
        </button>
        <button
          type="button"
          onClick={() => onTraceClick(item.item_id)}
          className="link-draw text-ink transition-colors duration-200 hover:text-vermilion"
          data-vermilion
        >
          Why am I seeing this? ↗
        </button>
        {hasDrafts ? (
          <button
            type="button"
            onClick={() => onDraftClick(item.item_id)}
            className="link-draw text-ink transition-colors duration-200 hover:text-vermilion"
            data-vermilion
          >
            Draft a reply ↗
          </button>
        ) : null}
        <span className="flex items-center gap-2 text-district">
          <span
            aria-hidden
            className={`inline-block h-1.5 w-1.5 rounded-full ${CONFIDENCE_DOT[confidence]}`}
          />
          {CONFIDENCE_LABELS[confidence]}
        </span>
      </div>
    </article>
  );
}
