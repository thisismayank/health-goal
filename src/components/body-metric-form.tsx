"use client";

import { useState, useTransition } from "react";
import { logBodyMetric } from "@/lib/actions";

type Props = {
  dateYmd: string;
  currentWeightKg: number | null;
  currentFatigue: number | null;
};

export function BodyMetricForm({
  dateYmd,
  currentWeightKg,
  currentFatigue,
}: Props) {
  const [weight, setWeight] = useState(
    currentWeightKg != null ? String(currentWeightKg) : "",
  );
  const [fatigue, setFatigue] = useState(
    currentFatigue != null ? String(currentFatigue) : "",
  );
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      await logBodyMetric({
        date: dateYmd,
        weightKg: weight === "" ? null : Number(weight),
        fatigue: fatigue === "" ? null : Number(fatigue),
        notes: notes.trim() || null,
      });
      setNotes("");
      setSavedAt(Date.now());
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wider text-muted">
            Weight (kg)
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full rounded-md bg-panel border border-panel-border px-3 py-2 text-lg"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wider text-muted">
            Fatigue 1–10
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            value={fatigue}
            onChange={(e) => setFatigue(e.target.value)}
            className="w-full rounded-md bg-panel border border-panel-border px-3 py-2 text-lg"
          />
        </label>
      </div>
      <label className="block space-y-1.5">
        <span className="text-xs uppercase tracking-wider text-muted">
          Notes
        </span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Sore, well-rested, sick, hungover…"
          className="w-full rounded-md bg-panel border border-panel-border px-3 py-2"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent-strong hover:bg-accent text-background font-medium px-4 py-2 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {savedAt && !pending && (
          <span className="text-xs text-accent">Saved</span>
        )}
      </div>
    </form>
  );
}
