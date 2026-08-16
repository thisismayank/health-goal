"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  completeSession,
  type CompletionSummary,
  type LoggedExercise,
} from "@/lib/actions";
import { CompletionOverlay } from "./completion-overlay";

type PrescribedExercise = { name: string; sets: number; reps: string };

type Props = {
  plannedSessionId: number;
  defaultDurationMinutes: number | null;
  defaultRpeMin: number | null;
  defaultRpeMax: number | null;
  prescription: PrescribedExercise[] | null;
  prevSetsByExercise: Record<
    string,
    { reps: number | null; weightKg: number | null }[]
  >;
};

type LocalSet = { reps: string; weightKg: string };
type LocalExercise = { name: string; sets: LocalSet[] };

export function LogSessionForm({
  plannedSessionId,
  defaultDurationMinutes,
  defaultRpeMin,
  defaultRpeMax,
  prescription,
  prevSetsByExercise,
}: Props) {
  const [duration, setDuration] = useState(String(defaultDurationMinutes ?? 30));
  const [rpe, setRpe] = useState(
    String(defaultRpeMax ?? defaultRpeMin ?? 5),
  );
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<LocalExercise[]>(
    (prescription ?? []).map((ex) => ({
      name: ex.name,
      sets: Array.from({ length: ex.sets }, () => ({ reps: "", weightKg: "" })),
    })),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<CompletionSummary | null>(null);
  const router = useRouter();

  const updateSet = (
    exIdx: number,
    setIdx: number,
    field: keyof LocalSet,
    value: string,
  ) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== exIdx
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, [field]: value } : s)),
            },
      ),
    );
  };

  const addSet = (exIdx: number) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== exIdx ? ex : { ...ex, sets: [...ex.sets, { reps: "", weightKg: "" }] },
      ),
    );
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== exIdx
          ? ex
          : { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) },
      ),
    );
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const durationMin = Number(duration);
    const rpeNum = Number(rpe);
    if (!Number.isFinite(durationMin) || durationMin <= 0) {
      setError("Duration must be a positive number.");
      return;
    }
    if (!Number.isFinite(rpeNum) || rpeNum < 1 || rpeNum > 10) {
      setError("RPE must be between 1 and 10.");
      return;
    }

    const loggedExercises: LoggedExercise[] = exercises.map((ex) => ({
      name: ex.name,
      sets: ex.sets.map((s) => ({
        reps: s.reps === "" ? null : Number(s.reps),
        weightKg: s.weightKg === "" ? null : Number(s.weightKg),
        rir: null,
      })),
    }));

    startTransition(async () => {
      try {
        const result = await completeSession({
          plannedSessionId,
          actualDurationMinutes: durationMin,
          rpe: rpeNum,
          notes: notes.trim() || undefined,
          exercises: loggedExercises.length > 0 ? loggedExercises : undefined,
        });
        setCompletion(result.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  };

  const dismissCompletion = () => {
    setCompletion(null);
    router.refresh();
  };

  return (
    <>
    {completion && (
      <CompletionOverlay summary={completion} onDismiss={dismissCompletion} />
    )}
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wider text-muted">
            Duration (min)
          </span>
          <input
            type="number"
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full rounded-md bg-panel border border-panel-border px-3 py-2 text-lg"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wider text-muted">
            RPE 1–10
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            value={rpe}
            onChange={(e) => setRpe(e.target.value)}
            className="w-full rounded-md bg-panel border border-panel-border px-3 py-2 text-lg"
          />
        </label>
      </div>

      {exercises.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs uppercase tracking-wider text-muted">
            Strength
          </h3>
          {exercises.map((ex, exIdx) => {
            const prev = prevSetsByExercise[ex.name] ?? [];
            return (
              <div
                key={ex.name + exIdx}
                className="rounded-md border border-panel-border bg-panel p-3 space-y-2"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{ex.name}</span>
                  {prev.length > 0 && (
                    <span className="text-xs text-muted">
                      last:{" "}
                      {prev
                        .map((s) =>
                          `${s.reps ?? "–"}×${s.weightKg ?? "–"}kg`,
                        )
                        .join(", ")}
                    </span>
                  )}
                </div>
                {ex.sets.map((s, setIdx) => {
                  const prevSet = prev[setIdx];
                  return (
                    <div
                      key={setIdx}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="w-8 text-muted">#{setIdx + 1}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder={
                          prevSet?.reps != null ? String(prevSet.reps) : "reps"
                        }
                        value={s.reps}
                        onChange={(e) =>
                          updateSet(exIdx, setIdx, "reps", e.target.value)
                        }
                        className="w-20 rounded bg-background border border-panel-border px-2 py-1"
                      />
                      <span className="text-muted">×</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        placeholder={
                          prevSet?.weightKg != null
                            ? String(prevSet.weightKg)
                            : "kg"
                        }
                        value={s.weightKg}
                        onChange={(e) =>
                          updateSet(exIdx, setIdx, "weightKg", e.target.value)
                        }
                        className="w-24 rounded bg-background border border-panel-border px-2 py-1"
                      />
                      <span className="text-muted text-xs">kg</span>
                      {ex.sets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSet(exIdx, setIdx)}
                          className="ml-auto text-xs text-muted hover:text-danger"
                          aria-label="Remove set"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => addSet(exIdx)}
                  className="text-xs text-accent hover:text-accent-strong"
                >
                  + add set
                </button>
              </div>
            );
          })}
        </div>
      )}

      <label className="block space-y-1.5">
        <span className="text-xs uppercase tracking-wider text-muted">
          Notes
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="How did it feel? Any pain, fatigue, wins?"
          className="w-full rounded-md bg-panel border border-panel-border px-3 py-2"
        />
      </label>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent-strong hover:bg-accent text-background font-medium py-3 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Log workout"}
      </button>
    </form>
    </>
  );
}
