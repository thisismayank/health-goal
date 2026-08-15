import { format } from "date-fns";
import {
  getCurrentUser,
  getRecentBodyMetrics,
  rollingAverage,
} from "@/lib/data";

export const dynamic = "force-dynamic";
import { parseYmd, todayYmd } from "@/lib/date";
import { BodyMetricForm } from "@/components/body-metric-form";

export default async function BodyPage() {
  const user = await getCurrentUser();
  if (!user) return <p className="text-muted">No user found.</p>;

  const metrics = await getRecentBodyMetrics(user.id, 60);
  const today = todayYmd();
  const todayRow = metrics.find((m) => m.date === today);

  const weights = metrics.map((m) => m.bodyWeightKg);
  const rolling = rollingAverage(weights, 7);
  const latestRolling = rolling.length > 0 ? rolling[rolling.length - 1] : null;

  const first7Avg =
    weights.length >= 7
      ? rollingAverage(weights.slice(-14, -7), 7).at(-1)
      : null;
  const weekOverWeekDelta =
    latestRolling != null && first7Avg != null
      ? latestRolling - first7Avg
      : null;

  const rows = metrics
    .map((m, i) => ({ ...m, rollingAvg: rolling[i] }))
    .reverse()
    .slice(0, 14);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Body</h1>
        <p className="text-sm text-muted mt-1">
          Track weight and fatigue. Trends matter — single days don't.
        </p>
      </section>

      <div className="rounded-lg border border-panel-border bg-panel p-5">
        <div className="text-xs uppercase tracking-widest text-muted mb-3">
          {format(new Date(), "EEEE · MMM d")}
        </div>
        <BodyMetricForm
          dateYmd={today}
          currentWeightKg={todayRow?.bodyWeightKg ?? null}
          currentFatigue={todayRow?.fatigue1to10 ?? null}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="7-day avg"
          value={latestRolling != null ? `${latestRolling.toFixed(1)} kg` : "–"}
        />
        <Stat
          label="Δ vs prior 7d"
          value={
            weekOverWeekDelta != null
              ? `${weekOverWeekDelta > 0 ? "+" : ""}${weekOverWeekDelta.toFixed(2)} kg`
              : "–"
          }
          tone={
            weekOverWeekDelta == null
              ? "neutral"
              : weekOverWeekDelta > 0.5
                ? "warn"
                : weekOverWeekDelta < -0.7
                  ? "warn"
                  : "accent"
          }
        />
      </div>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-muted">
          Recent 14 days
        </h2>
        {rows.length === 0 ? (
          <p className="text-muted text-sm">No entries yet.</p>
        ) : (
          <div className="rounded-lg border border-panel-border bg-panel divide-y divide-panel-border">
            {rows.map((r) => (
              <div
                key={r.date}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <span className="text-muted w-24">
                  {format(parseYmd(r.date), "EEE MMM d")}
                </span>
                <span className="tabular-nums">
                  {r.bodyWeightKg != null ? `${r.bodyWeightKg} kg` : "–"}
                </span>
                <span className="tabular-nums text-muted text-xs w-16 text-right">
                  {r.rollingAvg != null ? `avg ${r.rollingAvg.toFixed(1)}` : ""}
                </span>
                <span className="text-muted text-xs w-12 text-right">
                  {r.fatigue1to10 != null ? `fat ${r.fatigue1to10}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "accent" | "warn";
}) {
  const toneCls = {
    neutral: "text-foreground",
    accent: "text-accent",
    warn: "text-warn",
  }[tone];
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-4">
      <div className="text-xs uppercase tracking-widest text-muted">
        {label}
      </div>
      <div className={`text-xl font-semibold mt-1 ${toneCls}`}>{value}</div>
    </div>
  );
}
