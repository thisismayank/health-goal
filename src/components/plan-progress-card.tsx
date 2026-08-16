import { getPlanRollup, type PlanRollup } from "@/lib/analytics/plan-rollup";
import { generatePlanProgress } from "@/lib/coach/plan-progress-narrative";

const TRAJECTORY_LABEL: Record<PlanRollup["recentTrend"]["trajectory"], string> = {
  improving: "IMPROVING",
  steady: "STEADY",
  declining: "DECLINING",
  insufficient_data: "BUILDING",
};

const TRAJECTORY_COLOR: Record<PlanRollup["recentTrend"]["trajectory"], string> = {
  improving: "text-accent",
  steady: "text-blue-300",
  declining: "text-warn",
  insufficient_data: "text-muted",
};

export async function PlanProgressCard({
  userId,
  todayYmd,
  summitDateYmd,
}: {
  userId: number;
  todayYmd: string;
  summitDateYmd: string | null;
}) {
  const rollup = await getPlanRollup(userId, todayYmd, summitDateYmd);
  if (!rollup) return null;
  const narrative = await generatePlanProgress(userId, rollup);

  return (
    <section className="rounded-lg border border-blue-500/30 bg-blue-950/10 shadow-lg shadow-blue-500/10 p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <div className="text-xs font-mono uppercase tracking-widest text-blue-400">
          [PLAN PROGRESS]
        </div>
        <span
          className={`text-[10px] font-mono uppercase tracking-wider ${TRAJECTORY_COLOR[rollup.recentTrend.trajectory]}`}
        >
          {TRAJECTORY_LABEL[rollup.recentTrend.trajectory]}
        </span>
      </div>

      <div>
        <div className="text-sm text-muted">
          Week {rollup.currentWeek} of {rollup.totalWeeks} · Phase{" "}
          {rollup.phase.number} · {rollup.phase.name}
          {rollup.daysToSummit != null && (
            <span> · {rollup.daysToSummit} days to summit</span>
          )}
        </div>
        {narrative && (
          <h3 className="text-lg font-medium mt-1">{narrative.headline}</h3>
        )}
      </div>

      {narrative && (
        <p className="text-sm leading-relaxed">{narrative.trajectory}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <StatBox
          label="Compliance"
          value={`${rollup.cumulative.compliancePct}%`}
          hint={`${rollup.cumulative.sessionsCompleted}/${rollup.cumulative.sessionsPlanned}`}
        />
        <StatBox
          label="Volume"
          value={`${rollup.cumulative.actualMinutes} min`}
          hint={`/${rollup.cumulative.plannedMinutes} planned`}
        />
        <StatBox
          label="Vertical"
          value={`${rollup.cumulative.totalVerticalFt.toLocaleString()} ft`}
          hint={`${rollup.cumulative.workoutsCount} workouts`}
        />
        <StatBox
          label="Weight Δ"
          value={
            rollup.weight.deltaKg != null
              ? `${rollup.weight.deltaKg > 0 ? "+" : ""}${rollup.weight.deltaKg} kg`
              : "–"
          }
          hint={
            rollup.weight.startingKg != null && rollup.weight.currentAvgKg != null
              ? `${rollup.weight.startingKg} → ${rollup.weight.currentAvgKg}`
              : "no data"
          }
        />
      </div>

      {rollup.recentTrend.last4Weeks.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wider text-muted">
            Last {rollup.recentTrend.last4Weeks.length} week
            {rollup.recentTrend.last4Weeks.length === 1 ? "" : "s"}
          </div>
          <div className="rounded-md border border-panel-border bg-background/40 divide-y divide-panel-border">
            {rollup.recentTrend.last4Weeks.map((w) => (
              <div
                key={w.weekStart}
                className="flex items-center gap-3 px-3 py-1.5 text-xs tabular-nums"
              >
                <span className="text-muted w-14">W{w.weekNumber}</span>
                <span className="w-20">{w.compliancePct}% comp</span>
                <span className="w-24">{w.minutesActual} min</span>
                <span className="w-24">
                  {w.longestSessionMin > 0
                    ? `${w.longestSessionMin} min long`
                    : "no long"}
                </span>
                <span className="text-muted ml-auto">
                  {w.verticalFt > 0 ? `+${w.verticalFt.toLocaleString()} ft` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {narrative && (narrative.keyWins.length > 0 || narrative.keyConcerns.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {narrative.keyWins.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-accent">
                Wins
              </div>
              <ul className="mt-1 space-y-0.5 text-sm">
                {narrative.keyWins.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-accent">▸</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {narrative.keyConcerns.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-warn">
                Watch
              </div>
              <ul className="mt-1 space-y-0.5 text-sm">
                {narrative.keyConcerns.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-warn">▸</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {narrative && (
        <p className="text-sm text-muted italic border-t border-blue-500/20 pt-3">
          <span className="text-blue-300 uppercase tracking-wider text-xs mr-2">
            Next
          </span>
          {narrative.focusNextWeek}
        </p>
      )}
    </section>
  );
}

function StatBox({
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
      {hint && <div className="text-[10px] text-muted mt-0.5">{hint}</div>}
    </div>
  );
}
