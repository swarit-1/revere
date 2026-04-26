// One promise row inside a candidate column. Shows: topic strap,
// promise text in serif body, authority badge, source-proof link.
//
// The "what they said" panel is rendered inline (not a modal) because
// the comparison surface already has hidden depth — promises stack;
// modals would lose the side-by-side parallel.

"use client";

import { useState } from "react";
import type { ElectionPromise, PromiseRelevance } from "@revere/shared";
import { AuthorityBadge } from "./AuthorityBadge";

interface Props {
  promise: ElectionPromise;
  relevance: PromiseRelevance | null;
  index: number;
}

export function PromiseRow({ promise, relevance, index }: Props) {
  const [showSource, setShowSource] = useState(false);
  const isRelevant = (relevance?.post_score ?? 0) > 0;

  return (
    <article
      className="animate-fade-up border-t border-whisper py-5 first:border-t-0"
      style={{ animationDelay: `${100 + index * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-label uppercase tracking-[0.12em] text-district">
          {promise.topic.replace(/_/g, " ")}
        </p>
        <AuthorityBadge authority={promise.authority} />
      </div>

      <p
        className={`mt-3 font-serif text-body leading-relaxed ${
          isRelevant ? "text-ink" : "text-ink/60"
        }`}
      >
        {promise.text}
      </p>

      {isRelevant && relevance ? (
        <p className="mt-3 break-words font-mono text-[11px] leading-snug text-ink">
          <span className="text-vermilion">why this matters →</span>{" "}
          {relevance.why_this}
        </p>
      ) : (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink/40">
          not aligned with your fingerprint
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm">
        <button
          type="button"
          onClick={() => setShowSource((v) => !v)}
          className="link-draw text-ink hover:text-vermilion"
          data-vermilion
        >
          {showSource ? "Hide source ↑" : "See where they said it ↗"}
        </button>
      </div>

      {showSource ? (
        <div className="animate-fade-up mt-3 border-l-2 border-vermilion/40 pl-4">
          <p className="text-label uppercase tracking-[0.12em] text-district">
            Source · {promise.source.type.replace(/_/g, " ")}
          </p>
          <blockquote className="mt-2 max-w-prose font-serif text-body italic text-ink">
            &ldquo;{promise.source.excerpt}&rdquo;
          </blockquote>
          <a
            href={promise.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block link-draw font-mono text-body-sm text-ink"
            data-vermilion
          >
            {promise.source.url} ↗
          </a>
          <p className="mt-3 text-label uppercase tracking-[0.12em] text-district">
            What this office can actually do
          </p>
          <p className="mt-2 max-w-prose font-mono text-body-sm text-ink">
            {promise.authority_rationale}
          </p>
        </div>
      ) : null}
    </article>
  );
}
