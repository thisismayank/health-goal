import { Suspense } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { CoachCardSkeleton, WeeklyReviewCard } from "@/components/coach-cards";

export const dynamic = "force-dynamic";
import {
  getActivePlan,
  getCurrentUser,
  getWeekSessions,
  getWeekWorkouts,
} from "@/lib/data";
import { DAY_LABELS, todayYmd, weekDays, weekStart, ymd } from "@/lib/date";

export default async function WeekPage() {
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

  const today = todayYmd();
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
    <div className="space-y-6">
      <section>
        <div className="text-xs uppercase tracking-widest text-muted">
          Week of {format(start, "MMM d")}
        </div>
        <h1 className="text-2xl font-semibold mt-1">This week</h1>
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
                  ? "border-accent bg-panel"
                  : "border-panel-border bg-panel/60"
              }`}
            >
              <div className="w-14 text-center">
                <div className="text-xs uppercase text-muted">
                  {DAY_LABELS[i]}
                </div>
                <div
                  className={`text-xl font-semibold ${
                    isToday ? "text-accent" : ""
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

      <Suspense fallback={<CoachCardSkeleton label="Week review · thinking" />}>
        <WeeklyReviewCard
          userId={user.id}
          anchor={anchor}
          tz={user.timezone}
          plan={{ id: plan.id, startDate: plan.startDate }}
        />
      </Suspense>

      <div className="pt-2">
        <Link
          href="/"
          className="text-sm text-muted hover:text-foreground underline underline-offset-4"
        >
          ← Back to today
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
      className={`text-[10px] uppercase tracking-wider rounded px-2 py-1 ${s.className}`}
    >
      {s.label}
    </span>
  );
}
