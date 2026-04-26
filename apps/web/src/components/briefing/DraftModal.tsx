// "Draft a reply" — three-up variant modal. Per PRD §10 + Session 8
// plan. Shares modal idiom with SourceProofModal + TraceModal: cream
// panel over translucent ink, escape closes, ×-button top right.
//
// Layout:
//  - Desktop ≥ 768px: three columns, hairline-divided.
//  - Mobile < 768px: stacked, voice label as section header.
//
// Each variant exposes:
//  - voice tag (district sage uppercase)
//  - draft text (serif body)
//  - mailto button with prefilled subject + body
//  - copy-to-clipboard button (variant body only)
//  - "What the critics caught ↗" toggle revealing the critique_trail

"use client";

import { useEffect, useMemo, useState } from "react";
import type { CritiqueEntry } from "@revere/shared";
import type { DraftRow } from "@/lib/queries/drafts";

interface Props {
  open: boolean;
  onClose: () => void;
  headline: string;
  itemFileId: string; // e.g. "26-1501"
  councilDistrict: number | null;
  drafts: DraftRow[];
}

const COUNCIL_INBOX = "council@austintexas.gov";

export function DraftModal({
  open,
  onClose,
  headline,
  itemFileId,
  councilDistrict,
  drafts,
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

  return (
    <div
      className="fixed inset-0 z-50 flex animate-backdrop-in items-start justify-center overflow-y-auto bg-ink/45 px-4 py-12 backdrop-blur-md sm:py-16"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-5xl animate-modal-in bg-cream shadow-[0_30px_80px_-20px_rgba(26,26,23,0.45)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-title"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 text-ink hover:text-vermilion"
        >
          ×
        </button>

        <div className="border-b border-whisper px-8 pb-6 pt-10">
          <p className="text-label uppercase text-district">Draft a reply</p>
          <h2
            id="draft-title"
            className="mt-3 font-serif text-headline-sm font-semibold leading-[1.2] text-ink"
          >
            {headline}
          </h2>
          <p className="mt-2 text-body-sm text-ink/70">
            Three variants. Direct, Measured, Persuasive. Each survived a
            council staffer, an opposing constituent, and a press shop. Pick
            one, edit, send. Revere never autosubmits.
          </p>
        </div>

        {drafts.length === 0 ? (
          <div className="px-8 py-12 text-body-sm text-ink/70">
            No drafts on file for this item yet. Run{" "}
            <code className="font-mono">extract:draft --candidate ... --user ...</code>{" "}
            from the orchestrator to generate them.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3">
            {drafts.map((d, i) => (
              <DraftColumn
                key={d.id}
                draft={d}
                index={i}
                itemFileId={itemFileId}
                councilDistrict={councilDistrict}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DraftColumn({
  draft,
  index,
  itemFileId,
  councilDistrict,
}: {
  draft: DraftRow;
  index: number;
  itemFileId: string;
  councilDistrict: number | null;
}) {
  const [showCritique, setShowCritique] = useState(false);
  const [copied, setCopied] = useState(false);

  const subject = useMemo(() => {
    const dist = councilDistrict ? `District ${councilDistrict}` : "Resident";
    return `${dist} comment — Item ${itemFileId}`;
  }, [councilDistrict, itemFileId]);

  const mailto = useMemo(() => {
    const params = new URLSearchParams({
      subject,
      body: draft.final_text,
    });
    return `mailto:${COUNCIL_INBOX}?${params.toString()}`;
  }, [subject, draft.final_text]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft.final_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard denied — surface nothing */
    }
  };

  const wordCount = draft.final_text.split(/\s+/).filter(Boolean).length;

  return (
    <div
      className="animate-fade-up border-b border-whisper px-8 py-8 last:border-b-0 md:border-b-0 md:[&:not(:last-child)]:border-r"
      style={{ animationDelay: `${200 + index * 120}ms` }}
    >
      <p className="text-label uppercase tracking-[0.12em] text-district">
        {draft.voice} · {wordCount} words
      </p>
      <h3 className="mt-2 font-serif text-headline-sm font-semibold capitalize text-ink">
        {draft.voice}
      </h3>

      <div className="mt-5 max-h-[28rem] overflow-y-auto pr-1">
        <p className="whitespace-pre-wrap font-serif text-body leading-relaxed text-ink">
          {draft.final_text}
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-2 text-body-sm">
        <a
          href={mailto}
          className="inline-block w-fit border-b border-vermilion pb-px text-ink hover:text-vermilion"
        >
          Open in mail ↗
        </a>
        <button
          type="button"
          onClick={onCopy}
          className="w-fit border-b border-whisper pb-px text-left text-ink hover:border-ink"
        >
          {copied ? "Copied to clipboard ✓" : "Copy text"}
        </button>
      </div>

      <div className="mt-6 border-t border-whisper pt-5">
        <button
          type="button"
          onClick={() => setShowCritique((v) => !v)}
          className="border-b border-vermilion pb-px text-body-sm text-ink hover:text-vermilion"
        >
          {showCritique ? "Hide critic notes ↑" : "What the critics caught ↗"}
        </button>
        {showCritique ? (
          <ul className="mt-4 space-y-4">
            {draft.critique_trail.map((entry, i) => (
              <CritiqueEntryRow key={`${entry.critic}-${i}`} entry={entry} />
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function CritiqueEntryRow({ entry }: { entry: CritiqueEntry }) {
  const label = formatCritic(entry.critic);
  return (
    <li className="border-l border-whisper pl-4">
      <p className="text-label uppercase tracking-[0.12em] text-district">
        {label} · {entry.remediation.replace(/_/g, " ")}
      </p>
      <ul className="mt-2 space-y-1 text-body-sm text-ink">
        {entry.issues.map((iss, j) => (
          <li key={j}>
            <span className="font-mono text-xs text-ink/60">
              [{iss.severity}]
            </span>{" "}
            {iss.description}
          </li>
        ))}
      </ul>
      <p className="mt-2 font-mono text-xs text-ink/70">{entry.response}</p>
    </li>
  );
}

function formatCritic(c: CritiqueEntry["critic"]): string {
  switch (c) {
    case "council_staffer":
      return "Council staffer";
    case "opposing_constituent":
      return "Opposing constituent";
    case "press_shop":
      return "Press shop";
  }
}
