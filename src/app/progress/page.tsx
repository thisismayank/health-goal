import Link from "next/link";
import { Suspense } from "react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { trail, trailCompletion } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/data";
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
  const user = await requireOnboardedUser();

  const sheet = await computeCharacterSheet(user.id);
  const rank = computeRank(sheet);
  const today = todayInTimeZone(user.timezone);

  // Trail Passport data — one row per completion, joined to the trail.
  const passportRows = await db
    .select({
      completionId: trailCompletion.id,
      completedAt: trailCompletion.completedAt,
      timeMinutes: trailCompletion.timeMinutes,
      trailId: trail.id,
      trailName: trail.name,
      region: trail.notes, // no region column; fall back to null and derive later if we add one
      distanceKm: trail.distanceKm,
      elevationGainFt: trail.elevationGainFt,
      terrainGrade: trail.terrainGrade,
    })
    .from(trailCompletion)
    .innerJoin(trail, eq(trail.id, trailCompletion.trailId))
    .where(eq(trailCompletion.userId, user.id))
    .orderBy(desc(trailCompletion.completedAt));

  const uniqueTrailIds = new Set(passportRows.map((r) => r.trailId));

  return (
    <div className="space-y-5">
      <section>
        <div className="text-xs uppercase tracking-widest text-muted">
          Progress
        </div>
        <h1 className="text-2xl font-semibold mt-0.5">{user.name}</h1>
      </section>

      <SystemPanel>
        <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
          [HIKER CLASS]
        </div>
        <div className="flex items-baseline gap-4 mt-2">
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

        {rank.currentUnlocks.length > 0 && (
          <div className="mt-4 pt-4 border-t border-blue-500/20">
            <div className="text-[10px] uppercase tracking-widest text-blue-300 mb-1.5">
              What you can attempt
            </div>
            <ul className="space-y-1 text-sm">
              {rank.currentUnlocks.map((u, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-blue-400">✓</span>
                  <span className="text-foreground/90">{u}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {rank.nextRank && (
          <div className="mt-4 pt-4 border-t border-blue-500/20 space-y-3">
            <div className="flex items-baseline justify-between">
              <div className="text-xs uppercase tracking-widest text-muted">
                Next class: {rank.nextRank} · {rank.nextLabel}
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
            {rank.nextUnlocks.length > 0 && (
              <div className="pt-2 border-t border-blue-500/10">
                <div className="text-[10px] uppercase tracking-widest text-muted mb-1">
                  Unlocks at {rank.nextRank}
                </div>
                <ul className="space-y-0.5 text-xs">
                  {rank.nextUnlocks.map((u, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-muted">🔒</span>
                      <span className="text-muted">{u}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!rank.nextRank && (
          <div className="mt-4 pt-4 border-t border-blue-500/20 text-xs text-muted">
            Max class achieved. All benchmarks cleared.
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

      {/* Trail Passport */}
      <section className="rounded-lg border border-blue-500/30 bg-blue-950/10 shadow-lg shadow-blue-500/10 p-5 space-y-3">
        <div className="flex items-baseline justify-between">
          <div className="text-xs font-mono uppercase tracking-widest text-blue-400">
            [TRAIL PASSPORT]
          </div>
          <div className="text-xs text-muted tabular-nums">
            <span className="text-blue-300 font-mono">{uniqueTrailIds.size}</span>{" "}
            unique · {passportRows.length} total
          </div>
        </div>

        {passportRows.length === 0 ? (
          <div className="text-sm text-muted leading-relaxed">
            No stamps yet. Log completions from any saved trail — open a
            trail, tap{" "}
            <span className="text-accent font-medium">✓ I've done this</span>,
            add the date, and it appears here.
            <div className="mt-3">
              <Link
                href="/trails"
                className="text-xs text-blue-300 hover:underline"
              >
                Browse trails →
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {passportRows.slice(0, 12).map((r) => (
                <Link
                  key={r.completionId}
                  href={`/trails/${r.trailId}`}
                  className="rounded-md border border-blue-500/30 bg-background/40 p-3 hover:border-blue-500/60 transition"
                >
                  <div className="text-[10px] font-mono uppercase tracking-wider text-accent">
                    ✓ STAMPED
                  </div>
                  <div className="text-sm font-medium truncate mt-1">
                    {r.trailName}
                  </div>
                  <div className="text-[10px] text-muted mt-0.5 tabular-nums">
                    {r.completedAt}
                    {r.timeMinutes != null && (
                      <span> · {formatMinutes(r.timeMinutes)}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            {passportRows.length > 12 && (
              <div className="text-[11px] text-muted italic">
                + {passportRows.length - 12} more…
              </div>
            )}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
        <Link
          href="/squad"
          className="rounded-md border border-blue-500/40 bg-blue-950/10 px-4 py-3 text-sm text-blue-300 hover:border-blue-400 transition text-center"
        >
          Squads →
        </Link>
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

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}m`;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}
