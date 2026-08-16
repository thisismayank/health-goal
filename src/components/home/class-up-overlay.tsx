"use client";

import { useState } from "react";
import Link from "next/link";
import type { ClassChange } from "@/lib/basecamp/class-tracker";

/**
 * Full-screen celebration modal when the user's Hiker Class ticks up.
 * Server has already persisted lastKnownClass, so this fires ONCE on
 * the next home visit after the change. Dismissed → hides for the
 * session; won't refire until the class changes again.
 */
export function ClassUpOverlay({ change }: { change: ClassChange }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-background/90 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setDismissed(true)}
    >
      <div
        className="max-w-sm w-full rounded-lg border border-blue-400/60 bg-blue-950/40 shadow-2xl shadow-blue-500/30 p-6 space-y-5 rank-up-pulse"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-2">
          <div className="text-xs font-mono uppercase tracking-widest text-blue-300">
            [CLASS UP]
          </div>
          <div className="flex items-baseline justify-center gap-3 font-mono">
            <span className="text-4xl font-semibold text-muted line-through decoration-1">
              {change.from}
            </span>
            <span className="text-3xl text-blue-300">→</span>
            <span className="text-6xl font-semibold text-blue-300">
              {change.to}
            </span>
          </div>
          <h2 className="text-lg font-medium">
            You're a{isVowel(change.toLabel) ? "n" : ""}{" "}
            <span className="text-blue-300">{change.toLabel}</span> now.
          </h2>
        </div>

        {change.newUnlocks.length > 0 && (
          <div className="rounded-md border border-blue-500/30 bg-background/40 p-4 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-blue-300">
              [NEWLY IN REACH]
            </div>
            <ul className="space-y-1.5 text-sm">
              {change.newUnlocks.slice(0, 4).map((u, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-blue-400 shrink-0">✓</span>
                  <span className="text-foreground/90">{u}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Link
            href="/trails/discover"
            onClick={() => setDismissed(true)}
            className="w-full rounded-md bg-accent-strong text-background font-medium px-4 py-3 hover:bg-accent transition text-center"
          >
            See what's now in reach →
          </Link>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-xs text-muted hover:text-foreground transition"
          >
            Awesome — dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

function isVowel(label: string): boolean {
  return /^[aeiou]/i.test(label);
}
