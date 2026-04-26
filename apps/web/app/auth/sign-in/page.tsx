// Magic-link sign-in. Email input → supabase.auth.signInWithOtp → user
// receives the link in their inbox → clicking it lands on /auth/callback,
// which exchanges the code and redirects to /briefing.

"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const sb = supabaseBrowser();
    const { error: err } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (err) {
      setError(err.message);
      setStatus("error");
      return;
    }
    setStatus("sent");
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="text-3xl font-serif text-ink">Revere</h1>
      <p className="mt-2 text-sm text-ink/60">Sign in with a magic link.</p>

      <form onSubmit={handleSubmit} className="mt-12 space-y-4">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-ink/60">
            Email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === "sending" || status === "sent"}
            className="mt-2 w-full border-b border-whisper bg-transparent py-2 font-body text-ink focus:border-ink focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={status === "sending" || status === "sent"}
          className="border border-ink px-6 py-2 text-sm font-body text-ink transition-colors hover:bg-ink hover:text-cream disabled:opacity-50"
        >
          {status === "sending" ? "Sending…" : status === "sent" ? "Check your inbox" : "Send magic link"}
        </button>
      </form>

      {status === "sent" && (
        <p className="mt-8 border-t border-whisper pt-6 text-sm text-ink/70">
          A sign-in link was sent to <span className="font-mono">{email}</span>.
          The link is valid for one hour.
        </p>
      )}
      {status === "error" && error && (
        <p className="mt-8 border-t border-whisper pt-6 text-sm text-vermilion">
          {error}
        </p>
      )}
    </main>
  );
}
