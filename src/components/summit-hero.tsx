import Link from "next/link";
import {
  getActiveGoal,
  getCumulativeVertical,
  summitProgressFor,
  type ActiveGoal,
} from "@/lib/basecamp/summit";

export async function SummitHero({
  userId,
  deltaFt = 0,
}: {
  userId: number;
  deltaFt?: number;
}) {
  const goal = await getActiveGoal(userId);
  const { totalFt, gpsFt, estimatedFt } = await getCumulativeVertical(userId);
  const progress = summitProgressFor(totalFt, goal);
  const goalLabel = goal.source === "default_rainier" ? "Rainier" : goal.name;
  const highlight = deltaFt > 0;

  // Two rendering modes. Before the first summit we're on a real climb
  // with waypoints and a filling bar. After — the bar has no meaning
  // (would be pinned at 100% or exceed it), so we switch to an odometer.
  const pastFirstSummit = progress.summitCount > 0;

  return (
    <div
      className={`rounded-md border border-blue-500/30 bg-blue-950/10 shadow-lg shadow-blue-500/10 p-5 space-y-4 ${highlight ? "cascade-highlight" : ""}`}
    >
      {pastFirstSummit ? (
        <OdometerView
          goal={goal}
          goalLabel={goalLabel}
          totalFt={totalFt}
          summitCount={progress.summitCount}
          deltaFt={deltaFt}
          highlight={highlight}
        />
      ) : (
        <ClimbingView
          goal={goal}
          goalLabel={goalLabel}
          totalFt={totalFt}
          progress={progress}
          deltaFt={deltaFt}
          highlight={highlight}
        />
      )}

      {estimatedFt > 0 && (
        <div className="text-[10px] text-muted">
          {gpsFt.toLocaleString()} ft measured (GPS) ·{" "}
          {estimatedFt.toLocaleString()} ft estimated (treadmill / stair).
        </div>
      )}
      {goal.source === "default_rainier" && (
        <div className="text-[10px] text-muted">
          Default goal: Mount Rainier.{" "}
          <Link href="/trails" className="text-blue-300 hover:underline">
            Pick your own primary goal →
          </Link>
        </div>
      )}
    </div>
  );
}

function ClimbingView({
  goal,
  goalLabel,
  totalFt,
  progress,
  deltaFt,
  highlight,
}: {
  goal: ActiveGoal;
  goalLabel: string;
  totalFt: number;
  progress: ReturnType<typeof summitProgressFor>;
  deltaFt: number;
  highlight: boolean;
}) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted">
            To {goalLabel}
          </div>
          <div className="text-3xl font-mono font-semibold text-blue-300 tabular-nums leading-none mt-1">
            {totalFt.toLocaleString()}
            <span className="text-base text-muted">
              {" "}/ {goal.summitFt.toLocaleString()} ft
            </span>
            {highlight && (
              <span className="ml-2 text-sm font-mono text-accent align-middle">
                +{deltaFt.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="text-right text-xs">
          {progress.nextWaypoint ? (
            <>
              <div className="uppercase tracking-widest text-muted">Next</div>
              <div className="text-blue-300 font-medium">
                {progress.nextWaypoint.name}
              </div>
              <div className="text-muted tabular-nums">
                +{progress.toNextFt.toLocaleString()} ft
              </div>
            </>
          ) : (
            <>
              <div className="uppercase tracking-widest text-muted">Reached</div>
              <div className="text-blue-300 font-medium">Summit</div>
            </>
          )}
        </div>
      </div>

      <MountainBar progress={progress} goal={goal} highlight={highlight} />

      {progress.currentWaypoint && (
        <div className="text-xs text-muted">
          Current position:{" "}
          <span className="text-blue-300">{progress.currentWaypoint.name}</span>
          {progress.currentWaypoint.description && (
            <span className="text-muted"> — {progress.currentWaypoint.description}</span>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Odometer for users who've already climbed at least one summit's
 * worth of vertical. No progress bar (it would be meaningless past
 * 100%). Displays cumulative vertical + how many summits that equals.
 */
function OdometerView({
  goal,
  goalLabel,
  totalFt,
  summitCount,
  deltaFt,
  highlight,
}: {
  goal: ActiveGoal;
  goalLabel: string;
  totalFt: number;
  summitCount: number;
  deltaFt: number;
  highlight: boolean;
}) {
  const equivalent = totalFt / goal.summitFt;
  return (
    <>
      <div>
        <div className="text-xs uppercase tracking-widest text-muted">
          Cumulative vertical climbed
        </div>
        <div className="text-3xl font-mono font-semibold text-blue-300 tabular-nums leading-none mt-1">
          {totalFt.toLocaleString()}
          <span className="text-base text-muted"> ft</span>
          {highlight && (
            <span className="ml-2 text-sm font-mono text-accent align-middle">
              +{deltaFt.toLocaleString()}
            </span>
          )}
        </div>
      </div>
      <div className="text-sm text-foreground/85 leading-relaxed">
        That&apos;s the equivalent of climbing{" "}
        <span className="font-mono text-blue-300 tabular-nums">
          {equivalent.toFixed(1)}×
        </span>{" "}
        {goalLabel} ({goal.summitFt.toLocaleString()} ft summit) —{" "}
        {summitCount} full summit{summitCount === 1 ? "" : "s"} in the log.
      </div>
    </>
  );
}

function MountainBar({
  progress,
  goal,
  highlight = false,
}: {
  progress: ReturnType<typeof summitProgressFor>;
  goal: ActiveGoal;
  highlight?: boolean;
}) {
  const summit = goal.summitFt;
  const yFor = (ft: number) => (ft / summit) * 100;
  const filledPct = Math.min(100, progress.fractionThroughCurrent * 100);

  return (
    <div className="relative">
      <div className="h-3 bg-panel-border rounded-sm overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r from-blue-500/70 to-blue-300 transition-all duration-1000 ${highlight ? "cascade-fill" : ""}`}
          style={{ width: `${filledPct}%` }}
        />
      </div>

      <div className="relative h-16 mt-1">
        {goal.waypoints.map((w) => {
          const left = yFor(w.ft);
          const reached = progress.fractionThroughCurrent * summit >= w.ft;
          return (
            <div
              key={w.name}
              className="absolute top-0 flex flex-col items-center"
              style={{
                left: `${left}%`,
                transform: "translateX(-50%)",
              }}
            >
              <div
                className={`w-0.5 h-2 ${reached ? "bg-blue-400" : "bg-panel-border"}`}
              />
              <div
                className={`mt-1 text-[10px] tabular-nums font-mono whitespace-nowrap ${
                  reached ? "text-blue-300" : "text-muted"
                }`}
              >
                {w.ft.toLocaleString()}
              </div>
              <div
                className={`text-[10px] whitespace-nowrap ${
                  reached ? "text-foreground" : "text-muted"
                }`}
              >
                {w.name.length > 12 ? w.name.split(" ")[0] : w.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
