// "Why am I seeing this?" trace modal — three hairline-divided sections
// (Ingestion · Verification · Why You). Same modal idiom as
// SourceProofModal: cream panel over translucent ink, escape closes,
// ×-button top right. No tabs, no accordion. Each section has a
// "View raw record ↗" inline toggle that reveals the JSON beneath the
// humanized prose.
//
// Editorial direction: prose first, JSON one click away. The vermilion
// 3-uses ceiling holds — district-sage section labels, vermilion-only
// underline on the inline reveal links.

"use client";

import { useEffect, useState } from "react";
import type { Item } from "@revere/shared";
import type { AgentSessionRow, TracePayload } from "@/lib/queries/trace";

interface Props {
  open: boolean;
  onClose: () => void;
  headline: string;
  item: Item;
  trace: TracePayload | null;
}

export function TraceModal({ open, onClose, headline, item, trace }: Props) {
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
        className="relative w-full max-w-xl animate-modal-in bg-cream shadow-[0_30px_80px_-20px_rgba(26,26,23,0.45)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trace-title"
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
          <p className="text-label uppercase text-district">
            Why am I seeing this?
          </p>
          <h2
            id="trace-title"
            className="mt-3 font-serif text-headline-sm font-semibold leading-[1.2] text-ink"
          >
            {headline}
          </h2>
        </div>

        <div className="space-y-10 px-8 py-10">
          <IngestionSection trace={trace} item={item} />
          <VerificationSection trace={trace} />
          <WhyYouSection trace={trace} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function IngestionSection({
  trace,
  item,
}: {
  trace: TracePayload | null;
  item: Item;
}) {
  const sessions = trace?.ingestion_sessions ?? [];
  // Group sessions by runtime, preserving the chronological order.
  const byRuntime = new Map<string, AgentSessionRow[]>();
  for (const s of sessions) {
    const arr = byRuntime.get(s.runtime) ?? [];
    arr.push(s);
    byRuntime.set(s.runtime, arr);
  }

  const orchestrator = byRuntime.get("orchestrator")?.[0] ?? null;
  const verifier =
    byRuntime.get("verifier")?.[byRuntime.get("verifier")!.length - 1] ?? null;
  const matcher =
    byRuntime.get("matcher")?.[byRuntime.get("matcher")!.length - 1] ?? null;
  const composer =
    byRuntime.get("composer")?.[byRuntime.get("composer")!.length - 1] ?? null;
  const visionExtractor =
    byRuntime.get("vision-extractor")?.[byRuntime.get("vision-extractor")!.length - 1] ??
    null;

  const stages: Array<{ label: string; runtime: string; session: AgentSessionRow | null }> = [
    { label: "Classified by", runtime: "Austin orchestrator", session: orchestrator },
    { label: "Verified by", runtime: "Sonnet 4.6 verifier", session: verifier },
    { label: "Scored by", runtime: "fingerprint matcher", session: matcher },
    { label: "Composed by", runtime: "Opus 4.7 composer", session: composer },
  ];
  if (visionExtractor) {
    stages.splice(2, 0, {
      label: "Map page localized by",
      runtime: "Opus 4.7 vision extractor",
      session: visionExtractor,
    });
  }

  return (
    <section>
      <p className="text-label uppercase tracking-[0.12em] text-district">
        Ingestion
      </p>
      <p className="mt-3 max-w-prose text-body-sm text-ink">
        {trace?.meeting_date && trace.meeting_body
          ? `${trace.meeting_body} on ${formatMeetingDate(trace.meeting_date)} (item ${item.id}).`
          : `Item ${item.id}.`}
      </p>
      <ol className="mt-4 space-y-3">
        {stages.map((stage, i) =>
          stage.session ? (
            <SessionRow
              key={`${stage.label}-${i}`}
              label={stage.label}
              runtime={stage.runtime}
              session={stage.session}
            />
          ) : null,
        )}
      </ol>
    </section>
  );
}

function SessionRow({
  label,
  runtime,
  session,
}: {
  label: string;
  runtime: string;
  session: AgentSessionRow;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const startedAt = formatTime(session.started_at);
  return (
    <li className="border-l border-whisper pl-4">
      <p className="text-body-sm text-ink">
        <span className="text-district">{label}</span>{" "}
        <span className="font-semibold">{runtime}</span>{" "}
        <span className="text-ink/60">at {startedAt}</span>
      </p>
      <button
        type="button"
        onClick={() => setShowRaw((v) => !v)}
        className="mt-1 border-b border-vermilion pb-px text-body-sm text-ink hover:text-vermilion"
      >
        {showRaw ? "Hide session log ↑" : "View session log ↗"}
      </button>
      {showRaw ? (
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words border border-whisper bg-cream/60 p-3 font-mono text-xs text-ink">
          {session.notes ??
            JSON.stringify(
              {
                id: session.id,
                runtime: session.runtime,
                status: session.status,
                items_processed: session.items_processed,
                started_at: session.started_at,
                finished_at: session.finished_at,
              },
              null,
              2,
            )}
        </pre>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------

function VerificationSection({ trace }: { trace: TracePayload | null }) {
  const [showRaw, setShowRaw] = useState(false);
  const report = trace?.verification_report ?? null;
  if (!report) {
    return (
      <section className="border-t border-whisper pt-8">
        <p className="text-label uppercase tracking-[0.12em] text-district">
          Verification
        </p>
        <p className="mt-3 max-w-prose text-body-sm text-ink/70">
          No verification report on file.
        </p>
      </section>
    );
  }

  const cov = report.coverage;
  const verdict = report.overall_verdict.replace(/_/g, " ");
  const supportedClaims = report.claims.filter((c) => c.verdict === "supported");
  const sample = supportedClaims.slice(0, 3);

  return (
    <section className="border-t border-whisper pt-8">
      <p className="text-label uppercase tracking-[0.12em] text-district">
        Verification
      </p>
      <p className="mt-3 max-w-prose text-body-sm text-ink">
        Verifier checked <strong>{cov.total_claims}</strong> claims —{" "}
        <strong>{cov.supported}</strong> supported with verbatim source quotes,{" "}
        {cov.partially_supported} partially, {cov.unsupported} unsupported,{" "}
        {cov.contradicted} contradicted, {cov.unverifiable} unverifiable.
        Overall verdict: <strong>{verdict}</strong>.
      </p>
      {sample.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {sample.map((c) => (
            <li key={c.claim_id} className="border-l border-whisper pl-4">
              <p className="text-body-sm text-ink">{c.claim_text}</p>
              <p className="mt-1 font-mono text-xs text-ink/60">
                {c.claim_id} · {c.claim_type}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={() => setShowRaw((v) => !v)}
        className="mt-4 border-b border-vermilion pb-px text-body-sm text-ink hover:text-vermilion"
      >
        {showRaw ? "Hide raw report ↑" : "View raw report ↗"}
      </button>
      {showRaw ? (
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words border border-whisper bg-cream/60 p-3 font-mono text-xs text-ink">
          {JSON.stringify(report, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------

function WhyYouSection({ trace }: { trace: TracePayload | null }) {
  const [showRaw, setShowRaw] = useState(false);
  const score = trace?.score ?? null;
  if (!score) {
    return (
      <section className="border-t border-whisper pt-8">
        <p className="text-label uppercase tracking-[0.12em] text-district">
          Why you
        </p>
        <p className="mt-3 max-w-prose text-body-sm text-ink/70">
          No relevance score on file.
        </p>
      </section>
    );
  }

  const breakdown = score.breakdown;
  const overlap = score.topic_overlap_detail.filter((t) => t.contribution > 0);

  return (
    <section className="border-t border-whisper pt-8">
      <p className="text-label uppercase tracking-[0.12em] text-district">
        Why you
      </p>
      <p className="mt-3 max-w-prose font-mono text-body-sm text-ink">
        {score.why_this}
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-body-sm sm:grid-cols-3">
        <Stat label="post score" value={score.post_score.toFixed(3)} />
        <Stat label="threshold" value={score.threshold_used.toString()} />
        <Stat
          label="surfaced"
          value={score.surfaced ? "yes" : "no"}
        />
        <Stat label="geography" value={breakdown.geography_match ? "match" : "—"} />
        <Stat
          label="topic overlap"
          value={breakdown.topic_overlap.toFixed(2)}
        />
        <Stat
          label="phrase match"
          value={breakdown.priority_phrase_match ? "match" : "—"}
        />
      </dl>

      {overlap.length > 0 ? (
        <div className="mt-5">
          <p className="text-label uppercase tracking-[0.12em] text-district">
            Matched fingerprint priorities
          </p>
          <ul className="mt-2 space-y-1 text-body-sm text-ink">
            {overlap.map((o, i) => (
              <li key={`${o.fingerprint_topic}-${i}`}>
                <span className="font-semibold">{o.fingerprint_topic}</span>{" "}
                <span className="text-ink/60">
                  → {o.mapped_taxonomy ?? "—"} (weight {o.weight.toFixed(2)},
                  contribution {o.contribution.toFixed(2)})
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setShowRaw((v) => !v)}
        className="mt-4 border-b border-vermilion pb-px text-body-sm text-ink hover:text-vermilion"
      >
        {showRaw ? "Hide raw score ↑" : "View raw score ↗"}
      </button>
      {showRaw ? (
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words border border-whisper bg-cream/60 p-3 font-mono text-xs text-ink">
          {JSON.stringify(score, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-label uppercase tracking-[0.12em] text-district">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-body-sm text-ink">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------

function formatMeetingDate(iso: string): string {
  const [, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${months[(m ?? 1) - 1]} ${d}`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
