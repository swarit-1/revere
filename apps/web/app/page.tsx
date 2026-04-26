export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="font-serif text-4xl text-ink">Revere</h1>
      <p className="mt-4 text-ink/70">
        Your personal civic chief of staff. Wakes up while you sleep.
      </p>
      <nav className="mt-12 flex gap-6 text-sm">
        <a
          href="/auth/sign-in"
          className="border-b border-ink pb-1 text-ink hover:border-vermilion"
        >
          Sign in
        </a>
        <a
          href="/demo?fp=maya"
          className="border-b border-whisper pb-1 text-ink/70 hover:border-ink"
        >
          See a demo briefing
        </a>
      </nav>
    </main>
  );
}
