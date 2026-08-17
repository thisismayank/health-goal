"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regeneratePlan } from "@/lib/actions";
import type { PlanGoalType } from "@/db/schema";

type Hours = 3 | 5 | 7 | 10;
type Fitness = "new" | "occasional" | "regular" | "active";

type GoalOption = {
  value: PlanGoalType;
  label: string;
  description: string;
  defaultWeeks: number;
};

const HOURS: { value: Hours; label: string }[] = [
  { value: 3, label: "3 h/wk" },
  { value: 5, label: "5 h/wk" },
  { value: 7, label: "7 h/wk" },
  { value: 10, label: "10 h/wk" },
];

const FITNESS: { value: Fitness; label: string }[] = [
  { value: "new", label: "New" },
  { value: "occasional", label: "Occasional" },
  { value: "regular", label: "Regular" },
  { value: "active", label: "Active" },
];

export function RegenerateForm({
  defaultWeeklyHours,
  defaultStartingFitness,
  goalTypes,
}: {
  defaultWeeklyHours: Hours;
  defaultStartingFitness: Fitness;
  goalTypes: GoalOption[];
}) {
  const router = useRouter();
  const [goalType, setGoalType] = useState<PlanGoalType>("mountain_summit");
  const [goalEvent, setGoalEvent] = useState("");
  const [weeklyHours, setWeeklyHours] = useState<Hours>(defaultWeeklyHours);
  const [fitness, setFitness] = useState<Fitness>(defaultStartingFitness);
  const [weeks, setWeeks] = useState<number>(
    goalTypes.find((g) => g.value === "mountain_summit")?.defaultWeeks ?? 12,
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const selected = goalTypes.find((g) => g.value === goalType);

  const pickGoal = (g: PlanGoalType) => {
    setGoalType(g);
    const opt = goalTypes.find((o) => o.value === g);
    if (opt) setWeeks(opt.defaultWeeks);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    startTransition(async () => {
      try {
        const r = await regeneratePlan({
          goalType,
          goalEvent: goalEvent.trim() || undefined,
          weeklyHours,
          startingFitness: fitness,
          weeks,
        });
        setOk(`Plan created — ${r.sessions} sessions.`);
        setTimeout(() => router.push("/train"), 800);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-panel-border bg-panel p-4 space-y-4"
    >
      <fieldset className="space-y-2">
        <legend className="text-[10px] font-mono uppercase tracking-widest text-muted">
          Goal
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {goalTypes.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => pickGoal(g.value)}
              className={`text-left rounded-md border px-3 py-2 transition ${
                goalType === g.value
                  ? "border-blue-400 bg-blue-950/40"
                  : "border-panel-border bg-background/40 hover:border-blue-500/40"
              }`}
            >
              <div className="text-sm font-medium">{g.label}</div>
              <div className="text-[11px] text-muted mt-0.5 leading-snug">
                {g.description}
              </div>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block space-y-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
          Event / target (optional)
        </span>
        <input
          value={goalEvent}
          onChange={(e) => setGoalEvent(e.target.value)}
          placeholder='e.g. "Rainier via DC — Jul 2027" or "sub-25 5k"'
          maxLength={120}
          className="w-full rounded-md bg-background border border-panel-border px-3 py-2 text-sm focus:border-blue-500/50 focus:outline-none"
        />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <fieldset className="space-y-1 col-span-1">
          <legend className="text-[10px] font-mono uppercase tracking-widest text-muted">
            Weeks
          </legend>
          <input
            type="number"
            min={2}
            max={80}
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="w-full rounded-md bg-background border border-panel-border px-3 py-2 text-sm font-mono tabular-nums focus:border-blue-500/50 focus:outline-none"
          />
          <p className="text-[10px] text-muted">
            default {selected?.defaultWeeks}
          </p>
        </fieldset>

        <fieldset className="space-y-1 col-span-2">
          <legend className="text-[10px] font-mono uppercase tracking-widest text-muted">
            Weekly time
          </legend>
          <div className="grid grid-cols-4 gap-1">
            {HOURS.map((h) => (
              <button
                key={h.value}
                type="button"
                onClick={() => setWeeklyHours(h.value)}
                className={`rounded-md border px-2 py-1.5 text-xs font-medium ${
                  weeklyHours === h.value
                    ? "border-blue-400 bg-blue-950/40 text-blue-200"
                    : "border-panel-border bg-background/40 text-muted"
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <fieldset className="space-y-1">
        <legend className="text-[10px] font-mono uppercase tracking-widest text-muted">
          Starting fitness
        </legend>
        <div className="grid grid-cols-4 gap-1">
          {FITNESS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFitness(f.value)}
              className={`rounded-md border px-2 py-1.5 text-xs font-medium ${
                fitness === f.value
                  ? "border-blue-400 bg-blue-950/40 text-blue-200"
                  : "border-panel-border bg-background/40 text-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {ok && <p className="text-sm text-accent">{ok}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent-strong hover:bg-accent text-background font-medium px-4 py-2.5 disabled:opacity-50"
      >
        {pending ? "Building…" : "Replace my plan →"}
      </button>
    </form>
  );
}
