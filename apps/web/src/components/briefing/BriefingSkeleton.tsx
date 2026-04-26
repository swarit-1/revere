// Loading skeleton matching the editorial direction. Whisper blocks at
// real heading + body sizes, separated by the same hairlines as the
// rendered content. No animated shimmer — that's the AI-default fallback.

export function BriefingSkeleton() {
  return (
    <main className="mx-auto max-w-2xl px-6 pb-24">
      <header className="mb-16 mt-24 border-b border-whisper pb-12">
        <div className="h-3 w-48 bg-whisper" />
        <div className="mt-8 h-12 w-3/4 bg-whisper" />
      </header>
      {[0, 1, 2].map((i) => (
        <article key={i} className="border-b border-whisper py-8 last:border-b-0">
          <div className="h-3 w-56 bg-whisper" />
          <div className="mt-6 space-y-3">
            <div className="h-7 w-5/6 bg-whisper" />
            <div className="h-7 w-2/3 bg-whisper" />
          </div>
          <div className="mt-8 h-3 w-32 bg-whisper" />
          <div className="mt-3 h-4 w-3/4 bg-whisper" />
          <div className="mt-6 space-y-2">
            <div className="h-4 w-full bg-whisper" />
            <div className="h-4 w-11/12 bg-whisper" />
          </div>
        </article>
      ))}
    </main>
  );
}
