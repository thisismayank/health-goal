"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkWorkoutToPlannedSession } from "@/lib/actions";
import { SessionIcon } from "@/components/ui/icons";
import type { SessionCategory } from "@/db/schema";

export function OrphanConfirm({
  workoutId,
  workoutName,
  workoutDate,
  durationMinutes,
  plannedSessionId,
  plannedTitle,
  plannedCategory,
}: {
  workoutId: number;
  workoutName: string;
  workoutDate: string;
  durationMinutes: number | null;
  plannedSessionId: number;
  plannedTitle: string;
  plannedCategory: SessionCategory;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const confirm = () => {
    startTransition(async () => {
      await linkWorkoutToPlannedSession({ workoutId, plannedSessionId });
      router.refresh();
    });
  };

  return (
    <section className="rounded-lg border border-blue-500/30 bg-blue-950/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <SessionIcon
          category={plannedCategory}
          size={14}
          className="text-blue-300"
        />
        <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
          Was this your session?
        </div>
      </div>
      <p className="text-sm leading-snug">
        Your <span className="font-medium">{workoutName}</span> on{" "}
        {niceDate(workoutDate)}
        {durationMinutes != null && (
          <>
            {" "}
            (<span className="tabular-nums">{durationMinutes}</span> min)
          </>
        )}{" "}
        looks like it could be{" "}
        <span className="font-medium">{plannedTitle}</span>.
      </p>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="rounded-md bg-accent-strong hover:bg-accent text-background font-medium text-xs px-3 py-1.5 disabled:opacity-50"
        >
          {pending ? "Linking…" : "Yes, count it"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          disabled={pending}
          className="text-xs text-muted hover:text-foreground"
        >
          Different session
        </button>
      </div>
    </section>
  );
}

function niceDate(ymd: string): string {
  const d = new Date(ymd + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
