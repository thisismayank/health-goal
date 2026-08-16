"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const ERROR_COPY: Record<string, string> = {
  invalid_email: "That doesn't look like a valid email address.",
  send_failed: "Couldn't send the email. Try again in a moment.",
  invalid_token: "This link is invalid or has already been used.",
  expired_token: "This link expired. Request a new one below.",
};

export function LoginForm({
  defaultEmail = "",
  errorCode,
}: {
  defaultEmail?: string;
  errorCode?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(
    errorCode ? (ERROR_COPY[errorCode] ?? "Something went wrong.") : null,
  );

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/request-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setError(ERROR_COPY[data.error ?? ""] ?? "Something went wrong.");
          return;
        }
        router.replace(
          `/login?sent=1&email=${encodeURIComponent(email.trim().toLowerCase())}`,
        );
      } catch {
        setError("Network error. Try again.");
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block space-y-1.5">
        <span className="text-xs uppercase tracking-widest text-muted">
          Email
        </span>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-md bg-panel border border-panel-border px-3 py-2.5 focus:border-blue-500/50 focus:outline-none"
        />
      </label>

      <button
        type="submit"
        disabled={pending || !email}
        className="w-full rounded-md bg-accent-strong text-background font-medium px-4 py-3 hover:bg-accent transition disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send sign-in link"}
      </button>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <p className="text-xs text-muted text-center pt-2">
        New here? A link + account are created automatically.
      </p>
    </form>
  );
}
