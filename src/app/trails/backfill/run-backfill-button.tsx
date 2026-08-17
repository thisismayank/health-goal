"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { backfillIntervalsActivities } from "@/lib/actions";

export function RunBackfillButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const r = await backfillIntervalsActivities(365);
        setResult(
          `Fetched ${r.fetched} · created ${r.created} · updated ${r.updated}`,
        );
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sync failed");
      }
    });
  };

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="text-xs rounded-md bg-accent-strong hover:bg-accent text-background font-medium px-3 py-1.5 disabled:opacity-50"
      >
        {pending ? "Syncing…" : "Sync history"}
      </button>
      {result && (
        <div className="text-[11px] text-accent mt-1">{result}</div>
      )}
      {error && (
        <div className="text-[11px] text-danger mt-1">{error}</div>
      )}
    </div>
  );
}
