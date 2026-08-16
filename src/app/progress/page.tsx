import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/data";
import { todayInTimeZone } from "@/lib/date";
import {
  computeCharacterSheet,
  type CharacterSheet,
  type Stat,
} from "@/lib/basecamp/stats";
import { computeRank } from "@/lib/basecamp/rank";
import { CoachCardSkeleton } from "@/components/coach-cards";
import { PlanProgressCard } from "@/components/plan-progress-card";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const user = await getCurrentUser();
  if (!user) return <p className="text-muted">No user found.</p>;

  const sheet = await computeCharacterSheet(user.id);
  const rank = computeRank(sheet);
  const today = todayInTimeZone(user.timezone);

  return (
    <div className="space-y-5">
      <section>
        <div className="text-xs uppercase tracking-widest text-muted">
          Progress
        </div>
        <h1 className="text-2xl font-semibold mt-0.5">{user.name}</h1>
      </section>

      <SystemPanel>
        <div className="flex items-baseline gap-4">
          <div className="text-6xl font-mono font-semibold text-blue-300 leading-none">
            {rank.current}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-medium">{rank.currentLabel}</div>
            <div className="text-xs text-muted mt-0.5">
              {rank.currentDescription}
            </div>
          </div>
        </div>

        {rank.nextRank && (
          <div className="mt-4 pt-4 border-t border-blue-500/20 space-y-3">
            <div className="flex items-baseline justify-between">
              <div className="text-xs uppercase tracking-widest text-muted">
                Next: {rank.nextRank} · {rank.nextLabel}
              </div>
              <div className="text-xs text-muted tabular-nums">
                {rank.requirementsMetCount} / {rank.requirementsForNext.length}
              </div>
            </div>
            <div className="h-1.5 bg-panel-border rounded overflow-hidden">
              <div
                className="h-full bg-blue-400 transition-all"
                style={{ width: `${rank.progressPct}%` }}
              />
            </div>
            <ul className="space-y-1 text-sm">
              {rank.requirementsForNext.map((r, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span
                    className={`inline-block w-3 text-center ${r.met ? "text-blue-400" : "text-muted"}`}
                  >
                    {r.met ? "◆" : "◇"}
                  </span>
                  <span className={r.met ? "text-foreground" : "text-muted"}>
                    {r.label}
                  </span>
                  <span className="ml-auto text-xs text-muted tabular-nums">
                    {r.currentValue} / {r.target}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!rank.nextRank && (
          <div className="mt-4 pt-4 border-t border-blue-500/20 text-xs text-muted">
            Max rank achieved. All benchmarks cleared.
          </div>
        )}
      </SystemPanel>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted">
          Stats · trailing {maxWindow(sheet)} days
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(["STR", "END", "POW", "REC", "WILL"] as const).map((k) => (
            <StatCard key={k} stat={sheet.stats[k]} />
          ))}
        </div>
        <p className="text-xs text-muted italic">
          Scores reflect the last 60–90 days only. Historical peaks don't count;
          capabilities decay if not practiced.
        </p>
      </section>

      <Suspense
        fallback={<CoachCardSkeleton label="Plan progress · thinking" />}
      >
        <PlanProgressCard
          userId={user.id}
          todayYmd={today}
          summitDateYmd={user.summitDate ?? null}
        />
      </Suspense>

      <div className="grid grid-cols-2 gap-2 pt-2">
        <Link
          href="/body"
          className="rounded-md border border-panel-border bg-panel/60 px-4 py-3 text-sm hover:border-blue-500/40 transition text-center"
        >
          Body & recovery →
        </Link>
        <Link
          href="/history"
          className="rounded-md border border-panel-border bg-panel/60 px-4 py-3 text-sm hover:border-blue-500/40 transition text-center"
        >
          Workout history →
        </Link>
      </div>
    </div>
  );
}

function maxWindow(sheet: CharacterSheet): number {
  return Math.max(...Object.values(sheet.stats).map((s) => s.windowDays));
}

function SystemPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-blue-500/30 bg-blue-950/10 shadow-lg shadow-blue-500/10 p-5">
      {children}
    </div>
  );
}

function StatCard({ stat }: { stat: Stat }) {
  const tone =
    stat.value >= 70
      ? "text-blue-300"
      : stat.value >= 40
        ? "text-foreground"
        : "text-muted";
  const barColor =
    stat.value >= 70
      ? "bg-blue-400"
      : stat.value >= 40
        ? "bg-blue-500/60"
        : "bg-blue-500/30";

  return (
    <div className="rounded-md border border-panel-border bg-panel p-4 space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="min-w-0">
          <span className="text-xs font-mono uppercase tracking-widest text-muted">
            {stat.key}
          </span>
          <span className="ml-2 text-xs text-muted">{stat.label}</span>
        </div>
        <span className={`text-2xl font-mono font-semibold tabular-nums ${tone}`}>
          {stat.value}
        </span>
      </div>
      <div className="h-1 bg-panel-border rounded overflow-hidden">
        <div
          className={`h-full transition-all ${barColor}`}
          style={{ width: `${Math.max(2, stat.value)}%` }}
        />
      </div>
      <div className="text-xs text-muted">{stat.metric}</div>
    </div>
  );
}
