"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markSessionComplete,
  unmarkSessionComplete,
} from "@/lib/actions";

/**
 * Inline log-completion form on the session detail page.
 *
 * State machine:
 *   - !alreadyDone → 'Mark done' button opens the form
 *   - form open   → inputs for duration, RPE, notes, save
 *   - alreadyDone → summary + 'Un-mark' button (only for manually-logged;
 *     Strava-imported completions can't be unmarked here to avoid
 *     destroying data the user didn't create)
 */
export function MarkCompleteForm({
  plannedSessionId,
  targetDurationMinutes,
  alreadyDone,
  canUnmark,
}: {
  plannedSessionId: number;
  targetDurationMinutes: number | null;
  alreadyDone: boolean;
  canUnmark: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState<string>(
    targetDurationMinutes != null ? String(targetDurationMinutes) : "",
  );
  const [rpe, setRpe] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await markSessionComplete({
          plannedSessionId,
          actualDurationMinutes: duration ? Number(duration) : undefined,
          rpe: rpe ? Number(rpe) : undefined,
          notes: notes.trim() || undefined,
        });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  };

  const unmark = () => {
    setError(null);
    startTransition(async () => {
      try {
        await unmarkSessionComplete(plannedSessionId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  };

  if (alreadyDone) {
    if (!canUnmark) return null;
    return (
      <button
        type="button"
        onClick={unmark}
        disabled={pending}
        className="text-xs text-muted hover:text-danger underline underline-offset-4 disabled:opacity-50"
      >
        {pending ? "…" : "Un-mark as done"}
      </button>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-accent-strong hover:bg-accent text-background font-medium text-sm px-4 py-2"
      >
        ✓ Mark done
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-md border border-blue-500/40 bg-blue-950/20 p-3 space-y-2"
    >
      <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
        Log completion
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs space-y-1">
          <span className="text-muted">Duration (min)</span>
          <input
            type="number"
            min={1}
            max={999}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full rounded-md bg-background border border-panel-border px-2 py-1.5 font-mono tabular-nums text-sm focus:border-blue-500/50 focus:outline-none"
          />
        </label>
        <label className="block text-xs space-y-1">
          <span className="text-muted">RPE 1-10 (optional)</span>
          <input
            type="number"
            min={1}
            max={10}
            value={rpe}
            onChange={(e) => setRpe(e.target.value)}
            className="w-full rounded-md bg-background border border-panel-border px-2 py-1.5 font-mono tabular-nums text-sm focus:border-blue-500/50 focus:outline-none"
          />
        </label>
      </div>
      <label className="block text-xs space-y-1">
        <span className="text-muted">Notes (optional)</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={200}
          placeholder="how it felt, weight moved, etc."
          className="w-full rounded-md bg-background border border-panel-border px-2 py-1.5 text-sm focus:border-blue-500/50 focus:outline-none"
        />
      </label>
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent-strong hover:bg-accent text-background font-medium text-xs px-3 py-1.5 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="text-xs text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
