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
          Bridges Garmin, Wahoo, Zwift, Peloton, TrainingPeaks. Get your
          Athlete ID + API key from{" "}
          <a
            href="https://intervals.icu/settings"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-300 hover:underline"
          >
            intervals.icu → Settings
          </a>
          .
        </div>
      </div>

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
