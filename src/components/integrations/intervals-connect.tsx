"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  disconnectIntervals,
  saveIntervalsCredentials,
} from "@/lib/actions";

/**
 * Client form for entering + saving intervals.icu credentials.
 *
 * Security notes visible to users:
 *   - The API key input is type="password" so it's not visible on screen
 *   - We only display the last 4 chars after save (never the full key)
 *   - The key is AES-256-GCM encrypted before storage
 *   - Disconnect wipes the row entirely
 */
export function IntervalsConnect({
  connected,
  athleteId: existingAthleteId,
  apiKeyLast4,
  lastSyncAt,
}: {
  connected: boolean;
  athleteId?: string;
  apiKeyLast4?: string;
  lastSyncAt?: string | null;
}) {
  const router = useRouter();
  const [athleteId, setAthleteId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessNote(null);
    startTransition(async () => {
      const r = await saveIntervalsCredentials({ athleteId, apiKey });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSuccessNote(
        r.upserted > 0
          ? `Connected — ${r.upserted} days of data imported.`
          : "Connected. No new data to import right now.",
      );
      setApiKey("");
      setAthleteId("");
      router.refresh();
    });
  };

  const disconnect = () => {
    setError(null);
    startTransition(async () => {
      await disconnectIntervals();
      setConfirmingDisconnect(false);
      router.refresh();
    });
  };

  if (connected) {
    return (
      <div className="rounded-lg border border-accent/50 bg-accent-strong/5 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium flex items-center gap-2">
              <span className="text-accent font-mono">✓</span>
              intervals.icu
            </div>
            <div className="text-xs text-muted mt-1 space-y-0.5">
              <div>
                Athlete{" "}
                <span className="font-mono text-foreground">
                  {existingAthleteId}
                </span>
              </div>
              <div>
                API key{" "}
                <span className="font-mono text-foreground">
                  ••••{apiKeyLast4}
                </span>
                <span className="text-[10px] ml-1 opacity-60">
                  (encrypted at rest)
                </span>
              </div>
              {lastSyncAt && (
                <div>
                  Last sync{" "}
                  <span className="text-foreground">
                    {new Date(lastSyncAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        {successNote && (
          <p className="text-xs text-accent">{successNote}</p>
        )}
        {confirmingDisconnect ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-warn">
              This deletes your saved key. Existing imported data stays.
            </span>
            <button
              type="button"
              onClick={disconnect}
              disabled={pending}
              className="text-xs bg-danger/80 hover:bg-danger text-background rounded-md px-2 py-1 disabled:opacity-50"
            >
              {pending ? "Removing…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDisconnect(false)}
              disabled={pending}
              className="text-xs text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDisconnect(true)}
            className="text-xs text-muted hover:text-danger underline underline-offset-4"
          >
            Disconnect
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-panel-border bg-panel p-4 space-y-3"
    >
      <div>
        <div className="font-medium">intervals.icu</div>
        <div className="text-xs text-muted mt-1">
          Bridges Garmin, Wahoo, Zwift, Peloton, TrainingPeaks, Suunto,
          Polar. Free to use.
        </div>
      </div>

      <details className="rounded-md border border-panel-border bg-background/40 group">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs text-blue-300 hover:text-blue-200 flex items-center gap-2">
          <span className="inline-block transition-transform group-open:rotate-90 text-[10px]">
            ▸
          </span>
          First time? Here&apos;s how to get your credentials.
        </summary>
        <ol className="px-4 pb-3 pt-1 space-y-2 text-xs text-muted leading-relaxed list-decimal list-inside marker:text-blue-400">
          <li>
            Go to{" "}
            <a
              className="text-blue-300 hover:underline"
              href="https://intervals.icu"
              target="_blank"
              rel="noopener noreferrer"
            >
              intervals.icu
            </a>{" "}
            and create a free account (or sign in with Strava).
          </li>
          <li>
            In the intervals.icu dashboard, click your name (top-right)
            → <strong className="text-foreground">Settings</strong> →{" "}
            <strong className="text-foreground">Connections</strong>.
            Connect your Garmin / Wahoo / Zwift / etc. account — this
            is one-click OAuth per source.
          </li>
          <li>
            Wait a minute for your history to sync into intervals.icu.
          </li>
          <li>
            Still in Settings, scroll to{" "}
            <strong className="text-foreground">Developer Settings</strong>.
            Copy your{" "}
            <strong className="text-foreground">Athlete ID</strong>{" "}
            (looks like <code className="text-blue-300">i123456</code>)
            and{" "}
            <strong className="text-foreground">API Key</strong> (long
            hex string).
          </li>
          <li>
            Paste both below and hit Connect. We&apos;ll validate the
            key and pull your last 30 days of wellness data.
          </li>
        </ol>
        <p className="px-4 pb-3 pt-1 text-[11px] text-muted italic">
          Prefer a shortcut?{" "}
          <a
            className="text-blue-300 hover:underline"
            href="https://intervals.icu/settings"
            target="_blank"
            rel="noopener noreferrer"
          >
            Jump straight to intervals.icu Settings →
          </a>
        </p>
      </details>

      <label className="block space-y-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
          Athlete ID
        </span>
        <input
          value={athleteId}
          onChange={(e) => setAthleteId(e.target.value)}
          required
          autoComplete="off"
          placeholder="e.g. i123456"
          className="w-full rounded-md bg-background border border-panel-border px-3 py-2 text-sm font-mono focus:border-blue-500/50 focus:outline-none"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
          API Key
        </span>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="paste your API key"
          className="w-full rounded-md bg-background border border-panel-border px-3 py-2 text-sm font-mono focus:border-blue-500/50 focus:outline-none"
        />
        <span className="block text-[11px] text-muted pt-1">
          🔒 Encrypted with AES-256-GCM before storage. We only display
          the last 4 chars for you to verify — never the full key.
        </span>
      </label>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !athleteId || !apiKey}
        className="rounded-md bg-accent-strong hover:bg-accent text-background font-medium text-sm px-4 py-2 disabled:opacity-50"
      >
        {pending ? "Validating…" : "Connect →"}
      </button>
    </form>
  );
}
