// Demo card 1 — the Paul Revere hook. PRD §3 + §19.2 beat 0:00–0:10.
//
// Cinematic reveal: KICKER fades down, then the quote line appears word
// by word (clip-path mask), then the modern translation surfaces, then
// the brand lockup. Lantern halo + film grain + vignette give the page
// a midnight-window feel that pure black-on-text lacked.

export const dynamic = "force-static";

const QUOTE_WORDS = [
  "Paul", "Revere", "rode", "through", "the", "night",
  "so", "sleeping", "citizens",
  "would", "know", "what", "was", "coming.",
];

export default function HookPage() {
  return (
    <main className="grain-dark vignette relative flex min-h-screen items-center justify-center overflow-hidden bg-midnight bg-lantern px-6 py-24">
      {/* The lantern itself — a soft warm pulse off-axis. */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[6%] top-[18%] h-72 w-72 animate-lantern-pulse rounded-full bg-vermilion/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[10%] bottom-[14%] h-96 w-96 animate-lantern-pulse rounded-full bg-cream/5 blur-3xl delay-700"
      />

      <div className="above-grain max-w-4xl text-center">
        <p className="animate-fade-down font-mono text-label uppercase tracking-[0.32em] text-cream/40">
          1775 — by lantern
        </p>

        <h1 className="mt-12 font-serif text-3xl font-light leading-[1.1] text-cream sm:text-4xl md:text-5xl lg:text-6xl">
          {QUOTE_WORDS.map((w, i) => (
            <span
              key={i}
              className="inline-block animate-word-reveal"
              style={{
                // 60ms per word baseline + 200ms initial. Quote-end punch
                // (the period on "coming.") gets +100ms hold so it lands.
                animationDelay: `${200 + i * 90}ms`,
              }}
            >
              {w}
              {i < QUOTE_WORDS.length - 1 ? " " : ""}
            </span>
          ))}
        </h1>

        <div
          aria-hidden
          className="mx-auto mt-12 h-px w-32 origin-center scale-x-0 animate-draw-rule bg-vermilion/60"
          style={{ animationDelay: "1900ms" }}
        />

        <p
          className="mt-12 font-serif text-2xl font-light leading-tight text-cream/85 sm:text-3xl md:text-4xl"
          style={{ animationFillMode: "both" }}
        >
          <span
            className="block animate-fade-up-lg"
            style={{ animationDelay: "2200ms" }}
          >
            In <span className="text-vermilion">2026</span>, most Americans don't
            know
          </span>
          <span
            className="block animate-fade-up-lg"
            style={{ animationDelay: "2500ms" }}
          >
            what their city council voted on last night.
          </span>
        </p>

        <div className="mt-16 flex items-center justify-center gap-3 text-label uppercase tracking-[0.32em] text-cream/55">
          <span
            aria-hidden
            className="block h-1.5 w-1.5 animate-fade-in rounded-full bg-vermilion"
            style={{ animationDelay: "3300ms" }}
          />
          <span
            className="animate-fade-up"
            style={{ animationDelay: "3300ms" }}
          >
            This is Revere
          </span>
        </div>
      </div>
    </main>
  );
}
