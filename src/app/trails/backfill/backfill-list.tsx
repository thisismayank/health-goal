"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkWorkoutToPreset } from "@/lib/actions";
import type { Workout } from "@/db/schema";
import type { TrailMatchCandidate } from "@/lib/basecamp/trail-matcher";
import { formatDistance, formatElevation, type Units } from "@/lib/units";

type Item = { workout: Workout; matches: TrailMatchCandidate[] };

export function BackfillList({
  items,
  units,
}: {
  items: Item[];
  units: Units;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <BackfillRow key={item.workout.id} item={item} units={units} />
      ))}
    </div>
  );
}

function BackfillRow({ item, units }: { item: Item; units: Units }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    "idle" | "linking" | "linked" | "dismissed" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [linkedTo, setLinkedTo] = useState<string | null>(null);

  const confirm = (presetSlug: string, presetName: string) => {
    setError(null);
    setStatus("linking");
    startTransition(async () => {
      try {
        await linkWorkoutToPreset({
          workoutId: item.workout.id,
          presetSlug,
        });
        setStatus("linked");
        setLinkedTo(presetName);
        router.refresh();
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Failed to link");
      }
    });
  };

  const dismiss = () => setStatus("dismissed");

  if (status === "linked") {
    return (
      <div className="rounded-lg border border-accent/50 bg-accent-strong/5 p-4 text-sm">
        <span className="text-accent font-mono">✓</span> Linked to{" "}
        <strong>{linkedTo}</strong>
      </div>
    );
  }

  if (status === "dismissed") return null;

  const w = item.workout;
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-4 space-y-3">
      <header className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium truncate">
            {w.sourceName ?? "(unnamed activity)"}
          </div>
          <div className="text-[11px] text-muted mt-0.5">
            {formatDate(w.startTime)}
            {w.distanceMeters != null && (
              <>
                {" · "}
                <span className="tabular-nums">
                  {formatDistance(w.distanceMeters, units)}
                </span>
              </>
            )}
            {w.elevationGainMeters != null && (
              <>
                {" · +"}
                <span className="tabular-nums">
                  {formatElevation(w.elevationGainMeters, units)}
                </span>
              </>
            )}
            {w.durationSeconds != null && (
              <>
                {" · "}
                <span className="tabular-nums">
                  {formatDuration(w.durationSeconds)}
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="space-y-1.5">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted">
          Suggestions
        </div>
        {item.matches.map((m, i) => (
          <div
            key={m.preset.slug}
            className="rounded-md border border-panel-border bg-background/40 p-3 flex items-baseline justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">
                {m.preset.name}
                {i === 0 && (
                  <span className="ml-2 text-[10px] font-mono uppercase tracking-wider text-accent">
                    top
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted mt-0.5">
                {m.preset.region}
                {m.distanceKm < 100 && (
                  <>
                    {" · "}
                    <span className="tabular-nums">
                      {m.distanceKm.toFixed(1)} km from trailhead
                    </span>
                  </>
                )}
                {" · "}
                <span
                  className={
                    m.totalScore >= 0.7
                      ? "text-accent"
                      : m.totalScore >= 0.45
                        ? "text-blue-300/80"
                        : "text-muted"
                  }
                  title={`Overall ${Math.round(m.totalScore * 100)}/100 · name ${Math.round(m.nameScore * 100)} · profile ${Math.round(m.profileScore * 100)}`}
                >
                  {confidenceLabel(m.totalScore)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => confirm(m.preset.slug, m.preset.name)}
              disabled={pending}
              className="text-xs rounded-md bg-accent-strong hover:bg-accent text-background font-medium px-3 py-1.5 whitespace-nowrap disabled:opacity-50"
            >
              {pending && status === "linking" ? "…" : "This one"}
            </button>
          </div>
        ))}
      </div>

      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-muted hover:text-foreground"
        >
          Not a hike / skip
        </button>
      </div>
    </div>
  );
}

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

// Devin r2: "score 26" vs "score 69" was opaque — is 69 good? What's
// the threshold to trust the top match? Convert to a plain label with
// the numeric breakdown hidden in the tooltip for anyone curious.
function confidenceLabel(score: number): string {
  if (score >= 0.7) return "strong match";
  if (score >= 0.45) return "likely match";
  return "possible match";
}
