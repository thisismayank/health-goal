"use client";

import { useState } from "react";
import { SkipButton } from "@/components/session-actions";

/**
 * Collapsible manual-log panel.
 *
 * Design intent: Strava auto-sync is the primary path for logging a
 * workout (do the workout → Strava webhook fires → session auto-
 * completes). The manual form is a fallback. It should be one tap
 * away, not the dominant UI element.
 *
 * Skip is tertiary — reachable, but not visually competing with the
 * hero card.
 */
export function LogPanel({
  plannedSessionId,
  children,
}: {
  plannedSessionId: number;
  children: React.ReactNode; // the LogSessionForm, rendered on the server
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-panel-border bg-panel/40 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 text-sm font-medium text-blue-300 hover:text-blue-200 transition"
        >
          <span
            className={`inline-block text-xs transition-transform ${open ? "rotate-90" : ""}`}
          >
            ▸
          </span>
          {open ? "Hide manual log" : "Log manually"}
        </button>

        {!open && (
          <span className="hidden sm:inline text-xs text-muted">
            or wait for Strava to sync it
          </span>
        )}

        <div className="ml-auto">
          <SkipButton plannedSessionId={plannedSessionId} />
        </div>
      </div>

      {open && (
        <div className="border-t border-panel-border p-4 bg-background/40 space-y-4">
          <p className="text-xs text-muted">
            Only needed if you're not using Strava sync (or want to log
            immediately without waiting).
          </p>
          {children}
        </div>
      )}
    </div>
  );
}
