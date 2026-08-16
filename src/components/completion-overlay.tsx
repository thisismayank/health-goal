"use client";

import { useEffect, useState } from "react";
import type { CompletionSummary } from "@/lib/actions";

export function CompletionOverlay({
  summary,
  onDismiss,
}: {
  summary: CompletionSummary;
  onDismiss: () => void;
}) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Dismiss on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const waypoint = summary.waypointCleared;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm transition-opacity duration-200 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      onClick={onDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-md border border-blue-500/40 bg-blue-950/40 shadow-2xl shadow-blue-500/20 p-6 space-y-5 transition-all duration-300 ${
          entered ? "translate-y-0 scale-100" : "translate-y-2 scale-95"
        }`}
      >
        <div className="flex items-baseline justify-between">
          <div className="text-xs font-mono uppercase tracking-widest text-blue-400">
            [QUEST COMPLETE]
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="text-muted hover:text-foreground text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-muted">
            {summary.categoryDisplay}
          </div>
          <h2 className="text-lg font-medium mt-1">{summary.sessionTitle}</h2>
          <div className="text-sm text-muted mt-1">
            {summary.actualDurationMinutes} min · RPE {summary.rpe}
          </div>
        </div>

        <div className="border-t border-blue-500/20 pt-4 space-y-2 text-sm font-mono">
          {summary.verticalGainedFt > 0 && (
            <div className="flex justify-between">
              <span className="text-muted">Vertical</span>
              <span className="text-blue-300 tabular-nums">
                +{summary.verticalGainedFt.toLocaleString()} ft
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted">To Rainier</span>
            <span className="text-blue-300 tabular-nums">
              {summary.newTotalFt.toLocaleString()} ft
            </span>
          </div>
          {summary.summitCount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted">Summits climbed</span>
              <span className="text-blue-300 tabular-nums">
                x{summary.summitCount}
              </span>
            </div>
          )}
        </div>

        {waypoint && (
          <div
            className={`rounded-sm border border-blue-400/60 bg-blue-500/15 p-4 text-center space-y-1 transition-all duration-500 delay-200 ${
              entered ? "opacity-100 scale-100" : "opacity-0 scale-90"
            }`}
          >
            <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
              [WAYPOINT CLEARED]
            </div>
            <div className="text-lg font-medium text-blue-200">{waypoint.name}</div>
            <div className="text-xs text-muted">
              {waypoint.ft.toLocaleString()} ft · {waypoint.description}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onDismiss}
          className="w-full rounded-sm border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-200 font-mono uppercase text-xs tracking-widest py-3"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
