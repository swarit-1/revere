// Source-proof modal. Mode prop is the architectural seam: T-25 ships
// "minimal" (Legistar URL + agenda PDF link + verbatim raw_passage +
// source_locator). T-26 swaps to "full" and adds the parcel-highlight map
// without changing call sites.

"use client";

import { useEffect } from "react";
import type { Item } from "@revere/shared";
import type { SourceProofClaim } from "@/lib/source-proof";
import type { ZoningExtraction } from "@/lib/queries/zoning-extraction";

interface Props {
  open: boolean;
  onClose: () => void;
  mode: "minimal" | "full";
  item: Item;
  proof: SourceProofClaim | null;
  headline: string;
  zoningExtraction?: ZoningExtraction | null;
}

export function SourceProofModal({
  open,
  onClose,
  mode,
  item,
  proof,
  headline,
  zoningExtraction,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const itemDetailUrl = item.sources.find((s) => s.type === "item_detail")?.url;
  const agendaPdfUrl = item.sources.find((s) => s.type === "agenda_pdf")?.url;
  const proofSourceUrl = proof?.evidence?.source_index !== undefined
    ? item.sources[proof.evidence.source_index]?.url ?? null
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex animate-backdrop-in items-start justify-center overflow-y-auto bg-ink/45 px-4 py-12 backdrop-blur-md sm:py-16"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-xl animate-modal-in bg-cream shadow-[0_30px_80px_-20px_rgba(26,26,23,0.45)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-proof-title"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-ink hover:text-vermilion"
        >
          ×
        </button>

        <div className="border-b border-whisper px-8 pb-6 pt-10">
          <p className="text-label uppercase text-district">Source proof</p>
          <h2
            id="source-proof-title"
            className="mt-3 font-serif text-headline-sm font-semibold leading-[1.2] text-ink"
          >
            {headline}
          </h2>
        </div>

        <div className="space-y-8 px-8 py-8">
          {proof ? (
            <section>
              <p className="text-label uppercase tracking-[0.12em] text-district">
                The verifier's strongest claim
              </p>
              <p className="mt-3 max-w-prose text-body-sm text-ink">
                {proof.claim_text}
              </p>
              {proof.evidence ? (
                <>
                  <p className="mt-6 text-label uppercase tracking-[0.12em] text-district">
                    Verbatim from source
                  </p>
                  <blockquote className="mt-3 border-l border-whisper pl-4 font-serif text-body italic text-ink">
                    “{proof.evidence.source_excerpt}”
                  </blockquote>
                  <p className="mt-3 font-mono text-body-sm text-ink/70">
                    {proof.evidence.source_locator}
                  </p>
                </>
              ) : null}
            </section>
          ) : null}

          <section className="border-t border-whisper pt-8">
            <p className="text-label uppercase tracking-[0.12em] text-district">
              Sources
            </p>
            <ul className="mt-3 space-y-2 text-body-sm">
              {itemDetailUrl ? (
                <li>
                  <a
                    href={itemDetailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-b border-whisper text-ink hover:border-ink"
                  >
                    Legistar item page ↗
                  </a>
                </li>
              ) : null}
              {agendaPdfUrl ? (
                <li>
                  <a
                    href={agendaPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-b border-whisper text-ink hover:border-ink"
                  >
                    Agenda PDF ↗
                  </a>
                </li>
              ) : null}
              {proofSourceUrl && proofSourceUrl !== itemDetailUrl && proofSourceUrl !== agendaPdfUrl ? (
                <li>
                  <a
                    href={proofSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-b border-whisper text-ink hover:border-ink"
                  >
                    Cited source ({item.sources[proof?.evidence?.source_index ?? 0]?.type}) ↗
                  </a>
                </li>
              ) : null}
            </ul>
          </section>

          {mode === "full" ? (
            <ParcelMapSection extraction={zoningExtraction ?? null} item={item} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ParcelMapSection({
  extraction,
  item,
}: {
  extraction: ZoningExtraction | null;
  item: Item;
}) {
  // No row yet — modal renders nothing extra. Common for non-zoning items.
  if (!extraction) return null;

  const sourcePdfUrl =
    item.sources[extraction.source_index]?.url ?? item.sources.find((s) => s.type === "staff_report")?.url ?? null;

  const hasOverlay =
    extraction.bbox != null &&
    extraction.page_image_url != null &&
    extraction.page_image_width != null &&
    extraction.page_image_height != null &&
    extraction.confidence !== "low";

  // Staff Report PDF deep-link to the page chosen by stage 1. Adobe-style
  // `#page=N` works in most browsers and PDF viewers.
  const deepLink =
    sourcePdfUrl && extraction.page_index
      ? `${sourcePdfUrl}#page=${extraction.page_index}`
      : sourcePdfUrl;

  return (
    <section className="border-t border-whisper pt-8">
      <p className="text-label uppercase tracking-[0.12em] text-district">
        Parcel & district view
      </p>

      {hasOverlay ? (
        <ParcelMapOverlay
          imageUrl={extraction.page_image_url!}
          width={extraction.page_image_width!}
          height={extraction.page_image_height!}
          bbox={extraction.bbox!}
        />
      ) : extraction.page_image_url ? (
        // Confidence wasn't strong enough to draw a parcel polygon — render
        // the page without an overlay so the user still sees the exhibit.
        <ParcelMapOverlay
          imageUrl={extraction.page_image_url}
          width={extraction.page_image_width ?? 1700}
          height={extraction.page_image_height ?? 2200}
          bbox={null}
        />
      ) : (
        <p className="mt-3 text-body-sm text-ink/70">
          The Staff Report does not include a standalone zoning-map exhibit.
        </p>
      )}

      <p className="mt-4 max-w-prose text-body-sm text-ink/70">
        {hasOverlay
          ? "Parcel localized by Opus 4.7 vision (page-detect → bbox-localize) on the Staff Report exhibit."
          : "Page localized by Opus 4.7 vision; parcel polygon below confidence threshold — overlay omitted."}
      </p>

      {deepLink ? (
        <p className="mt-3 text-body-sm">
          <a
            href={deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="border-b border-vermilion pb-px text-ink hover:text-vermilion"
          >
            {extraction.page_index
              ? `Open Staff Report at page ${extraction.page_index} ↗`
              : "Open Staff Report ↗"}
          </a>
        </p>
      ) : null}
    </section>
  );
}

function ParcelMapOverlay({
  imageUrl,
  width,
  height,
  bbox,
}: {
  imageUrl: string;
  width: number;
  height: number;
  bbox: { x: number; y: number; w: number; h: number } | null;
}) {
  return (
    <div className="relative mt-4 w-full overflow-hidden border border-whisper bg-cream">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full"
      >
        <image href={imageUrl} x={0} y={0} width={width} height={height} />
        {bbox ? (
          <rect
            x={bbox.x}
            y={bbox.y}
            width={bbox.w}
            height={bbox.h}
            // Vermilion stroke + 25% fill — the third (and most striking)
            // vermilion use on the page per the locked ceiling.
            fill="rgba(200, 51, 31, 0.25)"
            stroke="rgb(200, 51, 31)"
            strokeWidth={Math.max(2, Math.round(width / 400))}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
    </div>
  );
}
