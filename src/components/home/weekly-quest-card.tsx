import { getWeeklyQuest } from "@/lib/basecamp/weekly-quest";

export async function WeeklyQuestCard({
  userId,
  tz,
}: {
  userId: number;
  tz: string;
}) {
  const q = await getWeeklyQuest(userId, tz);
  const bars = [
    {
      label: "Workouts",
      actual: q.actual.workouts,
      target: q.targets.workouts,
      unit: "",
    },
    {
      label: "Minutes",
      actual: q.actual.minutes,
      target: q.targets.minutes,
      unit: "min",
    },
    {
      label: "Vertical",
      actual: q.actual.verticalFt,
      target: q.targets.verticalFt,
      unit: "ft",
    },
  ];
  const dayName = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: tz,
  }).format(new Date());
  const completedCount = bars.filter((b) => b.actual >= b.target).length;
  const allDone = completedCount === bars.length;

  return (
    <section className="rounded-lg border border-panel-border bg-panel/60 p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
            [WEEKLY QUEST]
          </div>
          <div className="text-[10px] text-muted mt-0.5">
            Mon–Sun · targets for{" "}
            <span className="text-blue-300 font-mono">{q.hikerClass}</span>{" "}
            {q.hikerClassLabel}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted tabular-nums">
            <span className="text-foreground">{dayName}</span>
            {q.daysRemaining > 0 && (
              <span>
                {" "}
                · {q.daysRemaining} day{q.daysRemaining === 1 ? "" : "s"} left
              </span>
            )}
            {q.daysRemaining === 0 && (
              <span className="text-warn"> · last day</span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {bars.map((b) => (
          <QuestBar key={b.label} {...b} />
        ))}
      </div>

      {allDone && (
        <p className="text-xs text-accent italic">
          ✓ All three targets hit this week. Coasting into rest.
        </p>
      )}
    </section>
  );
}

function QuestBar({
  label,
  actual,
  target,
  unit,
}: {
  label: string;
  actual: number;
  target: number;
  unit: string;
}) {
  const pct = target === 0 ? 100 : Math.min(100, (actual / target) * 100);
  const done = actual >= target;
  const barColor = done
    ? "bg-accent"
    : pct >= 50
      ? "bg-blue-400"
      : pct >= 20
        ? "bg-blue-500/60"
        : "bg-blue-500/30";

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted">
          {done && <span className="text-accent">✓ </span>}
          {label}
        </span>
        <span className="tabular-nums">
          <span className={done ? "text-accent font-medium" : "text-foreground"}>
            {actual.toLocaleString()}
          </span>
          <span className="text-muted">
            {" / "}
            {target.toLocaleString()}
            {unit && ` ${unit}`}
          </span>
        </span>
      </div>
      <div className="h-1.5 bg-panel-border rounded overflow-hidden">
        <div
          className={`h-full transition-all ${barColor}`}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
    </div>
  );
}
