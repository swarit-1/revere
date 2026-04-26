// Placeholder for T-29 (voice onboarding). Lands here when an authenticated
// user has no fingerprint_user_id in app_metadata.

export default function OnboardingPendingPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="font-serif text-2xl text-ink">Almost there.</h1>
      <p className="mt-4 text-sm text-ink/70">
        Voice onboarding ships in T-29. For demo purposes, visit{" "}
        <a href="/demo?fp=maya" className="underline decoration-vermilion">
          /demo?fp=maya
        </a>{" "}
        or{" "}
        <a href="/demo?fp=jason" className="underline decoration-vermilion">
          /demo?fp=jason
        </a>
        .
      </p>
    </main>
  );
}
