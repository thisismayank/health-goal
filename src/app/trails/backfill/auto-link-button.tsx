"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runPassportAutoLink } from "@/lib/actions";

/**
 * Auto-populates Trail Passport from unlinked hike workouts whose
 * top preset match is "strong" (totalScore >= 0.7). Lives on the
 * backfill page so it's discoverable from the same surface users
 * already visit to manually link individual workouts.
 */
export function AutoLinkButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const r = await runPassportAutoLink();
        setResult(
          r.linked === 0
            ? `Scanned ${r.scanned} · no strong matches to auto-link`
            : `Linked ${r.linked} of ${r.scanned} to your passport`,
        );
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Auto-link failed");
      }
    });
  };

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="text-xs rounded-md border border-blue-500/40 text-blue-300 hover:bg-blue-500/10 font-medium px-3 py-1.5 disabled:opacity-50"
      >
        {pending ? "Matching…" : "Auto-link strong matches"}
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
