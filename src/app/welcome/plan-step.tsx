"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finishOnboardingWithPlan } from "@/lib/actions";

type Hours = 3 | 5 | 7 | 10;
type Fitness = "new" | "occasional" | "regular" | "active";

const HOURS_OPTIONS: { value: Hours; label: string; sub: string }[] = [
  { value: 3, label: "3 hrs / week", sub: "3 sessions · start of a habit" },
  { value: 5, label: "5 hrs / week", sub: "4 sessions · classic weekend-warrior" },
  { value: 7, label: "7 hrs / week", sub: "5 sessions · serious build" },
  { value: 10, label: "10+ hrs / week", sub: "6 sessions · big trips ahead" },
];

const FITNESS_OPTIONS: { value: Fitness; label: string; sub: string }[] = [
  { value: "new", label: "New to fitness", sub: "Little or no training the last few months" },
  { value: "occasional", label: "Occasional", sub: "A hike or workout here and there" },
  { value: "regular", label: "Regular", sub: "Training most weeks — mixed cardio + strength" },
  { value: "active", label: "Active athlete", sub: "Consistently training hard for a goal" },
];

export function PlanStep({
  stravaConnected,
  suggestedFitness,
}: {
  stravaConnected: boolean;
  suggestedFitness: Fitness | null;
}) {
  const router = useRouter();
  const [hours, setHours] = useState<Hours | null>(null);
  const [fitness, setFitness] = useState<Fitness | null>(suggestedFitness);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canSubmit = hours != null && fitness != null && !pending;

  const submit = () => {
    if (!hours || !fitness) return;
    setError(null);
    startTransition(async () => {
      try {
        await finishOnboardingWithPlan({
          weeklyHours: hours,
          startingFitness: fitness,
        });
        router.replace("/");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2 text-center">
        <div className="text-xs font-mono uppercase tracking-widest text-blue-400">
          [YOUR PLAN]
        </div>
        <h1 className="text-2xl font-semibold">How much time can you train?</h1>
        <p className="text-sm text-muted leading-relaxed max-w-md mx-auto">
          We'll build you a 12-week plan sized to your time budget.
          Realistic beats aspirational — pick what fits your real week.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-[10px] font-mono uppercase tracking-widest text-muted mb-1">
          Weekly training time
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {HOURS_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setHours(o.value)}
              className={`text-left rounded-md border px-3 py-2.5 transition ${
                hours === o.value
                  ? "border-blue-400 bg-blue-950/40"
                  : "border-panel-border bg-panel hover:border-blue-500/40"
              }`}
            >
              <div className="text-sm font-medium">{o.label}</div>
              <div className="text-[11px] text-muted mt-0.5">{o.sub}</div>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-[10px] font-mono uppercase tracking-widest text-muted mb-1">
          Where are you starting?
        </legend>
        {suggestedFitness ? (
          <p className="text-[11px] text-blue-300/90">
            Pre-selected from your recent activity — change if it feels off.
          </p>
        ) : stravaConnected ? (
          <p className="text-[11px] text-blue-300/90">
            We'll refine this as your Strava history syncs in.
          </p>
        ) : null}
        <div className="space-y-2">
          {FITNESS_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setFitness(o.value)}
              className={`w-full text-left rounded-md border px-3 py-2.5 transition ${
                fitness === o.value
                  ? "border-blue-400 bg-blue-950/40"
                  : "border-panel-border bg-panel hover:border-blue-500/40"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-sm font-medium">{o.label}</div>
                <div className="text-[11px] text-muted">{o.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col items-center gap-3 pt-2">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="w-full sm:w-auto sm:min-w-[280px] rounded-md bg-accent-strong text-background font-medium px-6 py-3 hover:bg-accent transition disabled:opacity-50 text-center"
        >
          {pending ? "Building your plan…" : "Build my plan + enter →"}
        </button>
        <p className="text-[11px] text-muted">
          Starting week 1 today, ramped to your level. You can tune it later.
        </p>
      </div>
    </div>
  );
}
