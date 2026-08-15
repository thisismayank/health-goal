"use client";

import { useState, useTransition } from "react";
import { disconnectStrava, syncStravaNow } from "@/lib/actions";

export function StravaSyncButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      try {
        const r = await syncStravaNow();
        setResult(
          r.total === 0
            ? "No new activities"
            : `${r.created} new · ${r.updated} updated`,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "sync failed");
      }
    });
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-md bg-accent-strong hover:bg-accent text-background font-medium px-4 py-2 disabled:opacity-50"
      >
        {pending ? "Syncing…" : "Sync now"}
      </button>
      {result && <p className="text-xs text-muted">{result}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function StravaDisconnectButton() {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!confirm("Disconnect Strava? Auto-import will stop.")) return;
    startTransition(async () => {
      await disconnectStrava();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-md border border-panel-border hover:border-danger text-muted hover:text-danger px-4 py-2 disabled:opacity-50"
    >
      {pending ? "…" : "Disconnect"}
    </button>
  );
}
