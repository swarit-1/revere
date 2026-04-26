// Landing / marketing splash. Newspaper masthead idiom — date strap,
// large display headline, hairline rules — overlaid with a layered
// motion script that draws each rule, fades the kicker, then settles
// the headline word by word. The lantern halo + film grain give the
// surface texture; the editorial palette stays untouched.

import Link from "next/link";

export const dynamic = "force-static";

const TODAY = formatToday();

export default function Home() {
  return (
    <main className="grain relative min-h-screen overflow-hidden bg-cream bg-dawn text-ink">
      {/* Sweep ribbon — the "ride" — as a deliberate atmospheric flourish. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 top-[28%] h-px overflow-hidden opacity-50"
      >
        <div className="h-full w-1/3 animate-ride-sweep bg-gradient-to-r from-transparent via-vermilion/60 to-transparent delay-1500" />
      </div>

      <div className="above-grain mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10 sm:px-10 sm:py-14">
        <Masthead />

        <section className="mt-16 flex flex-1 flex-col justify-center sm:mt-24">
          <p className="animate-fade-up font-mono text-label uppercase tracking-[0.18em] text-district delay-200">
            Issue 001 — for those who wake up wanting to know
          </p>

          <h1 className="mt-8 max-w-5xl font-serif text-display font-light tracking-tighter text-ink">
            <RevealLine delay={400}>The night belongs</RevealLine>
            <RevealLine delay={650}>
              to <em className="not-italic font-normal text-vermilion">Revere</em>.
            </RevealLine>
          </h1>

          <div
            aria-hidden
            className="mt-12 h-px w-full origin-left animate-draw-rule bg-ink/15 delay-1200"
          />

          <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
            <div className="animate-fade-up font-serif text-body-lg leading-relaxed text-ink/80 delay-1500 lg:col-span-7">
              <p>
                Paul Revere rode through the night so sleeping citizens
                would wake up knowing what was coming. In{" "}
                <span className="text-vermilion">2026</span>, most Americans
                don't know what their city council voted on last night.
              </p>
              <p className="mt-6">
                Revere is a personal civic chief of staff. Overnight it
                reads the public record, filters it through a fingerprint
                of who you are, verifies every claim against source, and
                lands a five-minute briefing before you reach for coffee.
                It never autosends.
              </p>
            </div>

            <aside className="animate-fade-up font-mono text-body-sm leading-relaxed text-ink/70 delay-1800 lg:col-span-5">
              <ul className="space-y-3">
                <Stat label="Same meeting" value="Two people" />
                <Stat label="Different lives" value="Different briefings" />
                <Stat label="Every claim" value="Receipts on source" />
                <Stat label="Every reply" value="You hit send" />
              </ul>
            </aside>
          </div>

          <nav className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-4 text-body-sm">
            <Link
              href="/demo/live"
              className="group animate-fade-up inline-flex items-center gap-3 border-2 border-vermilion bg-vermilion px-6 py-4 font-mono text-cream shadow-[0_8px_24px_-8px_rgba(200,51,31,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-vermilion-deep hover:shadow-[0_14px_32px_-10px_rgba(200,51,31,0.7)] delay-1800"
            >
              <span aria-hidden className="text-cream/80">▶</span>
              <span>Run it live — watch every agent</span>
              <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                ↗
              </span>
            </Link>

            <Link
              href="/demo/hook"
              className="group animate-fade-up inline-flex items-center gap-3 border border-ink bg-cream px-5 py-3 font-mono text-ink transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink hover:text-cream delay-1900"
            >
              <span>Cinematic demo</span>
              <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                ↗
              </span>
            </Link>

            <Link
              href="/demo?fp=maya"
              className="link-draw animate-fade-up font-mono text-ink delay-2000"
              data-vermilion
            >
              Maya →
            </Link>

            <Link
              href="/demo?fp=jason"
              className="link-draw animate-fade-up font-mono text-ink delay-2000"
              data-vermilion
            >
              Jason →
            </Link>

            <Link
              href="/auth/sign-in"
              className="link-draw animate-fade-up font-mono text-ink/70 delay-2000"
            >
              Sign in
            </Link>
          </nav>
        </section>

        <Footer />
      </div>
    </main>
  );
}

function Masthead() {
  return (
    <header className="flex flex-col gap-6 border-b border-ink/15 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="animate-fade-down">
        <p className="font-mono text-label uppercase tracking-[0.24em] text-district">
          The Revere Briefing
        </p>
        <p className="mt-1 font-serif text-headline-sm font-semibold tracking-tighter text-ink">
          Vol. I · No. 001
        </p>
      </div>
      <div className="animate-fade-down flex items-center gap-6 text-label uppercase tracking-[0.16em] text-district delay-100">
        <span>Austin · TX</span>
        <span aria-hidden className="h-3 w-px bg-ink/15" />
        <span>{TODAY}</span>
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <li className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 border-l border-ink/15 pl-4">
      <span className="text-label uppercase tracking-[0.14em] text-district">
        {label}
      </span>
      <span className="font-serif text-body text-ink">{value}</span>
    </li>
  );
}

function Footer() {
  return (
    <footer className="mt-20 flex flex-wrap items-center justify-between gap-4 border-t border-ink/15 pt-6 text-label uppercase tracking-[0.16em] text-district">
      <p className="animate-fade-up delay-2000">
        Built with Claude Opus 4.7 · Hackathon, April 2026
      </p>
      <p className="animate-fade-up delay-2000">
        <span aria-hidden className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-vermilion" />
        Trust is the product
      </p>
    </footer>
  );
}

// Inline component to keep the headline render explicit. Each line gets
// its own block so a long headline can wrap without breaking the reveal.
function RevealLine({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <span
      className="block animate-fade-up-lg"
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </span>
  );
}

function formatToday(): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  // Static for the cover masthead. Build-time render is fine; not a clock.
  const d = new Date("2026-04-26T00:00:00Z");
  const dow = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getUTCDay()];
  return `${dow} ${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
