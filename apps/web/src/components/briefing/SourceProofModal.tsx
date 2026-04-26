// Source-proof modal. Mode prop is the architectural seam: T-25 ships
// "minimal" (Legistar URL + agenda PDF link + verbatim raw_passage +
// source_locator). T-26 swaps to "full" and adds the parcel-highlight map
// without changing call sites.

"use client";

import { useEffect } from "react";
import type { Item } from "@revere/shared";
import type { SourceProofClaim } from "@/lib/source-proof";

interface Props {
  open: boolean;
  onClose: () => void;
  mode: "minimal" | "full";
  item: Item;
  proof: SourceProofClaim | null;
  headline: string;
}

export function SourceProofModal({ open, onClose, mode, item, proof, headline }: Props) {
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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-12 sm:py-16"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-xl bg-cream"
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
            <section className="border-t border-whisper pt-8">
              <p className="text-label uppercase text-district">
                Parcel & district view
              </p>
              <p className="mt-3 text-body-sm text-ink/70">
                Hi-res map ships in T-26.
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
