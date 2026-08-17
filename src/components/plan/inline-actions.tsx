"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markSessionComplete,
  unmarkSessionComplete,
  skipSession,
  reopenSession,
} from "@/lib/actions";

/**
 * Compact per-day actions on the /train weekly list.
 *
 * Three states:
 *   - future  → shows a subtle "not yet" chip; no buttons.
 *   - today/past + planned  → Done / Skip buttons; Done opens a tiny
 *     duration + RPE form; Skip fires immediately.
 *   - today/past + completed/skipped → shows a small Undo link that
 *     restores 'planned' status (and, for manual completions,
 *     removes the placeholder workout row).
 *
 * All calls are server actions on the existing endpoints. The router
 * refresh triggers Home/train/plan revalidation via the action's own
 * revalidatePath calls.
 */
export function InlineSessionActions({
  plannedSessionId,
  targetDurationMinutes,
  status,
  isFuture,
  hasImportedWorkout,
}: {
  plannedSessionId: number;
  targetDurationMinutes: number | null;
  status: string;
  isFuture: boolean;
  hasImportedWorkout: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState<string>(
    targetDurationMinutes != null ? String(targetDurationMinutes) : "",
  );
  const [rpe, setRpe] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<unknown>) => {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  };

  if (isFuture) {
    return (
      <div className="text-[10px] uppercase tracking-wider text-muted">
        not yet
      </div>
    );
  }

  if (status === "completed" || status === "skipped") {
    // Only offer undo when we're the ones who put it there. A Strava-
    // imported completion shouldn't be undoable from here — it's a
    // real activity, not a placeholder.
    if (hasImportedWorkout && status === "completed") {
      return (
        <div className="text-[10px] uppercase tracking-wider text-accent">
          logged
        </div>
      );
    }
    const undo = () =>
      status === "completed"
        ? unmarkSessionComplete(plannedSessionId)
        : reopenSession(plannedSessionId);
    return (
      <button
        type="button"
        onClick={() => run(undo)}
        disabled={pending}
        className="text-[10px] uppercase tracking-wider text-muted hover:text-danger underline underline-offset-4 disabled:opacity-50"
      >
        {pending ? "…" : "undo"}
      </button>
    );
  }

  if (open) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() =>
            markSessionComplete({
              plannedSessionId,
              actualDurationMinutes: duration ? Number(duration) : undefined,
              rpe: rpe ? Number(rpe) : undefined,
            }),
          );
        }}
        className="flex items-center gap-1.5"
      >
        <input
          type="number"
          min={1}
          max={999}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="min"
          aria-label="Duration in minutes"
          className="w-14 rounded bg-background border border-panel-border px-1.5 py-1 text-xs font-mono tabular-nums focus:border-blue-500/50 focus:outline-none"
        />
        <input
          type="number"
          min={1}
          max={10}
          value={rpe}
          onChange={(e) => setRpe(e.target.value)}
          placeholder="RPE"
          aria-label="Rate of perceived exertion"
          className="w-12 rounded bg-background border border-panel-border px-1.5 py-1 text-xs font-mono tabular-nums focus:border-blue-500/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent-strong hover:bg-accent text-background text-[10px] uppercase tracking-wider px-2 py-1 font-medium disabled:opacity-50"
        >
          {pending ? "…" : "save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="text-[10px] uppercase tracking-wider text-muted hover:text-foreground"
        >
          cancel
        </button>
        {error && (
          <span className="text-[10px] text-danger" role="alert">
            {error}
          </span>
        )}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className="rounded bg-accent-strong hover:bg-accent text-background text-[10px] uppercase tracking-wider px-2 py-1 font-medium disabled:opacity-50"
      >
        ✓ done
      </button>
      <button
        type="button"
        onClick={() => run(() => skipSession(plannedSessionId))}
        disabled={pending}
        className="text-[10px] uppercase tracking-wider text-muted hover:text-warn underline underline-offset-4 disabled:opacity-50"
      >
        skip
      </button>
      {error && (
        <span className="text-[10px] text-danger" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
