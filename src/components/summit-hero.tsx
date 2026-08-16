import Link from "next/link";
import {
  getActiveGoal,
  getCumulativeVertical,
  summitProgressFor,
  type ActiveGoal,
} from "@/lib/basecamp/summit";

export async function SummitHero({ userId }: { userId: number }) {
  const goal = await getActiveGoal(userId);
  const { totalFt, gpsFt, estimatedFt } = await getCumulativeVertical(userId);
  const progress = summitProgressFor(totalFt, goal);
  const pctToSummit = Math.min(100, progress.fractionThroughCurrent * 100);
  const goalLabel = goal.source === "default_rainier" ? "Rainier" : goal.name;

  return (
    <div className="rounded-md border border-blue-500/30 bg-blue-950/10 shadow-lg shadow-blue-500/10 p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted">
            To {goalLabel}
            {progress.summitCount > 0 && (
              <span className="ml-2 text-blue-300 font-mono">
                x{progress.summitCount + 1}
              </span>
            )}
          </div>
          <div className="text-3xl font-mono font-semibold text-blue-300 tabular-nums leading-none mt-1">
            {totalFt.toLocaleString()}
            <span className="text-base text-muted">
              {" "}/ {goal.summitFt.toLocaleString()} ft
            </span>
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
              <div className="uppercase tracking-widest text-muted">Cleared</div>
              <div className="text-blue-300 font-medium">Summit</div>
            </>
          )}
        </div>
      </div>

      <MountainBar progress={progress} goal={goal} />

      {progress.currentWaypoint && (
        <div className="text-xs text-muted">
          Current position:{" "}
          <span className="text-blue-300">{progress.currentWaypoint.name}</span>
          {progress.currentWaypoint.description && (
            <span className="text-muted"> — {progress.currentWaypoint.description}</span>
          )}
        </div>
      )}
      {estimatedFt > 0 && (
        <div className="text-[10px] text-muted">
          {gpsFt.toLocaleString()} ft measured (GPS) ·{" "}
          {estimatedFt.toLocaleString()} ft estimated (treadmill @ 12%, stair @
          33 ft/min).
        </div>
      )}
      {goal.source === "default_rainier" && (
        <div className="text-[10px] text-muted">
          Default goal: Mount Rainier.{" "}
          <Link
            href="/trails"
            className="text-blue-300 hover:underline"
          >
            Pick your own primary goal →
          </Link>
        </div>
      )}
    </div>
  );
}

function MountainBar({
  progress,
  goal,
}: {
  progress: ReturnType<typeof summitProgressFor>;
  goal: ActiveGoal;
}) {
  const summit = goal.summitFt;
  const yFor = (ft: number) => (ft / summit) * 100;
  const filledPct = progress.fractionThroughCurrent * 100;

  return (
    <div className="relative">
      <div className="h-3 bg-panel-border rounded-sm overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500/70 to-blue-300 transition-all duration-1000"
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
