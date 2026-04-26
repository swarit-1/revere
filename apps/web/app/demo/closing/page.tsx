// Demo card 3 — closing card. PRD §19.2 beat 1:55–2:05.
//
// Line-by-line reveal. Vermilion lockup pulse on the brand. The
// closing tagline sits below a hairline that draws across.

export const dynamic = "force-static";

export default function ClosingPage() {
  return (
    <main className="grain bg-dawn relative flex min-h-screen items-center justify-center overflow-hidden bg-cream px-6 py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute right-[14%] top-[18%] h-64 w-64 animate-lantern-pulse rounded-full bg-vermilion/8 blur-3xl"
      />

      <div className="above-grain max-w-3xl text-center">
        <p className="animate-fade-down font-mono text-label uppercase tracking-[0.32em] text-district">
          Revere
        </p>

        <h1 className="mt-12 font-serif text-3xl font-light leading-[1.1] text-ink sm:text-4xl md:text-5xl lg:text-6xl">
          <span className="block animate-fade-up-lg delay-200">
            Same public record.
          </span>
          <span className="block animate-fade-up-lg text-vermilion delay-500">
            Different lives.
          </span>
          <span className="block animate-fade-up-lg delay-800">
            Receipts on every claim.
          </span>
        </h1>

        <div
          aria-hidden
          className="mx-auto mt-12 h-px w-32 origin-center scale-x-0 animate-draw-rule bg-ink/30 delay-1200"
        />

        <p className="mt-12 font-serif text-2xl font-light text-ink/70 sm:text-3xl">
          <span className="block animate-fade-up delay-1500">
            Civic information, personal.
          </span>
          <span className="block animate-fade-up delay-1800">
            Civic action, yours.
          </span>
        </p>

        <div className="mt-16 flex items-center justify-center gap-3 text-label uppercase tracking-[0.32em] text-district">
          <span
            aria-hidden
            className="block h-1.5 w-1.5 animate-fade-in rounded-full bg-vermilion delay-2000"
          />
          <span className="animate-fade-up delay-2000">Built with Opus 4.7</span>
        </div>
      </div>
    </main>
  );
}
