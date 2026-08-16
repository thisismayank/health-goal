import Link from "next/link";
import { ReopenButton } from "@/components/session-actions";
import { estimatedVerticalMeters, metersToFeet } from "@/lib/basecamp/summit";
import type { PlannedSession, Workout } from "@/db/schema";

export function RecapHero({
  session,
  workout,
  freshMinutesAgo,
}: {
  session: PlannedSession;
  workout: Workout;
  freshMinutesAgo: number;
}) {
  const actualMin =
    workout.durationSeconds != null
      ? Math.round(workout.durationSeconds / 60)
      : null;
  const targetMin = session.targetDurationMinutes;
  const overPct =
    actualMin != null && targetMin != null && targetMin > 0
      ? Math.round((actualMin / targetMin) * 100)
      : null;

  const est = estimatedVerticalMeters(workout);
  const vertFt = metersToFeet(est.meters);

  const freshLabel =
    freshMinutesAgo < 5
      ? "just now"
      : freshMinutesAgo < 60
        ? `${freshMinutesAgo} min ago`
        : `${Math.round(freshMinutesAgo / 60)}h ago`;

  return (
    <section className="rounded-lg border border-accent/50 bg-accent-strong/5 shadow-lg shadow-accent/20 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-mono uppercase tracking-widest text-accent">
            [QUEST COMPLETE]
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted mt-1">
            synced {freshLabel} · {session.sessionCategory.replaceAll("_", " ").toLowerCase()}
          </div>
          <h2 className="text-xl font-medium mt-1 leading-tight">
            {session.title}
          </h2>
        </div>
        <div className="text-right shrink-0">
          {overPct != null && (
            <div className="text-2xl font-mono font-semibold text-accent tabular-nums leading-none">
              {overPct}%
            </div>
          )}
          <div className="text-[10px] uppercase tracking-wider text-muted mt-0.5">
            of target
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <RecapStat
          label="Duration"
          value={actualMin != null ? `${actualMin} min` : "—"}
        />
        {vertFt > 0 && (
          <RecapStat
            label="Vertical"
            value={`+${vertFt.toLocaleString()} ft`}
            hint={est.source === "gps" ? "GPS" : "estimated"}
          />
        )}
        {workout.distanceMeters != null && workout.distanceMeters > 0 && (
          <RecapStat
            label="Distance"
            value={`${(workout.distanceMeters / 1000).toFixed(2)} km`}
          />
        )}
        {workout.rpe != null && <RecapStat label="RPE" value={`${workout.rpe}`} />}
      </div>

      <p className="text-sm leading-relaxed text-foreground/90">
        Quest cleared. Your stats and trail readiness have updated.
      </p>

      <div className="pt-3 border-t border-accent/20 flex items-center justify-between gap-2">
        <Link
          href="/progress"
          className="text-xs text-accent hover:underline font-medium"
        >
          See what changed →
        </Link>
        <ReopenButton plannedSessionId={session.id} />
      </div>
    </section>
  );
}

function RecapStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded border border-panel-border bg-background/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="text-sm font-medium mt-0.5 tabular-nums">{value}</div>
      {hint && <div className="text-[9px] text-muted mt-0.5">{hint}</div>}
    </div>
  );
}
