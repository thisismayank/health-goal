import Link from "next/link";
import { ReopenButton } from "@/components/session-actions";
import { estimatedVerticalMeters, metersToFeet } from "@/lib/basecamp/summit";
import type {
  CompletionDelta,
  StatDelta,
  TrailVerdictDelta,
} from "@/lib/basecamp/completion-delta";
import type { PlannedSession, Workout } from "@/db/schema";

export function RecapHero({
  session,
  workout,
  freshMinutesAgo,
  delta,
}: {
  session: PlannedSession;
  workout: Workout;
  freshMinutesAgo: number;
  delta: CompletionDelta | null;
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

  const movedStats = delta?.stats.filter((s) => s.delta !== 0) ?? [];
  const changedTrails = delta?.trails.filter((t) => t.changed) ?? [];
  const rankTiered = delta?.rank.tiered ?? false;
  const rankProgressMoved =
    delta != null &&
    delta.rank.beforeProgressPct !== delta.rank.afterProgressPct;

  return (
    <section className="relative rounded-lg border border-accent/50 bg-accent-strong/5 shadow-lg shadow-accent/20 p-5 space-y-4 recap-glow">
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

      {rankTiered && delta && (
        <div className="rounded-md border border-blue-400/60 bg-blue-950/40 px-4 py-3 flex items-center gap-3 rank-up-pulse">
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-3xl font-semibold text-muted line-through decoration-1">
              {delta.rank.before}
            </span>
            <span className="text-2xl text-blue-300">→</span>
            <span className="text-4xl font-semibold text-blue-300">
              {delta.rank.after}
            </span>
          </div>
          <div className="text-xs">
            <div className="text-[10px] font-mono uppercase tracking-widest text-blue-300">
              [RANK UP]
            </div>
            <div className="text-muted">You crossed a benchmark. New tier unlocked.</div>
          </div>
        </div>
      )}

      {delta && (
        <div className="space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-accent border-t border-accent/20 pt-3">
            [SYSTEM · CHANGES]
          </div>

          {movedStats.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {delta.stats.map((s) => (
                <StatDeltaCell key={s.key} stat={s} />
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted italic">
              Stats stable — this session held the line without shifting scores.
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <DeltaCell
              label="Summit progress"
              detail={
                delta.summit.deltaFt > 0
                  ? `+${delta.summit.deltaFt.toLocaleString()} ft`
                  : "no vertical this session"
              }
              hint={`${delta.summit.afterFt.toLocaleString()} / ${delta.summit.goalLabel}`}
              active={delta.summit.deltaFt > 0}
            />
            {!rankTiered && rankProgressMoved && delta.rank.nextRank && (
              <DeltaCell
                label={`To Rank ${delta.rank.nextRank}`}
                detail={`${delta.rank.beforeProgressPct}% → ${delta.rank.afterProgressPct}%`}
                active
              />
            )}
          </div>

          {changedTrails.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-accent">
                Trail readiness shifted
              </div>
              {changedTrails.map((t) => (
                <TrailVerdictRow key={t.trailId} trail={t} />
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-sm leading-relaxed text-foreground/80">
        Quest cleared. {rankTiered
          ? "You just leveled up."
          : movedStats.length > 0 || changedTrails.length > 0
            ? "Your stats and trail readiness reflect this session."
            : "Every rep counts — even when the numbers don't move today."}
      </p>

      <div className="pt-3 border-t border-accent/20 flex items-center justify-between gap-2">
        <Link
          href="/progress"
          className="text-xs text-accent hover:underline font-medium"
        >
          Full breakdown →
        </Link>
        <ReopenButton plannedSessionId={session.id} />
      </div>
    </section>
  );
}

function StatDeltaCell({ stat }: { stat: StatDelta }) {
  const moved = stat.delta !== 0;
  const positive = stat.delta > 0;
  const tone = !moved
    ? "text-muted"
    : positive
      ? "text-blue-300"
      : "text-warn";
  const arrow = !moved ? "·" : positive ? "▲" : "▼";
  return (
    <div
      className={`rounded border ${moved ? "border-blue-500/40 bg-blue-950/20" : "border-panel-border bg-background/40"} px-2.5 py-2`}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[9px] font-mono uppercase tracking-wider text-muted">
          {stat.key}
        </span>
        <span className={`text-[10px] font-mono ${tone}`}>
          {arrow} {moved ? `${positive ? "+" : ""}${stat.delta}` : ""}
        </span>
      </div>
      <div className="text-sm font-mono font-semibold tabular-nums mt-0.5">
        {stat.after}
      </div>
    </div>
  );
}

function DeltaCell({
  label,
  detail,
  hint,
  active,
}: {
  label: string;
  detail: string;
  hint?: string;
  active?: boolean;
}) {
  return (
    <div
      className={`rounded border ${active ? "border-accent/50 bg-accent-strong/5" : "border-panel-border bg-background/40"} px-3 py-2`}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div
        className={`text-sm font-medium mt-0.5 tabular-nums ${active ? "text-accent" : "text-foreground"}`}
      >
        {detail}
      </div>
      {hint && <div className="text-[9px] text-muted mt-0.5">{hint}</div>}
    </div>
  );
}

function TrailVerdictRow({ trail }: { trail: TrailVerdictDelta }) {
  return (
    <Link
      href={`/trails/${trail.trailId}`}
      className="flex items-center gap-3 rounded border border-blue-500/40 bg-blue-950/20 px-3 py-2 text-xs hover:border-blue-400 transition"
    >
      <span className="font-medium truncate flex-1 min-w-0">
        {trail.isPrimary && <span className="text-blue-300 mr-1">★</span>}
        {trail.trailName}
      </span>
      <span className="text-muted uppercase tracking-wider text-[10px] font-mono">
        {trail.beforeLabel}
      </span>
      <span className="text-blue-300">→</span>
      <span className="text-blue-300 uppercase tracking-wider text-[10px] font-mono">
        {trail.afterLabel}
      </span>
    </Link>
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
