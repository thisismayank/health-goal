import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { and, asc, eq, gt, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { trail } from "@/db/schema";
import { getHomeState, type HomeState } from "@/lib/home/state";
import { QuestPendingHero } from "@/components/home/quest-pending-hero";
import { QuestDoneHero } from "@/components/home/quest-done-hero";
import { RecapHero } from "@/components/home/recap-hero";
import { NoSessionHero } from "@/components/home/no-session-hero";
import { TripWeekHero } from "@/components/home/trip-week-hero";
import { StatsStrip } from "@/components/home/stats-strip";
import { WeeklyQuestCard } from "@/components/home/weekly-quest-card";
import { FeaturedTrailCard } from "@/components/home/featured-trail-card";
import { SummitHero } from "@/components/summit-hero";
import { UpcomingTrails } from "@/components/upcoming-trails";
import { CoachCardSkeleton, DailyCoachCard } from "@/components/coach-cards";
import {
  computeCompletionDelta,
  type CompletionDelta,
} from "@/lib/basecamp/completion-delta";
import type { StatKey } from "@/lib/basecamp/stats";
import { tryFetchTripForecast } from "@/lib/weather/trip-forecast";
import type { DailyForecast } from "@/lib/weather/open-meteo";
import { computeCharacterSheet } from "@/lib/basecamp/stats";
import { computeRank } from "@/lib/basecamp/rank";
import { detectClassChangeAndUpdate } from "@/lib/basecamp/class-tracker";
import { ClassUpOverlay } from "@/components/home/class-up-overlay";
import { getActiveGoal } from "@/lib/basecamp/summit";
import {
  classProgressLine,
  greetingFor,
  northStarBeats,
  recoveryLine,
  whyThisWorkout,
} from "@/lib/home/framing";

export const dynamic = "force-dynamic";

function daysFromYmd(fromYmd: string, toYmd: string): number {
  const [y1, m1, d1] = fromYmd.split("-").map(Number);
  const [y2, m2, d2] = toYmd.split("-").map(Number);
  const from = Date.UTC(y1, m1 - 1, d1);
  const to = Date.UTC(y2, m2 - 1, d2);
  return Math.round((to - from) / 86_400_000);
}

export default async function HomePage() {
  const state = await getHomeState();

  if (state.kind === "no_user") redirect("/login");
  if (!state.user.onboardedAt) redirect("/welcome");

  // ---- state cascade for post-workout deltas (unchanged) ----
  const delta =
    state.kind === "post_workout"
      ? await computeCompletionDelta({
          userId: state.user.id,
          workoutId: state.workout.id,
          plannedSessionId: state.workout.plannedSessionId,
          todayYmd: state.today,
        })
      : null;
  const highlightStats: StatKey[] =
    delta?.stats.filter((s) => s.delta !== 0).map((s) => s.key) ?? [];
  const summitDeltaFt = delta?.summit.deltaFt ?? 0;

  const tripForecast: DailyForecast | null =
    state.kind === "trip_week" && state.trail.targetDate
      ? await tryFetchTripForecast({
          trailName: state.trail.name,
          notes: state.trail.notes,
          targetDate: state.trail.targetDate,
        })
      : null;

  // ---- character sheet + rank (used by narrative + class-up + stats) ----
  const sheet = await computeCharacterSheet(state.user.id);
  const rank = computeRank(sheet);
  const classChange = await detectClassChangeAndUpdate(
    state.user.id,
    rank.current,
  );
  const upgradeMoment = classChange?.direction === "up" ? classChange : null;

  // ---- north-star context: primary goal + next scheduled trip ----
  const goal = await getActiveGoal(state.user.id);
  const primaryTrail = goal.primaryTrailId
    ? (
        await db
          .select()
          .from(trail)
          .where(eq(trail.id, goal.primaryTrailId))
          .limit(1)
      )[0]
    : null;
  const [nextTrip] = await db
    .select()
    .from(trail)
    .where(
      and(
        eq(trail.userId, state.user.id),
        isNotNull(trail.targetDate),
        gt(trail.targetDate, state.today),
      ),
    )
    .orderBy(asc(trail.targetDate))
    .limit(1);

  const nextTripDays =
    nextTrip?.targetDate != null
      ? daysFromYmd(state.today, nextTrip.targetDate)
      : null;
  const northStarDays =
    primaryTrail?.targetDate != null
      ? daysFromYmd(state.today, primaryTrail.targetDate)
      : null;

  const beats = northStarBeats({
    nextTripName: nextTrip?.name ?? null,
    nextTripDaysAway: nextTripDays,
    northStarName: primaryTrail?.name ?? null,
    northStarDaysAway: northStarDays,
  });

  const dayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: state.user.timezone,
  }).format(new Date());
  const localHour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: state.user.timezone,
    }).format(new Date()),
  );

  return (
    <div className="space-y-6">
      {upgradeMoment && <ClassUpOverlay change={upgradeMoment} />}

      {/* Greeting + north-star beats */}
      <section>
        <div className="text-[11px] uppercase tracking-widest text-muted">
          {dayLabel}
        </div>
        <h1 className="text-2xl font-semibold mt-1">
          {greetingFor(state.user.name, localHour)}
        </h1>
        {beats.length > 0 && (
          <p className="mt-3 text-sm leading-relaxed text-blue-300/90">
            {beats.join(" ")}
          </p>
        )}
      </section>

      {/* Today's workout — natural intro + hero */}
      <TodaySection state={state} delta={delta} tripForecast={tripForecast} goalName={goal.name} />

      {/* Recovery narrative + stats grid */}
      <section className="pt-5 border-t border-panel-border/40 space-y-3">
        <p className="text-sm leading-relaxed text-foreground/90">
          {recoveryLine(sheet)}
        </p>
        <StatsStrip userId={state.user.id} highlightStats={highlightStats} />
      </section>

      {/* Class progress narrative + summit hero */}
      <section className="pt-5 border-t border-panel-border/40 space-y-3">
        <p className="text-sm leading-relaxed text-foreground/90">
          {classProgressLine(rank)}
        </p>
        <SummitHero userId={state.user.id} deltaFt={summitDeltaFt} />
      </section>

      {/* Featured trail with warm intro */}
      <section className="pt-5 border-t border-panel-border/40 space-y-3">
        <p className="text-sm leading-relaxed text-foreground/90">
          A trail worth thinking about this week
          <span className="text-muted"> —</span>
        </p>
        <Suspense fallback={null}>
          <FeaturedTrailCard />
        </Suspense>
      </section>

      {/* Collapsibles for less-frequent needs */}
      <section className="pt-5 border-t border-panel-border/40 space-y-2">
        <details className="text-sm">
          <summary className="cursor-pointer select-none text-blue-300 hover:text-blue-200 flex items-center gap-2">
            <span className="inline-block transition-transform group-open:rotate-90 text-[10px]">
              ▸
            </span>
            What your coach is thinking
          </summary>
          <div className="mt-3">
            <Suspense fallback={<CoachCardSkeleton label="Coach · thinking" />}>
              <DailyCoachCard
                userId={state.user.id}
                today={state.today}
                tz={state.user.timezone}
                plan={
                  state.plan
                    ? { id: state.plan.id, startDate: state.plan.startDate }
                    : null
                }
              />
            </Suspense>
          </div>
        </details>

        <details className="text-sm">
          <summary className="cursor-pointer select-none text-blue-300 hover:text-blue-200 flex items-center gap-2">
            <span className="text-[10px]">▸</span>
            Trails coming up
          </summary>
          <div className="mt-3">
            <UpcomingTrails userId={state.user.id} tz={state.user.timezone} />
          </div>
        </details>

        <details className="text-sm">
          <summary className="cursor-pointer select-none text-blue-300 hover:text-blue-200 flex items-center gap-2">
            <span className="text-[10px]">▸</span>
            This week&apos;s quest
          </summary>
          <div className="mt-3">
            <WeeklyQuestCard userId={state.user.id} tz={state.user.timezone} />
          </div>
        </details>
      </section>
    </div>
  );
}

async function TodaySection({
  state,
  delta,
  tripForecast,
  goalName,
}: {
  state: Exclude<HomeState, { kind: "no_user" }>;
  delta: CompletionDelta | null;
  tripForecast: DailyForecast | null;
  goalName: string | null;
}) {
  // Trip-week state: dedicated hero already tells the full story.
  if (state.kind === "trip_week") {
    return (
      <TripWeekHero
        trail={state.trail}
        daysUntilTrip={state.daysUntilTrip}
        phaseKind={state.phaseKind}
        todayYmd={state.today}
        todaySession={state.todaySession}
        recentCompletion={state.recentCompletion}
        forecast={tripForecast}
      />
    );
  }

  if (state.kind === "session_pending") {
    return (
      <section className="space-y-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-blue-400">
            Today
          </div>
          <h2 className="text-xl font-semibold mt-0.5">
            {state.session.title}
          </h2>
          <p className="text-sm text-foreground/80 mt-1 leading-relaxed">
            {whyThisWorkout(state.session, goalName)}
          </p>
        </div>
        <QuestPendingHero session={state.session} userId={state.user.id} />
      </section>
    );
  }

  if (state.kind === "session_done") {
    return (
      <section className="space-y-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-accent">
            Done today
          </div>
          <h2 className="text-xl font-semibold mt-0.5">
            {state.session.title}
          </h2>
        </div>
        <QuestDoneHero
          session={state.session}
          workout={state.workout}
          tomorrowSession={state.tomorrowSession}
        />
      </section>
    );
  }

  if (state.kind === "post_workout") {
    return (
      <RecapHero
        session={state.session}
        workout={state.workout}
        freshMinutesAgo={state.freshMinutesAgo}
        delta={delta}
      />
    );
  }

  // no_session
  return (
    <section className="space-y-3">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-muted">
          Today
        </div>
        <h2 className="text-xl font-semibold mt-0.5">Rest day.</h2>
        <p className="text-sm text-foreground/80 mt-1 leading-relaxed">
          Nothing planned. Adaptation happens between the sessions.
        </p>
      </div>
      <NoSessionHero tomorrowSession={state.tomorrowSession} />
    </section>
  );
}
