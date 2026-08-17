import { format } from "date-fns";
import {
  requireOnboardedUser,
  getRecentBodyMetrics,
  rollingAverage,
} from "@/lib/data";

export const dynamic = "force-dynamic";
import { parseYmd, todayInTimeZone } from "@/lib/date";
import {
  hrvBaseline,
  rhrBaseline,
  sleepBaseline,
} from "@/lib/analytics/baselines";
import { BodyMetricForm } from "@/components/body-metric-form";

export default async function BodyPage() {
  const user = await requireOnboardedUser();

  const today = todayInTimeZone(user.timezone);
  const metrics = await getRecentBodyMetrics(user.id, 60);
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

  const [rhr, hrv, sleep] = await Promise.all([
    rhrBaseline(user.id, today),
    hrvBaseline(user.id, today),
    sleepBaseline(user.id, today),
  ]);

  const rows = metrics
    .map((m, i) => ({ ...m, rollingAvg: rolling[i] }))
    .reverse()
    .slice(0, 14);

  const haveRecovery =
    rhr.current != null ||
    hrv.current != null ||
    sleep.current != null ||
    (todayRow?.steps ?? null) != null ||
    metrics.some((m) => m.sleepMinutes != null || m.hrvMs != null || m.restingHrBpm != null);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Body</h1>
        <p className="text-sm text-muted mt-1">
          Weight, fatigue, and recovery. Deltas are vs your personal 21-day
          baseline (never population norms).
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
          label="Weight 7-day avg"
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
              : Math.abs(weekOverWeekDelta) > 0.6
                ? "warn"
                : "accent"
          }
        />
      </div>

      {haveRecovery ? (
        <>
          <section className="space-y-2">
            <h2 className="text-xs uppercase tracking-widest text-muted">
              Recovery signals
            </h2>
          <div className="grid grid-cols-2 gap-3">
            <RecoveryCard
              label="Sleep"
              value={
                sleep.current != null
                  ? `${(sleep.current / 60).toFixed(1)} h`
                  : "–"
              }
              baseline={
                sleep.baseline != null
                  ? `21d median ${(sleep.baseline / 60).toFixed(1)} h`
                  : `${sleep.samples}/21 days of data`
              }
              tone={
                sleep.current == null
                  ? "neutral"
                  : sleep.current < 5.5 * 60
                    ? "warn"
                    : sleep.current >= 7 * 60
                      ? "accent"
                      : "neutral"
              }
            />
            <RecoveryCard
              label="Resting HR"
              value={rhr.current != null ? `${rhr.current} bpm` : "–"}
              baseline={
                rhr.baseline != null && rhr.deltaAbs != null
                  ? `Δ ${rhr.deltaAbs > 0 ? "+" : ""}${rhr.deltaAbs} vs ${rhr.baseline} bpm`
                  : rhr.baseline != null
                    ? `baseline ${rhr.baseline} bpm · today —`
                    : `${rhr.samples}/21 days of data`
              }
              tone={
                rhr.deltaAbs == null
                  ? "neutral"
                  : rhr.deltaAbs >= 8
                    ? "warn"
                    : rhr.deltaAbs <= -3
                      ? "accent"
                      : "neutral"
              }
            />
            <RecoveryCard
              label="HRV"
              value={hrv.current != null ? `${hrv.current} ms` : "–"}
              baseline={
                hrv.baseline != null && hrv.deltaPct != null
                  ? `Δ ${hrv.deltaPct > 0 ? "+" : ""}${hrv.deltaPct}% vs ${hrv.baseline} ms`
                  : hrv.baseline != null
                    ? `baseline ${hrv.baseline} ms · today —`
                    : `${hrv.samples}/21 days of data`
              }
              tone={
                hrv.deltaPct == null
                  ? "neutral"
                  : hrv.deltaPct <= -15
                    ? "warn"
                    : hrv.deltaPct >= 5
                      ? "accent"
                      : "neutral"
              }
            />
            <RecoveryCard
              label="Steps"
              value={
                todayRow?.steps != null
                  ? todayRow.steps.toLocaleString()
                  : "–"
              }
              baseline={
                todayRow?.activeEnergyKcal != null
                  ? `${todayRow.activeEnergyKcal} kcal active`
                  : ""
              }
              tone="neutral"
            />
          </div>
        </section>

        <ExtendedWellness todayRow={todayRow} />
        <TrainingLoad todayRow={todayRow} />
        </>
      ) : (
        <section className="rounded-lg border border-panel-border bg-panel/60 p-4">
          <div className="text-xs uppercase tracking-widest text-muted mb-1">
            Recovery signals
          </div>
          <p className="text-sm text-muted">
            No sleep / HRV / resting HR data yet. Set up Health Auto Export on
            your iPhone (see Settings → Coming soon) to auto-import from
            HealthKit.
          </p>
        </section>
      )}

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
                className="flex items-center gap-3 px-4 py-2 text-xs sm:text-sm"
              >
                <span className="text-muted w-20 shrink-0">
                  {format(parseYmd(r.date), "EEE MMM d")}
                </span>
                <span className="tabular-nums w-16 shrink-0">
                  {r.bodyWeightKg != null ? `${r.bodyWeightKg} kg` : "–"}
                </span>
                <span className="tabular-nums text-muted w-16 shrink-0">
                  {r.sleepMinutes != null
                    ? `${(r.sleepMinutes / 60).toFixed(1)}h`
                    : ""}
                </span>
                <span className="tabular-nums text-muted w-14 shrink-0">
                  {r.restingHrBpm != null ? `${r.restingHrBpm}bpm` : ""}
                </span>
                <span className="tabular-nums text-muted w-14 shrink-0">
                  {r.hrvMs != null ? `${r.hrvMs}ms` : ""}
                </span>
                <span className="tabular-nums text-muted ml-auto">
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

function RecoveryCard({
  label,
  value,
  baseline,
  tone = "neutral",
}: {
  label: string;
  value: string;
  baseline: string;
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
      <div className="text-xs text-muted mt-1">{baseline}</div>
    </div>
  );
}

type ExtendedRow = {
  sleepScore?: number | null;
  vo2Max?: number | null;
  spo2Pct?: number | null;
  bodyFatPct?: number | null;
  respirationRpm?: number | null;
  avgSleepingHrBpm?: number | null;
  readiness?: number | null;
  stressScore?: number | null;
  ctl?: number | null;
  atl?: number | null;
};

function ExtendedWellness({ todayRow }: { todayRow: ExtendedRow | undefined }) {
  if (!todayRow) return null;
  const items: Array<{
    label: string;
    value: string;
    hint?: string;
    tone?: "neutral" | "accent" | "warn";
  }> = [];

  if (todayRow.sleepScore != null) {
    items.push({
      label: "Sleep score",
      value: `${todayRow.sleepScore}`,
      hint: "Garmin 0–100",
      tone: todayRow.sleepScore >= 80 ? "accent" : todayRow.sleepScore < 60 ? "warn" : "neutral",
    });
  }
  if (todayRow.readiness != null) {
    items.push({
      label: "Readiness",
      value: `${todayRow.readiness}`,
      hint: "Garmin 0–100",
      tone: todayRow.readiness >= 75 ? "accent" : todayRow.readiness < 50 ? "warn" : "neutral",
    });
  }
  if (todayRow.vo2Max != null) {
    items.push({
      label: "VO₂ max",
      value: `${todayRow.vo2Max}`,
      hint: "mL/kg/min",
    });
  }
  if (todayRow.spo2Pct != null) {
    items.push({
      label: "SpO₂",
      value: `${todayRow.spo2Pct}%`,
      hint: "avg overnight",
    });
  }
  if (todayRow.bodyFatPct != null) {
    items.push({
      label: "Body fat",
      value: `${todayRow.bodyFatPct}%`,
    });
  }
  if (todayRow.stressScore != null) {
    items.push({
      label: "Stress",
      value: `${todayRow.stressScore}`,
      hint: "Garmin 0–100",
      tone: todayRow.stressScore >= 50 ? "warn" : "neutral",
    });
  }
  if (todayRow.respirationRpm != null) {
    items.push({
      label: "Respiration",
      value: `${todayRow.respirationRpm} rpm`,
    });
  }
  if (todayRow.avgSleepingHrBpm != null) {
    items.push({
      label: "Sleep HR",
      value: `${todayRow.avgSleepingHrBpm} bpm`,
    });
  }

  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-xs uppercase tracking-widest text-muted">
        Extended wellness
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((it) => (
          <RecoveryCard
            key={it.label}
            label={it.label}
            value={it.value}
            baseline={it.hint ?? ""}
            tone={it.tone}
          />
        ))}
      </div>
    </section>
  );
}

function TrainingLoad({ todayRow }: { todayRow: ExtendedRow | undefined }) {
  if (!todayRow) return null;
  const ctl = todayRow.ctl ?? null;
  const atl = todayRow.atl ?? null;
  if (ctl == null && atl == null) return null;
  const tsb = ctl != null && atl != null ? +(ctl - atl).toFixed(1) : null;
  const tsbTone =
    tsb == null ? "neutral" : tsb >= 5 ? "accent" : tsb <= -10 ? "warn" : "neutral";
  return (
    <section className="space-y-2">
      <h2 className="text-xs uppercase tracking-widest text-muted">
        Training load (intervals.icu)
      </h2>
      <div className="grid grid-cols-3 gap-3">
        <RecoveryCard
          label="Fitness (CTL)"
          value={ctl != null ? `${ctl}` : "–"}
          baseline="42-day EWMA"
        />
        <RecoveryCard
          label="Fatigue (ATL)"
          value={atl != null ? `${atl}` : "–"}
          baseline="7-day EWMA"
        />
        <RecoveryCard
          label="Form (TSB)"
          value={tsb != null ? `${tsb > 0 ? "+" : ""}${tsb}` : "–"}
          baseline={
            tsb == null
              ? ""
              : tsb >= 5
                ? "fresh"
                : tsb <= -10
                  ? "fatigued"
                  : "steady"
          }
          tone={tsbTone}
        />
      </div>
    </section>
  );
}
