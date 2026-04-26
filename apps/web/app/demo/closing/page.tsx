// Demo card 3 — closing card. PRD §19.2 beat 1:55–2:05.
// "Revere. Same public record. Different lives. Receipts on every claim."

export const dynamic = "force-static";

export default function ClosingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6 py-24">
      <div className="max-w-3xl text-center">
        <p className="text-label uppercase tracking-[0.18em] text-district">
          Revere
        </p>
        <h1 className="mt-12 font-serif text-3xl font-light leading-tight text-ink sm:text-4xl md:text-5xl lg:text-6xl">
          Same public record.
          <br />
          <span className="text-vermilion">Different lives.</span>
          <br />
          Receipts on every claim.
        </h1>
        <p className="mt-16 font-serif text-2xl font-light text-ink/70 sm:text-3xl">
          Civic information, personal.
          <br />
          Civic action, yours.
        </p>
      </div>
    </main>
  );
}
