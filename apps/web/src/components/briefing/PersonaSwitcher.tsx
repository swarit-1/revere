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
    <div className="fixed bottom-6 right-6 flex flex-col items-end gap-2">
      {error ? (
        <p className="border border-vermilion bg-cream px-3 py-1 text-label uppercase tracking-[0.12em] text-vermilion">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={handleSwitch}
        disabled={pending}
        className="border border-ink bg-cream px-4 py-2 text-label uppercase tracking-[0.12em] text-ink hover:bg-ink hover:text-cream disabled:opacity-50"
      >
        <span className="text-district">switch · </span>
        <span>fp={current}</span>
        <span className="px-2 text-district">→</span>
        <span>{target}</span>
      </button>
    </div>
  );
}
