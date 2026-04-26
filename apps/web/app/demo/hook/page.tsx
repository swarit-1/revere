// Demo card 1 — the Paul Revere hook. PRD §3 + §19.2 beat 0:00–0:10.
// Black background; cream serif. The only vermilion on the page is in
// the year "2026" — keeps the editorial cadence consistent with the
// rest of the demo (numerals as the load-bearing accent).

export const dynamic = "force-static";

export default function HookPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 py-24">
      <div className="max-w-3xl text-center">
        <p className="text-label uppercase tracking-[0.18em] text-district/80">
          Revere
        </p>
        <h1 className="mt-12 font-serif text-3xl font-light leading-tight text-cream sm:text-4xl md:text-5xl lg:text-6xl">
          Paul Revere rode through the night so sleeping
          citizens would know what was coming.
        </h1>
        <p className="mt-12 font-serif text-2xl font-light leading-tight text-cream/80 sm:text-3xl md:text-4xl">
          In <span className="text-vermilion">2026</span>, most Americans don't know
          what their city council voted on last night.
        </p>
        <p className="mt-16 text-label uppercase tracking-[0.24em] text-district">
          This is Revere.
        </p>
      </div>
    </main>
  );
}
