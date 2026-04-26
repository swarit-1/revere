// Step 2 of the live demo: the dramatic pipeline runner.
//
// Visualization stack:
//   • Five-stage progress strip across the top.
//   • Active stage gets an editorial card explaining what the agent
//     is doing right now, with live counters + per-item streams.
//   • Terminal-style log feed on the right shows every agent event
//     as it happens, in mono with timestamps + vermilion agent tags.
//
// All the data is real — pre-fetched from Supabase by /api/demo/live.
// The work the agents did already happened (because re-running the
// pipeline costs $$ and minutes); the runner replays those events
// with realistic per-event timing so a judge sees every stage.
// Matching is the one stage that runs LIVE per fingerprint pick.

"use client";

import { useEffect, useReducer, useRef } from "react";
import type { Persona } from "@/lib/demo/personalities";
import type { LiveDemoPayload } from "@/lib/demo/types";

interface Props {
  persona: Persona;
  payload: LiveDemoPayload;
  onComplete: () => void;
}

type StageKey = "ingest" | "verify" | "vision" | "match" | "compose";

interface Stage {
  key: StageKey;
  label: string;
  agent: string;
  description: string;
}

const STAGES: Stage[] = [
  {
    key: "ingest",
    label: "Reading the public record",
    agent: "austin-orchestrator",
    description:
      "Pulling Apr 9 council agenda + every linked staff report. Classifying each item into the topic taxonomy.",
  },
  {
    key: "verify",
    label: "Verifying every claim",
    agent: "sonnet-4-6 verifier",
    description:
      "For each item, locating the source passage that supports each factual claim. Flagging anything unsupported.",
  },
  {
    key: "vision",
    label: "Reading the zoning maps",
    agent: "opus-4-7 vision",
    description:
      "Two-stage Opus 4.7 vision: find the parcel exhibit page, return pixel-coordinate bounding box.",
  },
  {
    key: "match",
    label: "Matching to your fingerprint",
    agent: "fingerprint-matcher",
    description:
      "Scoring every item against your priorities + district. Computing why each one matters to you.",
  },
  {
    key: "compose",
    label: "Composing your briefing",
    agent: "opus-4-7 composer",
    description:
      "Top items get headlines, what-happened summaries, and tie-back strings to your fingerprint clauses.",
  },
];

interface LogEntry {
  id: number;
  ts: string;
  agent: string;
  level: "info" | "ok" | "warn" | "error";
  message: string;
}

interface State {
  activeStage: StageKey | "done";
  ingestProgress: { classified: number; total: number };
  verifyProgress: { checked: number; supported: number; unsupported: number; total: number };
  visionProgress: { extracted: number; total: number; lastBbox: { x: number; y: number; w: number; h: number } | null };
  matchProgress: { scored: number; total: number; surfaced: number };
  composeProgress: { items: Array<{ rank: number; headline: string; why_this: string }> };
  log: LogEntry[];
  recentTopics: Array<{ item_file_id: string; topics: string[] }>;
  verifySamples: Array<{ item_file_id: string; verdict: string; claim_text: string }>;
  visionSamples: Array<{ item_file_id: string; page_index: number | null; confidence: string }>;
  matchSamples: Array<{ item_file_id: string; post_score: number; matched_priorities: string[] }>;
}

type Action =
  | { type: "advance"; stage: StageKey | "done" }
  | { type: "log"; entry: Omit<LogEntry, "id" | "ts"> }
  | { type: "ingest_tick"; count: number; sample: { item_file_id: string; topics: string[] } }
  | { type: "verify_tick"; supported: number; unsupported: number; checked: number; sample: { item_file_id: string; verdict: string; claim_text: string } | undefined }
  | { type: "vision_tick"; extracted: number; sample: { item_file_id: string; page_index: number | null; confidence: string; bbox: State["visionProgress"]["lastBbox"] } | undefined }
  | { type: "match_tick"; scored: number; surfaced: number; sample: { item_file_id: string; post_score: number; matched_priorities: string[] } | undefined }
  | { type: "compose_add"; item: { rank: number; headline: string; why_this: string } };

let logIdSeq = 0;

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "advance":
      return { ...s, activeStage: a.stage };
    case "log":
      return {
        ...s,
        log: [
          ...s.log,
          {
            id: ++logIdSeq,
            ts: new Date().toISOString().slice(11, 19),
            ...a.entry,
          },
        ].slice(-60),
      };
    case "ingest_tick":
      return {
        ...s,
        ingestProgress: { ...s.ingestProgress, classified: a.count },
        recentTopics: [a.sample, ...s.recentTopics].slice(0, 5),
      };
    case "verify_tick":
      return {
        ...s,
        verifyProgress: {
          ...s.verifyProgress,
          checked: a.checked,
          supported: a.supported,
          unsupported: a.unsupported,
        },
        verifySamples: a.sample
          ? [a.sample, ...s.verifySamples].slice(0, 5)
          : s.verifySamples,
      };
    case "vision_tick":
      return {
        ...s,
        visionProgress: {
          ...s.visionProgress,
          extracted: a.extracted,
          lastBbox: a.sample?.bbox ?? s.visionProgress.lastBbox,
        },
        visionSamples: a.sample
          ? [{ item_file_id: a.sample.item_file_id, page_index: a.sample.page_index, confidence: a.sample.confidence }, ...s.visionSamples].slice(0, 4)
          : s.visionSamples,
      };
    case "match_tick":
      return {
        ...s,
        matchProgress: {
          ...s.matchProgress,
          scored: a.scored,
          surfaced: a.surfaced,
        },
        matchSamples: a.sample
          ? [a.sample, ...s.matchSamples].slice(0, 5)
          : s.matchSamples,
      };
    case "compose_add":
      return {
        ...s,
        composeProgress: {
          items: [...s.composeProgress.items, a.item],
        },
      };
    default:
      return s;
  }
}

const INITIAL_STATE: State = {
  activeStage: "ingest",
  ingestProgress: { classified: 0, total: 0 },
  verifyProgress: { checked: 0, supported: 0, unsupported: 0, total: 0 },
  visionProgress: { extracted: 0, total: 0, lastBbox: null },
  matchProgress: { scored: 0, total: 0, surfaced: 0 },
  composeProgress: { items: [] },
  log: [],
  recentTopics: [],
  verifySamples: [],
  visionSamples: [],
  matchSamples: [],
};

export function PipelineRunner({ persona, payload, onComplete }: Props) {
  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL_STATE,
    ingestProgress: { classified: 0, total: payload.candidate_summaries.length },
    verifyProgress: { checked: 0, supported: 0, unsupported: 0, total: payload.verification_rollups.length },
    visionProgress: { extracted: 0, total: payload.zoning_extractions.length, lastBbox: null },
    matchProgress: { scored: 0, total: payload.scored_items.length, surfaced: 0 },
  });
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [state.log]);

  useEffect(() => {
    let cancelled = false;
    const timeouts: Array<ReturnType<typeof setTimeout>> = [];

    function at(ms: number, fn: () => void) {
      timeouts.push(setTimeout(() => !cancelled && fn(), ms));
    }

    let t = 0;

    // ───── Stage 1: Ingest ─────
    at((t += 0), () =>
      dispatch({
        type: "log",
        entry: { agent: "orchestrator", level: "info", message: `> session.open subject_type=meeting subject_id=${payload.meeting.id}` },
      }),
    );
    at((t += 600), () =>
      dispatch({ type: "log", entry: { agent: "orchestrator", level: "info", message: `> fetch ${payload.meeting.agenda_url ?? "agenda PDF"}` } }),
    );
    at((t += 800), () =>
      dispatch({ type: "log", entry: { agent: "orchestrator", level: "ok", message: `agenda packet downloaded · ${payload.candidate_summaries.length} agenda items detected` } }),
    );
    at((t += 400), () =>
      dispatch({ type: "log", entry: { agent: "haiku-4-5", level: "info", message: `classify each item → topics ∈ {housing, transport, public-safety, budget, land-use, commercial-regulation}` } }),
    );

    // Stream candidate items in
    const ingestPerTick = Math.max(1, Math.floor(payload.candidate_summaries.length / 18));
    for (let i = 0; i < payload.candidate_summaries.length; i += ingestPerTick) {
      const j = Math.min(i + ingestPerTick, payload.candidate_summaries.length);
      const sample = payload.candidate_summaries[Math.min(j - 1, payload.candidate_summaries.length - 1)]!;
      at((t += 90), () =>
        dispatch({ type: "ingest_tick", count: j, sample: { item_file_id: sample.item_file_id, topics: sample.topics } }),
      );
    }

    at((t += 250), () =>
      dispatch({ type: "log", entry: { agent: "orchestrator", level: "ok", message: `${payload.candidate_summaries.length} candidate_items persisted` } }),
    );

    // ───── Stage 2: Verify ─────
    at((t += 350), () => dispatch({ type: "advance", stage: "verify" }));
    at(t, () =>
      dispatch({ type: "log", entry: { agent: "verifier", level: "info", message: `> per-claim source-check via Sonnet 4.6` } }),
    );

    const verifyPerTick = Math.max(1, Math.floor(payload.verification_rollups.length / 12));
    let runningSupported = 0;
    let runningUnsupported = 0;
    for (let i = 0; i < payload.verification_rollups.length; i += verifyPerTick) {
      const j = Math.min(i + verifyPerTick, payload.verification_rollups.length);
      const slice = payload.verification_rollups.slice(i, j);
      runningSupported += slice.reduce((acc, v) => acc + v.coverage.supported, 0);
      runningUnsupported += slice.reduce((acc, v) => acc + v.coverage.unsupported + v.coverage.contradicted, 0);
      const r = slice[slice.length - 1];
      const sample = r && r.sample_claims[0]
        ? {
            item_file_id: r.item_id,
            verdict: r.sample_claims[0]!.verdict,
            claim_text: r.sample_claims[0]!.claim_text,
          }
        : undefined;
      at((t += 200), () =>
        dispatch({
          type: "verify_tick",
          checked: j,
          supported: runningSupported,
          unsupported: runningUnsupported,
          sample,
        }),
      );
    }
    at((t += 180), () =>
      dispatch({
        type: "log",
        entry: {
          agent: "verifier",
          level: "ok",
          message: `${payload.verification_rollups.length} reports persisted · ${runningSupported} supported · ${runningUnsupported} unsupported/contradicted`,
        },
      }),
    );

    // ───── Stage 3: Vision ─────
    at((t += 350), () => dispatch({ type: "advance", stage: "vision" }));
    at(t, () =>
      dispatch({ type: "log", entry: { agent: "vision", level: "info", message: `> Opus 4.7 page-detect → parcel-localize on staff-report PDFs` } }),
    );

    for (let i = 0; i < payload.zoning_extractions.length; i++) {
      const z = payload.zoning_extractions[i]!;
      at((t += 280), () =>
        dispatch({
          type: "vision_tick",
          extracted: i + 1,
          sample: { item_file_id: z.item_file_id, page_index: z.page_index, confidence: z.confidence, bbox: z.bbox },
        }),
      );
      if (i === 5) {
        at(t, () =>
          dispatch({
            type: "log",
            entry: {
              agent: "vision",
              level: "ok",
              message: `parcel localized in ${z.item_file_id} → page ${z.page_index} bbox=(${z.bbox?.x},${z.bbox?.y},${z.bbox?.w},${z.bbox?.h}) confidence=${z.confidence}`,
            },
          }),
        );
      }
    }

    // ───── Stage 4: Match (LIVE per fingerprint) ─────
    at((t += 350), () => dispatch({ type: "advance", stage: "match" }));
    at(t, () =>
      dispatch({ type: "log", entry: { agent: "matcher", level: "info", message: `> score ${payload.scored_items.length} items × fingerprint(${persona.fingerprint.user_id})` } }),
    );

    let runningSurfaced = 0;
    for (let i = 0; i < payload.scored_items.length; i++) {
      const s = payload.scored_items[i]!;
      if (s.post_score >= payload.briefing.threshold) runningSurfaced += 1;
      const sCount = runningSurfaced;
      at((t += 75), () =>
        dispatch({
          type: "match_tick",
          scored: i + 1,
          surfaced: sCount,
          sample: { item_file_id: s.item_id, post_score: s.post_score, matched_priorities: s.matched_priorities },
        }),
      );
    }
    at((t += 200), () =>
      dispatch({
        type: "log",
        entry: { agent: "matcher", level: "ok", message: `scoring complete · ${payload.briefing.surfaced.length} above ${payload.briefing.threshold} threshold` },
      }),
    );

    // ───── Stage 5: Compose ─────
    at((t += 350), () => dispatch({ type: "advance", stage: "compose" }));
    at(t, () =>
      dispatch({ type: "log", entry: { agent: "composer", level: "info", message: `> Opus 4.7 synthesis · headline + why_this + what_happened` } }),
    );
    for (let i = 0; i < payload.briefing.surfaced.length; i++) {
      const item = payload.briefing.surfaced[i]!;
      at((t += 380), () =>
        dispatch({
          type: "compose_add",
          item: { rank: i + 1, headline: item.headline, why_this: item.why_this },
        }),
      );
    }

    at((t += 600), () =>
      dispatch({ type: "log", entry: { agent: "composer", level: "ok", message: `briefing.payload composed · cover_header="${payload.briefing.cover_header}"` } }),
    );

    // Done.
    at((t += 1100), () => {
      dispatch({ type: "advance", stage: "done" });
      onComplete();
    });

    return () => {
      cancelled = true;
      for (const id of timeouts) clearTimeout(id);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="grain-dark vignette relative min-h-screen overflow-hidden bg-midnight px-4 py-10 text-cream sm:px-8">
      {/* Lantern halos */}
      <div aria-hidden className="pointer-events-none absolute right-[6%] top-[12%] h-72 w-72 animate-lantern-pulse rounded-full bg-vermilion/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute left-[8%] bottom-[8%] h-96 w-96 animate-lantern-pulse rounded-full bg-cream/5 blur-3xl delay-700" />

      <div className="above-grain mx-auto max-w-7xl">
        <Header persona={persona} payload={payload} />
        <StageStrip activeStage={state.activeStage} />

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]">
          <ActiveStageCard stage={state.activeStage} state={state} payload={payload} persona={persona} />
          <TerminalLog log={state.log} logRef={logRef} />
        </div>
      </div>
    </main>
  );
}

// ───── Header ─────

function Header({ persona, payload }: { persona: Persona; payload: LiveDemoPayload }) {
  return (
    <header className="mb-10 border-b border-cream/10 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-y-3">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex h-12 w-12 items-center justify-center border border-vermilion bg-vermilion font-serif text-2xl font-semibold text-cream"
          >
            {persona.initials}
          </span>
          <div>
            <p className="font-mono text-label uppercase tracking-[0.18em] text-cream/50">
              Step 2 of 3 · Pipeline running on
            </p>
            <p className="mt-1 font-serif text-headline-sm font-semibold text-cream">
              {persona.display_name} <span className="text-cream/40">·</span>{" "}
              <span className="font-mono text-body-sm text-cream/60">
                D{persona.fingerprint.location.council_district} ·{" "}
                {persona.fingerprint.relevance_slider}
              </span>
            </p>
          </div>
        </div>
        <div className="font-mono text-label uppercase tracking-[0.16em] text-cream/50">
          {payload.meeting.body ?? "City Council"} ·{" "}
          <span className="text-vermilion">{payload.meeting.meeting_date}</span>
        </div>
      </div>
    </header>
  );
}

// ───── Stage strip ─────

function StageStrip({ activeStage }: { activeStage: StageKey | "done" }) {
  const stageIdx = activeStage === "done" ? STAGES.length : STAGES.findIndex((s) => s.key === activeStage);
  return (
    <ol className="flex flex-wrap items-stretch gap-2">
      {STAGES.map((s, i) => {
        const status = i < stageIdx ? "done" : i === stageIdx ? "active" : "pending";
        return (
          <li
            key={s.key}
            className={`flex min-w-0 flex-1 flex-col gap-1 border-l-2 px-3 py-2 transition-all duration-300
              ${status === "done" ? "border-cream/40" : status === "active" ? "border-vermilion" : "border-cream/15"}
            `}
          >
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.18em]
                ${status === "active" ? "text-vermilion" : status === "done" ? "text-cream/60" : "text-cream/30"}
              `}
            >
              {String(i + 1).padStart(2, "0")} {status === "active" ? "· running" : status === "done" ? "· done" : ""}
            </span>
            <span
              className={`font-serif text-body-sm leading-snug
                ${status === "pending" ? "text-cream/30" : "text-cream"}
              `}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ───── Active stage card ─────

function ActiveStageCard({
  stage,
  state,
  payload,
  persona,
}: {
  stage: StageKey | "done";
  state: State;
  payload: LiveDemoPayload;
  persona: Persona;
}) {
  if (stage === "done") {
    return (
      <section className="border border-vermilion/40 bg-cream/5 p-8">
        <p className="font-mono text-label uppercase tracking-[0.18em] text-vermilion">
          Pipeline complete
        </p>
        <p className="mt-3 font-serif text-headline-sm leading-tight text-cream">
          {persona.display_name}'s briefing is ready.
        </p>
        <p className="mt-3 max-w-prose text-body-sm text-cream/70">
          Loading the editorial layout…
        </p>
      </section>
    );
  }

  const meta = STAGES.find((s) => s.key === stage)!;

  return (
    <section className="animate-fade-up border border-cream/15 bg-cream/5 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <p className="font-mono text-label uppercase tracking-[0.18em] text-vermilion">
          <span className="animate-blink-cursor">▮</span> {meta.agent}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-cream/40">
          live agent activity
        </p>
      </div>
      <h2 className="mt-3 font-serif text-headline font-semibold leading-tight text-cream">
        {meta.label}
      </h2>
      <p className="mt-3 max-w-prose text-body-sm text-cream/70">{meta.description}</p>

      <div className="mt-8">
        {stage === "ingest" ? <IngestPanel state={state} /> : null}
        {stage === "verify" ? <VerifyPanel state={state} /> : null}
        {stage === "vision" ? <VisionPanel state={state} /> : null}
        {stage === "match" ? <MatchPanel state={state} payload={payload} /> : null}
        {stage === "compose" ? <ComposePanel state={state} /> : null}
      </div>
    </section>
  );
}

// ───── Per-stage panels ─────

function IngestPanel({ state }: { state: State }) {
  const { classified, total } = state.ingestProgress;
  const pct = total === 0 ? 0 : Math.round((classified / total) * 100);
  return (
    <div className="space-y-5">
      <Counter label="agenda items classified" value={classified} total={total} pct={pct} />
      <ul className="space-y-2 font-mono text-body-sm">
        {state.recentTopics.map((s, i) => (
          <li
            key={`${s.item_file_id}-${i}`}
            className="animate-fade-up flex items-start gap-3 border-l-2 border-vermilion/40 pl-3"
            style={{ animationDelay: "0ms" }}
          >
            <span className="text-cream/40">→</span>
            <span className="text-cream">{s.item_file_id}</span>
            <span className="text-cream/50">{s.topics.join(" · ")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VerifyPanel({ state }: { state: State }) {
  const { checked, total, supported, unsupported } = state.verifyProgress;
  const pct = total === 0 ? 0 : Math.round((checked / total) * 100);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <Counter label="items reviewed" value={checked} total={total} pct={pct} />
        <Stat label="claims supported" value={supported} accent="ok" />
        <Stat label="claims rejected" value={unsupported} accent="warn" />
      </div>
      <ul className="space-y-2 font-mono text-body-sm">
        {state.verifySamples.map((s, i) => (
          <li
            key={`${s.item_file_id}-${i}`}
            className="animate-fade-up flex items-start gap-3 border-l-2 pl-3"
            style={{
              borderColor:
                s.verdict === "supported"
                  ? "#5a6b5a"
                  : s.verdict === "unsupported" || s.verdict === "contradicted"
                    ? "#c8331f"
                    : "rgba(232,227,214,0.3)",
            }}
          >
            <span className={`${s.verdict === "supported" ? "text-district" : "text-vermilion"}`}>
              {s.verdict === "supported" ? "✓" : s.verdict === "unsupported" || s.verdict === "contradicted" ? "✗" : "?"}
            </span>
            <span className="text-cream">{s.item_file_id}</span>
            <span className="text-cream/60">"{s.claim_text}"</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VisionPanel({ state }: { state: State }) {
  const { extracted, total, lastBbox } = state.visionProgress;
  const pct = total === 0 ? 0 : Math.round((extracted / total) * 100);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-6">
        <Counter label="parcels localized" value={extracted} total={total} pct={pct} />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-cream/40">
            last bbox · pixel coordinates
          </p>
          <p className="mt-2 font-mono text-body-sm text-cream">
            {lastBbox
              ? `(${lastBbox.x}, ${lastBbox.y}) · ${lastBbox.w}×${lastBbox.h}px`
              : "—"}
          </p>
        </div>
      </div>
      <ul className="space-y-2 font-mono text-body-sm">
        {state.visionSamples.map((s, i) => (
          <li key={`${s.item_file_id}-${i}`} className="animate-fade-up flex items-start gap-3 border-l-2 border-vermilion/40 pl-3">
            <span className="text-vermilion">▦</span>
            <span className="text-cream">{s.item_file_id}</span>
            <span className="text-cream/60">page {s.page_index}</span>
            <span className="text-cream/40">·</span>
            <span className="text-cream/60">{s.confidence}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MatchPanel({ state, payload }: { state: State; payload: LiveDemoPayload }) {
  const { scored, total, surfaced } = state.matchProgress;
  const pct = total === 0 ? 0 : Math.round((scored / total) * 100);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <Counter label="items scored" value={scored} total={total} pct={pct} />
        <Stat
          label={`above ${payload.briefing.threshold} threshold`}
          value={surfaced}
          accent="ok"
        />
        <Stat label="below threshold" value={Math.max(0, scored - surfaced)} accent="muted" />
      </div>
      <ul className="space-y-2 font-mono text-body-sm">
        {state.matchSamples.slice().reverse().slice(0, 5).reverse().map((s, i) => (
          <li
            key={`${s.item_file_id}-${i}`}
            className="animate-fade-up flex flex-wrap items-baseline gap-x-3 border-l-2 pl-3"
            style={{ borderColor: s.post_score >= payload.briefing.threshold ? "#c8331f" : "rgba(232,227,214,0.2)" }}
          >
            <span className={s.post_score >= payload.briefing.threshold ? "text-vermilion" : "text-cream/40"}>
              {s.post_score.toFixed(3)}
            </span>
            <span className="text-cream">{s.item_file_id}</span>
            {s.matched_priorities.length > 0 ? (
              <span className="text-cream/50">{s.matched_priorities.join(" · ")}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ComposePanel({ state }: { state: State }) {
  const { items } = state.composeProgress;
  return (
    <div className="space-y-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-cream/40">
        synthesis underway · {items.length} item{items.length === 1 ? "" : "s"} composed
      </p>
      <ol className="space-y-3">
        {items.map((it) => (
          <li
            key={it.rank}
            className="animate-fade-up border-l-2 border-vermilion pl-4"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-cream/40">
              #{String(it.rank).padStart(2, "0")}
            </p>
            <p className="mt-1 font-serif text-body-lg text-cream">{it.headline}</p>
            <p className="mt-2 break-words font-mono text-[11px] text-vermilion">
              {it.why_this}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ───── Counters / stats / log ─────

function Counter({ label, value, total, pct }: { label: string; value: number; total: number; pct: number }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-cream/40">
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl tabular-nums leading-none text-cream sm:text-4xl">
        <span className="text-vermilion">{value}</span>
        <span className="ml-1 text-cream/40">/ {total}</span>
      </p>
      <div className="mt-3 h-px w-full bg-cream/10">
        <div
          className="h-px bg-vermilion transition-all duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "ok" | "warn" | "muted" }) {
  const color =
    accent === "warn"
      ? "text-vermilion"
      : accent === "muted"
        ? "text-cream/40"
        : "text-district";
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-cream/40">
        {label}
      </p>
      <p className={`mt-2 font-serif text-3xl tabular-nums leading-none sm:text-4xl ${color}`}>
        {value}
      </p>
    </div>
  );
}

function TerminalLog({
  log,
  logRef,
}: {
  log: LogEntry[];
  logRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <aside className="border border-cream/15 bg-ink/40 p-4">
      <p className="mb-3 font-mono text-label uppercase tracking-[0.18em] text-cream/50">
        agent.log
      </p>
      <div
        ref={logRef}
        className="max-h-[460px] space-y-1 overflow-y-auto font-mono text-[11px] leading-relaxed"
      >
        {log.map((l) => (
          <div key={l.id} className="grid grid-cols-[60px_120px_1fr] gap-2">
            <span className="text-cream/30">{l.ts}</span>
            <span
              className={
                l.level === "ok"
                  ? "text-district"
                  : l.level === "warn" || l.level === "error"
                    ? "text-vermilion"
                    : "text-vermilion/80"
              }
            >
              [{l.agent}]
            </span>
            <span className="break-words text-cream/80">{l.message}</span>
          </div>
        ))}
        {log.length === 0 ? (
          <p className="text-cream/30">awaiting first event…</p>
        ) : null}
      </div>
    </aside>
  );
}
