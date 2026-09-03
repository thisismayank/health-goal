"use client";

import { useState, useTransition } from "react";
import { updateTrail } from "@/lib/actions";
import type { Trail } from "@/db/schema";

export function TrailEditForm({ trail: t }: { trail: Trail }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(t.name);
  const [packLb, setPackLb] = useState(String(t.packWeightLb));
  const [targetDate, setTargetDate] = useState(t.targetDate ?? "");
  const [notes, setNotes] = useState(t.notes ?? "");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const pack = Number(packLb);
    if (!Number.isFinite(pack) || pack < 0) {
      setError("Pack weight must be a non-negative number.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await updateTrail({
          trailId: t.id,
          name,
          packWeightLb: pack,
          targetDate: targetDate || null,
          notes,
        });
        // Server action now returns a Result — validation errors are
        // NOT thrown so they don't hit Next.js's prod error-digest
        // scrubber (Devin r4: users saw "Minified React error #441"
        // instead of "Target date year 2099 is out of range").
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setOpen(false);
        // router.refresh() alone rendered stale for a beat post-save
        // (Devin r4 minor: "No target date set" showing after a
        // successful save until reload). Hard reload is heavier but
        // reliably shows the new state.
        window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update");
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted hover:text-blue-300"
      >
        Edit
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 border-t border-panel-border pt-4 mt-2">
      <div className="text-xs uppercase tracking-widest text-muted">Edit trail</div>

      <label className="block space-y-1">
        <span className="text-xs text-muted">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md bg-panel border border-panel-border px-3 py-2 text-sm"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-xs text-muted">Pack weight (lb)</span>
          <input
            type="number"
            step="0.5"
            min="0"
            value={packLb}
            onChange={(e) => setPackLb(e.target.value)}
            className="w-full rounded-md bg-panel border border-panel-border px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted">Target date</span>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full rounded-md bg-panel border border-panel-border px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-muted">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-md bg-panel border border-panel-border px-3 py-2 text-sm"
        />
      </label>

      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent-strong hover:bg-accent text-background text-sm font-medium px-4 py-1.5 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-panel-border text-muted text-sm px-4 py-1.5"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
