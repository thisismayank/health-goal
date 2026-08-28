"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const ERROR_COPY: Record<string, string> = {
  invalid_email: "That doesn't look like a valid email address.",
  send_failed: "Couldn't send the email. Try again in a moment.",
  invalid_token: "This link is invalid or has already been used.",
  expired_token: "This link expired. Request a new one below.",
  rate_limited:
    "Too many requests. Wait a few minutes and try again.",
  invalid: "That code doesn't match. Check the email and try again.",
  expired: "That code expired. Request a new one.",
};

export function LoginForm({
  defaultEmail = "",
  errorCode,
  codeMode = false,
}: {
  defaultEmail?: string;
  errorCode?: string | null;
  /** True when the parent already rendered [LINK SENT] — the form
   *  swaps to a 6-digit code input targeting /api/auth/verify-code. */
  codeMode?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(
    errorCode ? (ERROR_COPY[errorCode] ?? "Something went wrong.") : null,
  );
  const [betaLink, setBetaLink] = useState<string | null>(null);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBetaLink(null);
    startTransition(async () => {
      try {
        if (codeMode) {
          const res = await fetch("/api/auth/verify-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code }),
          });
          const data = (await res.json()) as {
            ok: boolean;
            error?: string;
            redirect?: string;
          };
          if (!res.ok || !data.ok) {
            setError(ERROR_COPY[data.error ?? ""] ?? "Something went wrong.");
            return;
          }
          // Server sets the session cookie; we hand off to the same
          // destination as /api/auth/verify (cold-start seed → onboarding).
          router.replace(data.redirect ?? "/");
          return;
        }

        const res = await fetch("/api/auth/request-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          error?: string;
          betaLink?: string;
        };
        if (!res.ok || !data.ok) {
          setError(ERROR_COPY[data.error ?? ""] ?? "Something went wrong.");
          return;
        }
        if (data.betaLink) {
          setBetaLink(data.betaLink);
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

  if (codeMode) {
    return (
      <form onSubmit={submit} className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-widest text-muted">
            6-digit code
          </span>
          <input
            type="text"
            required
            autoFocus
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="w-full rounded-md bg-panel border border-panel-border px-3 py-2.5 font-mono tracking-[0.4em] text-lg text-center focus:border-blue-500/50 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={pending || code.length !== 6}
          className="w-full rounded-md bg-accent-strong text-background font-medium px-4 py-2.5 hover:bg-accent transition disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in with code →"}
        </button>
        {error && (
          <p className="text-xs text-danger" role="alert">
            {error}
          </p>
        )}
      </form>
    );
  }

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

      {betaLink && (
        <div className="rounded-md border border-blue-500/40 bg-blue-950/20 p-3 space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
            [BETA · EMAIL NOT CONFIGURED]
          </div>
          <p className="text-xs text-muted">
            No mailer set up yet. Tap below to sign in directly:
          </p>
          <a
            href={betaLink}
            className="block text-center rounded-md bg-accent-strong text-background font-medium px-4 py-2.5 hover:bg-accent transition text-sm"
          >
            Sign in as {email} →
          </a>
        </div>
      )}

      <p className="text-xs text-muted text-center pt-2">
        New here? A link + account are created automatically.
      </p>
    </form>
  );
}
