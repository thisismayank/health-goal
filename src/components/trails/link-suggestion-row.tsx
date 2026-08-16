"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  linkWorkoutToPreset,
  linkWorkoutToSavedTrail,
} from "@/lib/actions";

type SavedTrailSuggestion = {
  trailId: number;
  trailName: string;
  score: number;
};

type PresetSuggestion = {
  slug: string;
  name: string;
  region: string;
  score: number;
};

export function LinkSuggestionRow({
  workoutId,
  workoutName,
  workoutDateLabel,
  workoutDetail,
  savedMatches,
  presetMatches,
}: {
  workoutId: number;
  workoutName: string;
  workoutDateLabel: string;
  workoutDetail: string;
  savedMatches: SavedTrailSuggestion[];
  presetMatches: PresetSuggestion[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [linked, setLinked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const linkSaved = (trailId: number, trailName: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await linkWorkoutToSavedTrail({ workoutId, trailId });
        setLinked(trailName);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to link");
      }
    });
  };

  const linkPreset = (slug: string, name: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await linkWorkoutToPreset({ workoutId, presetSlug: slug });
        setLinked(name);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to link");
      }
    });
  };

  if (linked) {
    return (
      <div className="rounded-md border border-accent/40 bg-accent-strong/5 px-4 py-3">
        <div className="text-sm">
          <span className="text-accent font-mono">✓</span>{" "}
          <span className="font-medium">{workoutName}</span>{" "}
          <span className="text-muted">→ {linked}</span>
        </div>
        <div className="text-[10px] text-muted mt-0.5">
          Stamped in your passport.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-panel-border bg-panel p-4 space-y-3">
      <div>
        <div className="text-sm font-medium truncate">{workoutName}</div>
        <div className="text-xs text-muted">
          {workoutDateLabel} · {workoutDetail}
        </div>
      </div>

      <div className="space-y-1.5">
        {savedMatches.map((s) => (
          <button
            key={`saved-${s.trailId}`}
            type="button"
            disabled={pending}
            onClick={() => linkSaved(s.trailId, s.trailName)}
            className="w-full text-left rounded-md border border-blue-500/40 bg-blue-950/20 px-3 py-2 flex items-center justify-between gap-2 hover:border-blue-400 transition disabled:opacity-50"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-blue-300">
                MATCH · YOUR TRAIL
              </div>
              <div className="text-sm truncate">{s.trailName}</div>
            </div>
            <span className="text-xs text-accent whitespace-nowrap">
              Link ✓
            </span>
          </button>
        ))}

        {presetMatches.map((p) => (
          <button
            key={`preset-${p.slug}`}
            type="button"
            disabled={pending}
            onClick={() => linkPreset(p.slug, p.name)}
            className="w-full text-left rounded-md border border-panel-border bg-background/40 px-3 py-2 flex items-center justify-between gap-2 hover:border-blue-500/40 transition disabled:opacity-50"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted">
                LIBRARY · {p.region}
              </div>
              <div className="text-sm truncate">{p.name}</div>
            </div>
            <span className="text-xs text-blue-300 whitespace-nowrap">
              Save + link →
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="text-[10px] text-muted pt-1">
        Not a match?{" "}
        <Link
          href="/trails"
          className="text-blue-300 hover:underline"
        >
          Search the library
        </Link>{" "}
        and log the completion from the trail's page.
      </div>
    </div>
  );
}
