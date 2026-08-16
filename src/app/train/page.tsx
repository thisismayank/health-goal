import Link from "next/link";
import { format } from "date-fns";
import {
  getActivePlan,
  getCurrentUser,
  getWeekSessions,
  getWeekWorkouts,
} from "@/lib/data";
import { DAY_LABELS, todayInTimeZone, weekDays, weekStart, ymd } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function TrainPage() {
  const user = await getCurrentUser();
  if (!user) return <p className="text-muted">No user found.</p>;
  const plan = await getActivePlan(user.id);
  if (!plan) return <p className="text-muted">No active training plan.</p>;

  const anchor = new Date();
  const days = weekDays(anchor);
  const sessions = await getWeekSessions(plan.id, anchor);
  const workouts = await getWeekWorkouts(user.id, anchor);

  const sessionByDate = new Map(sessions.map((s) => [s.date, s]));
  const workoutBySession = new Map(
    workouts
      .filter((w) => w.plannedSessionId != null)
      .map((w) => [w.plannedSessionId as number, w]),
  );

  const today = todayInTimeZone(user.timezone);
  const passed = sessions.filter((s) => s.date <= today);
  const completed = passed.filter((s) => s.status === "completed");
  const plannedTotalMin = sessions.reduce(
    (sum, s) => sum + (s.targetDurationMinutes ?? 0),
    0,
  );
  const actualTotalMin = workouts.reduce(
    (sum, w) => sum + Math.round((w.durationSeconds ?? 0) / 60),
    0,
  );
  const compliance =
    passed.length === 0 ? 0 : Math.round((completed.length / passed.length) * 100);

  const start = weekStart(anchor);

  return (
    <div className="space-y-5">
      <section>
        <div className="text-xs uppercase tracking-widest text-muted">
          Week of {format(start, "MMM d")}
        </div>
        <h1 className="text-2xl font-semibold mt-0.5">Training week</h1>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted">
          <span>
            <span className="text-foreground">{completed.length}</span> /{" "}
            {sessions.length} sessions
          </span>
          <span>
            <span className="text-foreground">{compliance}%</span> compliance so
            far
          </span>
          <span>
            <span className="text-foreground">{actualTotalMin}</span> /{" "}
            {plannedTotalMin} min
          </span>
        </div>
      </section>

      <div className="space-y-2">
        {days.map((d, i) => {
          const dateStr = ymd(d);
          const session = sessionByDate.get(dateStr);
          const workout = session ? workoutBySession.get(session.id) : null;
          const isToday = dateStr === today;
          return (
            <div
              key={dateStr}
              className={`rounded-lg border p-4 flex items-center gap-4 ${
                isToday
                  ? "border-blue-500/60 bg-blue-950/10"
                  : "border-panel-border bg-panel/60"
              }`}
            >
              <div className="w-14 text-center shrink-0">
                <div className="text-xs uppercase text-muted">
                  {DAY_LABELS[i]}
                </div>
                <div
                  className={`text-xl font-semibold ${
                    isToday ? "text-blue-300" : ""
                  }`}
                >
                  {format(d, "d")}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                {session ? (
                  <>
                    <div className="text-sm truncate">{session.title}</div>
                    <div className="text-xs text-muted">
                      {session.targetDurationMinutes ?? "–"} min
                      {workout?.durationSeconds != null && (
                        <>
                          {" "}
                          · actual{" "}
                          {Math.round(workout.durationSeconds / 60)}m
                        </>
                      )}
                      {workout?.rpe != null && <> · RPE {workout.rpe}</>}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted">No planned session</div>
                )}
              </div>
              <StatusChip status={session?.status ?? "none"} />
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2">
        <Link
          href="/history"
          className="rounded-md border border-panel-border bg-panel/60 px-4 py-3 text-sm hover:border-blue-500/40 transition text-center"
        >
          Workout history →
        </Link>
        <Link
          href="/body"
          className="rounded-md border border-panel-border bg-panel/60 px-4 py-3 text-sm hover:border-blue-500/40 transition text-center"
        >
          Log body metrics →
        </Link>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    planned: { label: "planned", className: "bg-panel-border text-muted" },
    completed: {
      label: "done",
      className: "bg-accent-strong/20 text-accent",
    },
    skipped: { label: "skipped", className: "bg-warn/20 text-warn" },
    moved: { label: "moved", className: "bg-panel-border text-muted" },
    none: { label: "—", className: "text-muted" },
  };
  const s = map[status] ?? map.planned;
  return (
    <span
      className={`text-[10px] uppercase tracking-wider rounded px-2 py-1 whitespace-nowrap ${s.className}`}
    >
      {s.label}
    </span>
  );
}
