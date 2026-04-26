// Three-phase live demo orchestrator. Holds state for which phase
// we're in, fetches the live payload from /api/demo/live when a
// persona is picked, then unfolds: PersonaPicker → PipelineRunner
// → BriefingReveal.

"use client";

import { useState } from "react";
import type { Persona } from "@/lib/demo/personalities";
import type { LiveDemoPayload } from "@/lib/demo/types";
import { PersonaPicker } from "./PersonaPicker";
import { PipelineRunner } from "./PipelineRunner";
import { BriefingReveal } from "./BriefingReveal";

type Phase =
  | { kind: "pick" }
  | { kind: "loading"; persona: Persona }
  | { kind: "running"; persona: Persona; payload: LiveDemoPayload }
  | { kind: "reveal"; persona: Persona; payload: LiveDemoPayload }
  | { kind: "error"; message: string };

export function LiveDemoView() {
  const [phase, setPhase] = useState<Phase>({ kind: "pick" });

  async function handlePick(persona: Persona) {
    setPhase({ kind: "loading", persona });
    try {
      const res = await fetch("/api/demo/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona_id: persona.id }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setPhase({ kind: "error", message: body.error ?? `HTTP ${res.status}` });
        return;
      }
      const payload = (await res.json()) as LiveDemoPayload;
      setPhase({ kind: "running", persona, payload });
    } catch (err) {
      setPhase({ kind: "error", message: (err as Error).message });
    }
  }

  function handleComplete() {
    if (phase.kind !== "running") return;
    setPhase({ kind: "reveal", persona: phase.persona, payload: phase.payload });
  }

  function handlePickAgain() {
    setPhase({ kind: "pick" });
  }

  if (phase.kind === "pick") {
    return <PersonaPicker onPick={handlePick} />;
  }

  if (phase.kind === "loading") {
    return (
      <main className="grain-dark vignette relative flex min-h-screen items-center justify-center bg-midnight px-6 text-cream">
        <div
          aria-hidden
          className="pointer-events-none absolute right-[10%] top-[20%] h-72 w-72 animate-lantern-pulse rounded-full bg-vermilion/20 blur-3xl"
        />
        <div className="above-grain max-w-md text-center">
          <p className="font-mono text-label uppercase tracking-[0.18em] text-vermilion">
            <span className="animate-blink-cursor">▮</span> opening session
          </p>
          <p className="mt-6 font-serif text-headline-sm text-cream">
            Loading the public record for{" "}
            <span className="text-vermilion">{phase.persona.display_name}</span>…
          </p>
          <p className="mt-3 font-mono text-body-sm text-cream/50">
            56 candidate items · 37 verification reports · 11 zoning extractions
          </p>
        </div>
      </main>
    );
  }

  if (phase.kind === "running") {
    return (
      <PipelineRunner
        persona={phase.persona}
        payload={phase.payload}
        onComplete={handleComplete}
      />
    );
  }

  if (phase.kind === "reveal") {
    return (
      <BriefingReveal
        persona={phase.persona}
        payload={phase.payload}
        onPickAgain={handlePickAgain}
      />
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6 text-ink">
      <div className="max-w-md">
        <p className="font-mono text-label uppercase tracking-[0.18em] text-vermilion">
          Something broke
        </p>
        <p className="mt-3 font-serif text-headline-sm text-ink">
          {phase.message}
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "pick" })}
          className="mt-6 border border-ink px-4 py-2 font-mono text-label uppercase tracking-[0.12em] text-ink hover:bg-ink hover:text-cream"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
