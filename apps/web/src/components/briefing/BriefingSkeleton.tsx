// Loading skeleton matching the editorial direction. Whisper blocks at
// real heading + body sizes, separated by the same hairlines as the
// rendered content. Subtle shimmer overlay scoped to the .shimmer class
// — keeps the editorial restraint, signals motion.

function Bar({ className }: { className: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-whisper ${className}`}
      aria-hidden
    >
      <div className="shimmer absolute inset-0 animate-shimmer" />
    </div>
  );
}

export function BriefingSkeleton() {
  return (
    <main className="mx-auto max-w-2xl px-6 pb-24">
      <header className="mb-16 mt-24 border-b border-whisper pb-12">
        <Bar className="h-3 w-48" />
        <div className="mt-8 space-y-2">
          <Bar className="h-12 w-3/4" />
        </div>
      </header>
      {[0, 1, 2].map((i) => (
        <article
          key={i}
          className="animate-fade-up border-b border-whisper py-8 last:border-b-0"
          style={{ animationDelay: `${100 + i * 120}ms` }}
        >
          <Bar className="h-3 w-56" />
          <div className="mt-6 space-y-3">
            <Bar className="h-7 w-5/6" />
            <Bar className="h-7 w-2/3" />
          </div>
          <Bar className="mt-8 h-3 w-32" />
          <Bar className="mt-3 h-4 w-3/4" />
          <div className="mt-6 space-y-2">
            <Bar className="h-4 w-full" />
            <Bar className="h-4 w-11/12" />
          </div>
        </article>
      ))}
    </main>
  );
}
