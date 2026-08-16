"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTrailCompletion, logTrailCompletion } from "@/lib/actions";

export function LogCompletionForm({
  trailId,
  todayYmd,
}: {
  trailId: number;
  todayYmd: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayYmd);
  const [timeH, setTimeH] = useState("");
  const [timeM, setTimeM] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const h = timeH === "" ? 0 : Number(timeH);
    const m = timeM === "" ? 0 : Number(timeM);
    const totalMin = h * 60 + m;
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0) {
      setError("Time must be non-negative.");
      return;
    }
    startTransition(async () => {
      try {
        await logTrailCompletion({
          trailId,
          completedAt: date,
          timeMinutes: totalMin > 0 ? totalMin : undefined,
          notes: notes.trim() || undefined,
        });
        setOpen(false);
        setTimeH("");
        setTimeM("");
        setNotes("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to log");
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-accent/50 bg-accent-strong/10 text-accent px-4 py-2 text-sm font-medium hover:bg-accent-strong/20 transition"
      >
        ✓ I've done this
      </button>
    );
  }

  return (
    <div className="rounded-md border border-accent/40 bg-accent-strong/5 p-4 space-y-3">
      <div className="text-xs font-mono uppercase tracking-widest text-accent">
        [LOG COMPLETION]
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-muted">
            Date
          </span>
          <input
            type="date"
            value={date}
            max={todayYmd}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md bg-panel border border-panel-border px-3 py-2 text-sm"
          />
        </label>
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-muted">
            Time (optional)
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              inputMode="numeric"
              placeholder="h"
              value={timeH}
              onChange={(e) => setTimeH(e.target.value)}
              className="w-full rounded-md bg-panel border border-panel-border px-2 py-2 text-sm text-center"
              min={0}
              max={72}
            />
            <span className="text-muted text-xs">:</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="m"
              value={timeM}
              onChange={(e) => setTimeM(e.target.value)}
              className="w-full rounded-md bg-panel border border-panel-border px-2 py-2 text-sm text-center"
              min={0}
              max={59}
            />
          </div>
        </div>
      </div>
      <label className="block space-y-1">
        <span className="text-[10px] uppercase tracking-widest text-muted">
          Notes (optional)
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How did it go? Conditions, highlights, anything to remember."
          rows={2}
          className="w-full rounded-md bg-panel border border-panel-border px-3 py-2 text-sm resize-y"
        />
      </label>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded-md border border-panel-border px-3 py-2 text-sm text-muted hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-accent-strong text-background font-medium px-4 py-2 text-sm hover:bg-accent transition disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save completion"}
        </button>
      </div>
    </div>
  );
}

export function DeleteCompletionButton({ id }: { id: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove this completion?")) return;
        startTransition(async () => {
          await deleteTrailCompletion(id);
          router.refresh();
        });
      }}
      className="text-[10px] text-muted hover:text-danger transition disabled:opacity-50"
    >
      {pending ? "…" : "Remove"}
    </button>
  );
}
