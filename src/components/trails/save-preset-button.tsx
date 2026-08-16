"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTrailFromPreset } from "@/lib/actions";

/**
 * Save this preset trail to the user's trails.
 * Two modes: quick save, or save + target date + jump to prep plan.
 */
export function SavePresetButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [targetDate, setTargetDate] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (withDate: boolean) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createTrailFromPreset(
          slug,
          withDate && targetDate ? targetDate : undefined,
        );
        router.push(`/trails/${result.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  };

  return (
    <div className="space-y-3">
      {!expanded && (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => save(false)}
            disabled={pending}
            className="flex-1 rounded-md bg-accent-strong text-background font-medium px-4 py-3 hover:bg-accent transition disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save this trail"}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-md border border-blue-500/40 text-blue-300 px-4 py-3 hover:bg-blue-950/20 transition"
          >
            Set target date →
          </button>
        </div>
      )}

      {expanded && (
        <div className="rounded-md border border-blue-500/40 bg-blue-950/10 p-4 space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs uppercase tracking-widest text-blue-300">
              When are you attempting this?
            </span>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-md bg-panel border border-panel-border px-3 py-2"
            />
          </label>
          <p className="text-xs text-muted">
            Setting a date generates a personalized prep plan based on the weeks
            available.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => save(true)}
              disabled={pending || !targetDate}
              className="flex-1 rounded-md bg-accent-strong text-background font-medium px-4 py-2 hover:bg-accent transition disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save & get prep plan"}
            </button>
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setTargetDate("");
              }}
              disabled={pending}
              className="rounded-md border border-panel-border px-4 py-2 text-muted hover:text-foreground transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
