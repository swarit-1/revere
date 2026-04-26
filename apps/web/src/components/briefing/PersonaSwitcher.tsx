// Persona switcher button. Single tap mutates app_metadata via the Route
// Handler, then router.refresh() re-runs the server component with the
// new JWT in cookies. RLS reads the new fingerprint_user_id, the new
// briefing renders. No page reload, no re-login.

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  current: string;
}

const TARGETS: Record<string, string> = {
  maya: "jason",
  jason: "maya",
};

export function PersonaSwitcher({ current }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const target = TARGETS[current];
  if (!target) return null;

  async function handleSwitch() {
    setError(null);
    const res = await fetch("/api/persona/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "switch failed");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="fixed bottom-6 right-6 flex animate-fade-up flex-col items-end gap-2 delay-1000">
      {error ? (
        <p className="animate-fade-down border border-vermilion bg-cream px-3 py-1 text-label uppercase tracking-[0.12em] text-vermilion">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={handleSwitch}
        disabled={pending}
        className="group relative overflow-hidden border border-ink bg-cream px-4 py-2 text-label uppercase tracking-[0.12em] text-ink shadow-[0_8px_24px_-12px_rgba(26,26,23,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-12px_rgba(200,51,31,0.35)] disabled:opacity-50"
      >
        <span className="relative z-10 transition-colors duration-300 group-hover:text-cream">
          <span className="text-district transition-colors duration-300 group-hover:text-cream/60">
            switch ·{" "}
          </span>
          <span>fp={current}</span>
          <span className="px-2 text-district transition-colors duration-300 group-hover:text-cream/60">
            →
          </span>
          <span>{target}</span>
        </span>
        {/* Sliding fill on hover. */}
        <span
          aria-hidden
          className="absolute inset-0 origin-left scale-x-0 bg-ink transition-transform duration-300 ease-out group-hover:scale-x-100"
        />
      </button>
    </div>
  );
}
