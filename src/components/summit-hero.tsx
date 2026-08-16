import {
  getCumulativeVertical,
  RAINIER_SUMMIT_FT,
  summitProgressFor,
  WAYPOINTS,
} from "@/lib/basecamp/summit";

export async function SummitHero({ userId }: { userId: number }) {
  const { totalFt, gpsFt, estimatedFt } = await getCumulativeVertical(userId);
  const progress = summitProgressFor(totalFt);
  const pctToSummit = Math.min(
    100,
    (progress.fractionThroughCurrent) * 100,
  );

  const label = progress.summitCount > 0
    ? `Rainier x${progress.summitCount} · +${progress.fractionThroughCurrent === 0 ? 0 : Math.round(pctToSummit)}%`
    : `${Math.round(pctToSummit)}% to Rainier`;

  return (
    <div className="rounded-md border border-blue-500/30 bg-blue-950/10 shadow-lg shadow-blue-500/10 p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted">
            To Rainier
          </div>
          <div className="text-3xl font-mono font-semibold text-blue-300 tabular-nums leading-none mt-1">
            {totalFt.toLocaleString()}
            <span className="text-base text-muted"> / {RAINIER_SUMMIT_FT.toLocaleString()} ft</span>
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

      <MountainBar progress={progress} totalFt={totalFt} />

      {progress.currentWaypoint && (
        <div className="text-xs text-muted">
          Current position: <span className="text-blue-300">{progress.currentWaypoint.name}</span>
          <span className="text-muted"> — {progress.currentWaypoint.description}</span>
        </div>
      )}
      {estimatedFt > 0 && (
        <div className="text-[10px] text-muted">
          {gpsFt.toLocaleString()} ft measured (GPS) · {estimatedFt.toLocaleString()} ft
          estimated (treadmill @ 12%, stair @ 33 ft/min).
        </div>
      )}
    </div>
  );
}

function MountainBar({
  progress,
  totalFt: _totalFt,
}: {
  progress: ReturnType<typeof summitProgressFor>;
  totalFt: number;
}) {
  const summit = RAINIER_SUMMIT_FT;
  // Position waypoints as % of summit height along the horizontal bar
  const yFor = (ft: number) => (ft / summit) * 100;

  const filledPct = progress.fractionThroughCurrent * 100;

  return (
    <div className="relative">
      {/* Bar */}
      <div className="h-3 bg-panel-border rounded-sm overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500/70 to-blue-300 transition-all duration-1000"
          style={{ width: `${filledPct}%` }}
        />
      </div>

      {/* Waypoint markers below */}
      <div className="relative h-16 mt-1">
        {WAYPOINTS.map((w) => {
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
                {w.name.length > 10 ? w.name.split(" ")[0] : w.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
