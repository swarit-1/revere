// Conversational onboarding UI. Per PRD §8.3 — multi-turn dialogue
// that builds the Fingerprint. Editorial styling: typewritten
// correspondence, not a chat-bubble app. REVERE / YOU labels in
// district-sage, hairlines between turns, mono input strip below.
//
// State machine:
//   idle      → user landed, no turns yet
//   loading   → POST /api/onboarding/turn in flight
//   chatting  → assistant returned a "say" turn; awaiting user input
//   review    → assistant called emit_fingerprint; user reviews summary
//   finalizing → POST /api/onboarding/finalize in flight
//   complete  → redirected to /briefing
//   error     → blocking error; user can retry the last action

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Fingerprint } from "@revere/shared";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

type State =
  | { kind: "idle" }
  | { kind: "loading"; reason: "turn" | "finalize" }
  | { kind: "chatting" }
  | { kind: "review"; summary: string; fingerprint: Fingerprint }
  | { kind: "complete"; userId: string }
  | { kind: "error"; message: string; recover: "turn" | "finalize" };

interface TurnResponse {
  kind?: "say" | "done";
  text?: string;
  summary?: string;
  fingerprint?: Fingerprint;
  turn?: number;
  max_turns?: number;
  error?: string;
}

const REASSURE_LATENCY_MS = 1100;

export function OnboardingConversation() {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [draft, setDraft] = useState("");
  const [latencyHint, setLatencyHint] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll the transcript to the latest turn.
  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, state]);

  // Kick the conversation by asking the API for the first assistant turn.
  useEffect(() => {
    if (turns.length === 0 && state.kind === "idle") {
      void doTurn([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doTurn(messages: Turn[]) {
    setState({ kind: "loading", reason: "turn" });
    setLatencyHint(false);
    const hintTimer = setTimeout(() => setLatencyHint(true), REASSURE_LATENCY_MS);
    try {
      const res = await fetch("/api/onboarding/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      const body = (await res.json()) as TurnResponse;
      clearTimeout(hintTimer);
      setLatencyHint(false);
      if (!res.ok) {
        setState({
          kind: "error",
          message: body.error ?? `request failed (${res.status})`,
          recover: "turn",
        });
        return;
      }
      if (body.kind === "done" && body.summary && body.fingerprint) {
        if (body.text) {
          setTurns((t) => [...t, { role: "assistant", content: body.text! }]);
        }
        setState({
          kind: "review",
          summary: body.summary,
          fingerprint: body.fingerprint,
        });
        return;
      }
      if (body.kind === "say" && body.text) {
        setTurns((t) => [...t, { role: "assistant", content: body.text! }]);
        setState({ kind: "chatting" });
        // Defer-focus so the new textarea is ready.
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }
      setState({
        kind: "error",
        message: body.error ?? "unexpected response",
        recover: "turn",
      });
    } catch (err) {
      clearTimeout(hintTimer);
      setLatencyHint(false);
      setState({
        kind: "error",
        message: (err as Error).message,
        recover: "turn",
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind !== "chatting") return;
    const text = draft.trim();
    if (!text) return;
    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setDraft("");
    await doTurn(next);
  }

  async function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = (e.target as HTMLTextAreaElement).form;
      if (form) form.requestSubmit();
    }
  }

  async function handleConfirm() {
    if (state.kind !== "review") return;
    setState({ kind: "loading", reason: "finalize" });
    setLatencyHint(false);
    try {
      const res = await fetch("/api/onboarding/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: state.fingerprint }),
      });
      const body = (await res.json()) as { ok?: boolean; user_id?: string; error?: string };
      if (!res.ok) {
        setState({
          kind: "error",
          message: body.error ?? `finalize failed (${res.status})`,
          recover: "finalize",
        });
        return;
      }
      const userId = body.user_id ?? "self";
      setState({ kind: "complete", userId });
      // Server-side metadata refresh has happened; let Next re-render
      // /briefing with the new JWT.
      setTimeout(() => router.push("/briefing"), 800);
    } catch (err) {
      setState({
        kind: "error",
        message: (err as Error).message,
        recover: "finalize",
      });
    }
  }

  async function handleReject() {
    if (state.kind !== "review") return;
    // Keep the assistant's last turn (the prose summary) and let the
    // user push back. They type a correction; Claude updates and
    // re-emits.
    setState({ kind: "chatting" });
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-2xl flex-col px-6 py-12 sm:py-16">
      <Header turn={turns.filter((t) => t.role === "user").length} />

      <div
        ref={transcriptRef}
        className="my-10 flex-1 space-y-10 overflow-y-auto"
      >
        {turns.map((t, i) => (
          <Turn key={i} turn={t} delayMs={i === turns.length - 1 ? 100 : 0} />
        ))}

        {state.kind === "loading" && state.reason === "turn" ? (
          <ThinkingIndicator showHint={latencyHint} />
        ) : null}
      </div>

      {state.kind === "review" ? (
        <ReviewPane
          summary={state.summary}
          fingerprint={state.fingerprint}
          onConfirm={handleConfirm}
          onReject={handleReject}
        />
      ) : null}

      {state.kind === "loading" && state.reason === "finalize" ? (
        <FinalizingIndicator />
      ) : null}

      {state.kind === "complete" ? (
        <CompletePane userId={state.userId} />
      ) : null}

      {state.kind === "error" ? (
        <ErrorPane
          message={state.message}
          onRetry={() =>
            state.recover === "turn" ? doTurn(turns) : void handleConfirm()
          }
        />
      ) : null}

      {state.kind === "chatting" ? (
        <form
          onSubmit={handleSubmit}
          className="sticky bottom-0 border-t border-whisper bg-cream/95 pt-6 backdrop-blur-sm"
        >
          <div className="flex items-end gap-4">
            <span
              aria-hidden
              className="font-mono text-label uppercase tracking-[0.16em] text-vermilion"
            >
              You ›
            </span>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="type your answer — enter to send, shift+enter for a new line"
              autoFocus
              className="min-h-[40px] flex-1 resize-none border-0 bg-transparent font-mono text-body-sm text-ink placeholder:text-ink/30 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="border border-ink px-4 py-2 font-mono text-label uppercase tracking-[0.12em] text-ink transition-colors hover:bg-ink hover:text-cream disabled:opacity-30"
            >
              Send
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function Header({ turn }: { turn: number }) {
  const target = 12;
  const display = Math.max(1, Math.min(turn, target));
  return (
    <header className="border-b border-whisper pb-6">
      <p className="animate-fade-down text-label uppercase tracking-[0.2em] text-district">
        Onboarding · turn{" "}
        <span className="text-vermilion">
          {display.toString().padStart(2, "0")}
        </span>
        <span className="text-district/50"> / {target}</span>
      </p>
      <h1 className="mt-3 animate-fade-up font-serif text-headline-sm font-semibold text-ink delay-100">
        Building your civic fingerprint
      </h1>
      <p className="animate-fade-up mt-2 max-w-prose text-body-sm text-ink/70 delay-200">
        A short conversation. Revere asks; you answer. Nothing more
        precise than your council district is captured. You can leave
        anytime — your answers persist.
      </p>
    </header>
  );
}

function Turn({ turn, delayMs }: { turn: Turn; delayMs: number }) {
  const isUser = turn.role === "user";
  return (
    <article
      className={`animate-fade-up grid grid-cols-[80px_1fr] gap-x-6 sm:grid-cols-[110px_1fr]`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <p
        className={`pt-1 font-mono text-label uppercase tracking-[0.16em] ${isUser ? "text-vermilion" : "text-district"}`}
      >
        {isUser ? "You" : "Revere"}
      </p>
      <div
        className={`max-w-prose ${isUser ? "font-mono text-body-sm text-ink" : "font-serif text-body-lg leading-relaxed text-ink"}`}
      >
        {turn.content.split("\n\n").map((para, i) => (
          <p key={i} className={i > 0 ? "mt-4" : ""}>
            {para}
          </p>
        ))}
      </div>
    </article>
  );
}

function ThinkingIndicator({ showHint }: { showHint: boolean }) {
  return (
    <article
      className="animate-fade-up grid grid-cols-[80px_1fr] gap-x-6 sm:grid-cols-[110px_1fr]"
    >
      <p className="pt-1 font-mono text-label uppercase tracking-[0.16em] text-district">
        Revere
      </p>
      <div className="flex items-center gap-3 font-mono text-body-sm text-ink/50">
        <span className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-blink-cursor rounded-full bg-vermilion" />
          <span
            className="h-1.5 w-1.5 animate-blink-cursor rounded-full bg-vermilion"
            style={{ animationDelay: "200ms" }}
          />
          <span
            className="h-1.5 w-1.5 animate-blink-cursor rounded-full bg-vermilion"
            style={{ animationDelay: "400ms" }}
          />
        </span>
        <span>{showHint ? "thinking through your answer…" : "thinking…"}</span>
      </div>
    </article>
  );
}

function ReviewPane({
  summary,
  fingerprint,
  onConfirm,
  onReject,
}: {
  summary: string;
  fingerprint: Fingerprint;
  onConfirm: () => void;
  onReject: () => void;
}) {
  return (
    <section className="animate-fade-up sticky bottom-0 border-t-2 border-vermilion/30 bg-cream pt-8">
      <p className="text-label uppercase tracking-[0.16em] text-vermilion">
        Confirm your fingerprint
      </p>
      <p className="mt-3 max-w-prose font-serif text-body-lg italic leading-relaxed text-ink">
        “{summary}”
      </p>
      <details className="mt-4">
        <summary className="cursor-pointer text-label uppercase tracking-[0.12em] text-district hover:text-ink">
          See the structured record ↗
        </summary>
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words border border-whisper bg-cream p-3 font-mono text-xs text-ink/80">
          {JSON.stringify(fingerprint, null, 2)}
        </pre>
      </details>
      <div className="mt-6 flex flex-wrap gap-4 pb-4">
        <button
          type="button"
          onClick={onConfirm}
          className="group inline-flex items-center gap-2 border border-ink bg-ink px-5 py-3 font-mono text-label uppercase tracking-[0.12em] text-cream transition-transform duration-200 hover:-translate-y-0.5 hover:bg-vermilion-deep"
        >
          Looks right — start my briefing
          <span aria-hidden className="transition-transform group-hover:translate-x-1">
            ↗
          </span>
        </button>
        <button
          type="button"
          onClick={onReject}
          className="link-draw font-mono text-label uppercase tracking-[0.12em] text-ink"
        >
          Something's off — keep going
        </button>
      </div>
    </section>
  );
}

function FinalizingIndicator() {
  return (
    <section className="animate-fade-up border-t-2 border-vermilion/30 bg-cream pt-8 pb-4">
      <p className="font-mono text-label uppercase tracking-[0.16em] text-district">
        <span className="text-vermilion">●</span> persisting your fingerprint…
      </p>
    </section>
  );
}

function CompletePane({ userId }: { userId: string }) {
  return (
    <section className="animate-fade-up border-t-2 border-vermilion/30 bg-cream pt-8 pb-4">
      <p className="text-label uppercase tracking-[0.16em] text-vermilion">
        ● Fingerprint locked in as @{userId}
      </p>
      <p className="mt-2 font-serif text-body-lg italic text-ink/80">
        Taking you to your briefing…
      </p>
    </section>
  );
}

function ErrorPane({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="animate-fade-up border-t border-vermilion bg-cream pt-6 pb-4">
      <p className="font-mono text-label uppercase tracking-[0.16em] text-vermilion">
        Something broke
      </p>
      <p className="mt-2 max-w-prose font-mono text-body-sm text-ink">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 border border-ink px-4 py-2 font-mono text-label uppercase tracking-[0.12em] text-ink hover:bg-ink hover:text-cream"
      >
        Try again
      </button>
    </section>
  );
}
