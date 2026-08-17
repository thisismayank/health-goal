import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  plannedSession,
  trainingPlan,
  workout,
  type PlannedSession,
} from "@/db/schema";
import { requireOnboardedUser } from "@/lib/data";
import { todayInTimeZone } from "@/lib/date";
import { GOAL_LABEL } from "@/lib/plan/goal-labels";
import { SessionIcon } from "@/components/ui/icons";
import { PlanSubNav } from "@/components/shell/plan-sub-nav";

export const dynamic = "force-dynamic";

const PHASE_BUCKETS: Array<{ label: string; startWeek: number; endWeek: number }> = [
  { label: "Rebuild", startWeek: 1, endWeek: 8 },
  { label: "Base + Vertical", startWeek: 9, endWeek: 16 },
  { label: "Mountain Specificity", startWeek: 17, endWeek: 24 },
  { label: "High Specificity", startWeek: 25, endWeek: 32 },
  { label: "Peak", startWeek: 33, endWeek: 38 },
  { label: "Taper", startWeek: 39, endWeek: 40 },
];

export default async function PlanTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const planId = Number(id);
  if (!Number.isFinite(planId)) notFound();

  const user = await requireOnboardedUser();
  const [plan] = await db
    .select()
    .from(trainingPlan)
    .where(and(eq(trainingPlan.id, planId), eq(trainingPlan.userId, user.id)))
    .limit(1);
  if (!plan) notFound();

  const sessions = await db
    .select()
    .from(plannedSession)
    .where(eq(plannedSession.planId, plan.id))
    .orderBy(asc(plannedSession.date));

  // Fetch every workout linked to any planned session in this plan so
  // we can mark done vs missed. Single query, indexed on plannedSessionId.
  const sessionIds = sessions.map((s) => s.id);
  const workoutsBySession = new Map<number, { id: number; startTime: Date }>();
  if (sessionIds.length > 0) {
    const rows = await db
      .select({
        id: workout.id,
        startTime: workout.startTime,
        plannedSessionId: workout.plannedSessionId,
      })
      .from(workout)
      .where(eq(workout.userId, user.id));
    for (const r of rows) {
      if (r.plannedSessionId != null) {
        workoutsBySession.set(r.plannedSessionId, {
          id: r.id,
          startTime: r.startTime,
        });
      }
    }
  }

  const today = todayInTimeZone(user.timezone);
  const totalCount = sessions.length;
  const doneCount = sessions.filter((s) => workoutsBySession.has(s.id)).length;
  const skippedCount = sessions.filter((s) => s.status === "skipped").length;
  const pastCount = sessions.filter((s) => s.date < today).length;
  const compliance =
    pastCount > 0 ? Math.round((doneCount / pastCount) * 100) : 0;

  // Group sessions by ISO week starting at plan.startDate for phase labels.
  const planStartMs = Date.UTC(
    ...(plan.startDate.split("-").map(Number) as [number, number, number]),
  );
  const weekOf = (ymd: string): number => {
    const [y, m, d] = ymd.split("-").map(Number);
    const ms = Date.UTC(y, m - 1, d);
    return Math.floor((ms - planStartMs) / (7 * 86_400_000)) + 1;
  };

  const byWeek = new Map<number, PlannedSession[]>();
  for (const s of sessions) {
    const w = weekOf(s.date);
    const list = byWeek.get(w) ?? [];
    list.push(s);
    byWeek.set(w, list);
  }
  const weeks = Array.from(byWeek.keys()).sort((a, b) => a - b);
  const totalWeeks = weeks.length;
  const currentWeek = weekOf(today);

  return (
    <div className="space-y-6">
      <PlanSubNav />
      <section>
        <h1 className="text-2xl font-semibold">{plan.name}</h1>
        <p className="text-sm text-muted mt-1">
          {plan.goalType ? GOAL_LABEL[plan.goalType] : "Plan"}
          {plan.goalEvent ? ` · ${plan.goalEvent}` : ""} · {totalWeeks} weeks
          {plan.source === "uploaded" && (
            <span className="ml-2 text-[10px] uppercase tracking-widest text-blue-300">
              uploaded
            </span>
          )}
        </p>
      </section>

      <section className="rounded-lg border border-panel-border bg-panel/60 p-4 space-y-2">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <Stat label="Week" value={`${currentWeek} / ${totalWeeks}`} />
          <Stat label="Done" value={`${doneCount} / ${totalCount}`} />
          <Stat label="Compliance" value={`${compliance}%`} sub="of past" />
        </div>
        <div className="pt-1 h-1.5 rounded-full bg-panel-border overflow-hidden">
          <div
            className="h-full bg-blue-500"
            style={{
              width: `${Math.min(100, Math.round((currentWeek / totalWeeks) * 100))}%`,
            }}
          />
        </div>
      </section>

      {PHASE_BUCKETS.filter((p) => p.endWeek <= totalWeeks || p.startWeek <= totalWeeks).map(
        (phase) => {
          const phaseWeeks = weeks.filter(
            (w) => w >= phase.startWeek && w <= phase.endWeek,
          );
          if (phaseWeeks.length === 0) return null;
          return (
            <section key={phase.label} className="space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
                {phase.label} · weeks {phase.startWeek}–{phase.endWeek}
              </div>
              <div className="space-y-1.5">
                {phaseWeeks.map((w) => (
                  <WeekRow
                    key={w}
                    weekNumber={w}
                    sessions={byWeek.get(w) ?? []}
                    workoutsBySession={workoutsBySession}
                    today={today}
                    isCurrent={w === currentWeek}
                    planId={plan.id}
                  />
                ))}
              </div>
            </section>
          );
        },
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted">
        {label}
      </div>
      <div className="text-lg font-semibold font-mono tabular-nums mt-0.5">
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted">{sub}</div>}
    </div>
  );
}

function WeekRow({
  weekNumber,
  sessions,
  workoutsBySession,
  today,
  isCurrent,
  planId,
}: {
  weekNumber: number;
  sessions: PlannedSession[];
  workoutsBySession: Map<number, { id: number; startTime: Date }>;
  today: string;
  isCurrent: boolean;
  planId: number;
}) {
  const done = sessions.filter((s) => workoutsBySession.has(s.id)).length;
  const past = sessions.filter((s) => s.date < today).length;
  const totalMin = sessions.reduce(
    (sum, s) => sum + (s.targetDurationMinutes ?? 0),
    0,
  );
  return (
    <details
      className={`rounded-md border px-3 py-2 group ${
        isCurrent
          ? "border-blue-500/50 bg-blue-950/20"
          : "border-panel-border bg-panel/40"
      }`}
    >
      <summary className="cursor-pointer select-none flex items-center gap-3 text-sm">
        <span className="inline-block transition-transform group-open:rotate-90 text-[10px] text-blue-300">
          ▸
        </span>
        <span className="w-14 font-mono tabular-nums text-blue-300">
          Wk {weekNumber}
        </span>
        <span className="flex-1 min-w-0 flex items-center gap-1.5">
          {sessions.slice(0, 7).map((s) => {
            const isDone = workoutsBySession.has(s.id);
            const isPast = s.date < today;
            const isSkipped = s.status === "skipped";
            return (
              <span
                key={s.id}
                className={`w-2.5 h-2.5 rounded-full border ${
                  isDone
                    ? "bg-accent border-accent"
                    : isSkipped
                      ? "bg-warn/40 border-warn/60"
                      : isPast
                        ? "bg-danger/30 border-danger/50"
                        : "bg-transparent border-panel-border"
                }`}
                title={`${s.title} · ${s.date}`}
              />
            );
          })}
        </span>
        <span className="text-[10px] text-muted tabular-nums">
          {done}/{past || sessions.length} · {totalMin}m
        </span>
      </summary>
      <div className="pt-2 divide-y divide-panel-border/60">
        {sessions.map((s) => (
          <SessionRow
            key={s.id}
            session={s}
            done={workoutsBySession.has(s.id)}
            today={today}
            planId={planId}
          />
        ))}
      </div>
    </details>
  );
}

function SessionRow({
  session,
  done,
  today,
  planId,
}: {
  session: PlannedSession;
  done: boolean;
  today: string;
  planId: number;
}) {
  const isPast = session.date < today;
  const isSkipped = session.status === "skipped";
  const statusLabel = done
    ? { text: "done", tone: "text-accent" }
    : isSkipped
      ? { text: "skipped", tone: "text-warn" }
      : isPast
        ? { text: "missed", tone: "text-danger" }
        : { text: "planned", tone: "text-muted" };
  return (
    <Link
      href={`/plan/${planId}/session/${session.id}`}
      className="flex items-baseline gap-3 py-2 text-xs hover:bg-blue-950/20 px-1 -mx-1 rounded"
    >
      <span className="w-14 font-mono tabular-nums text-muted shrink-0">
        {session.date.slice(5)}
      </span>
      <SessionIcon
        category={session.sessionCategory}
        size={13}
        className="text-blue-300 mt-0.5 shrink-0"
      />
      <span className="flex-1 min-w-0 truncate">{session.title}</span>
      <span className="text-muted tabular-nums shrink-0">
        {session.targetDurationMinutes ?? "—"}m
      </span>
      <span
        className={`text-[10px] uppercase tracking-wider w-14 text-right shrink-0 ${statusLabel.tone}`}
      >
        {statusLabel.text}
      </span>
    </Link>
  );
}
