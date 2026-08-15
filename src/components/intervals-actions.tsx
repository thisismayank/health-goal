"use client";

import { useState, useTransition } from "react";
import { syncIntervalsNow } from "@/lib/actions";

export function IntervalsSyncButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      try {
        const r = await syncIntervalsNow();
        setResult(
          r.upserted === 0
            ? `Fetched ${r.fetched} rows, nothing new`
            : `Upserted ${r.upserted} day${r.upserted === 1 ? "" : "s"} of recovery data`,
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
