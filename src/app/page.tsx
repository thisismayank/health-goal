import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, gt, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { trail } from "@/db/schema";
import { getHomeState, type HomeState } from "@/lib/home/state";
import { QuestPendingHero } from "@/components/home/quest-pending-hero";
import { QuestDoneHero } from "@/components/home/quest-done-hero";
import { RecapHero } from "@/components/home/recap-hero";
import { NoSessionHero } from "@/components/home/no-session-hero";
import { TripWeekHero } from "@/components/home/trip-week-hero";
import { FeaturedTrailCard } from "@/components/home/featured-trail-card";
import { ObjectiveCard } from "@/components/home/objective-card";
import { OrphanWorkoutCard } from "@/components/home/orphan-workout-card";
import { CoachCardSkeleton, DailyCoachCard } from "@/components/coach-cards";
import {
  computeCompletionDelta,
  type CompletionDelta,
} from "@/lib/basecamp/completion-delta";
import { tryFetchTripForecast } from "@/lib/weather/trip-forecast";
import type { DailyForecast } from "@/lib/weather/open-meteo";
import { computeCharacterSheet } from "@/lib/basecamp/stats";
import { computeRank } from "@/lib/basecamp/rank";
import { detectClassChangeAndUpdate } from "@/lib/basecamp/class-tracker";
import { ClassUpOverlay } from "@/components/home/class-up-overlay";
import { getActiveGoal } from "@/lib/basecamp/summit";
import { whyThisWorkout } from "@/lib/home/framing";

export const dynamic = "force-dynamic";

function daysFromYmd(fromYmd: string, toYmd: string): number {
  const [y1, m1, d1] = fromYmd.split("-").map(Number);
  const [y2, m2, d2] = toYmd.split("-").map(Number);
  const from = Date.UTC(y1, m1 - 1, d1);
  const to = Date.UTC(y2, m2 - 1, d2);
  return Math.round((to - from) / 86_400_000);
}

/**
 * Home. Redesigned per Devin's Home critique:
 *
 * - Thin context line, not an h1 greeting
 * - Today section is the daily loop — session + Done/Log/Skip actions
 *   (or the 'was this your session?' import-confirm card when
 *   auto-linking missed a real workout)
 * - Your objective card: primary trail verdict + weakest dimension +
 *   weeks-to-ready. Absorbs the trip card + broken summit meter roles.
 * - Coach is expanded (not accordion) and links straight into chat
 * - Below fold: featured trail. Weekly quest, stats grid, and
 *   character-sheet moved to their tabs — they belong there.
 *
 * The shape differs per state via TodaySection: session_pending /
 * session_done / post_workout / trip_week / no_session.
 */
export default async function HomePage() {
  const state = await getHomeState();

  if (state.kind === "no_user") redirect("/login");
  if (!state.user.onboardedAt) redirect("/welcome");

  const delta =
    state.kind === "post_workout"
      ? await computeCompletionDelta({
          userId: state.user.id,
          workoutId: state.workout.id,
          plannedSessionId: state.workout.plannedSessionId,
          todayYmd: state.today,
        })
      : null;

  const tripForecast: DailyForecast | null =
    state.kind === "trip_week" && state.trail.targetDate
      ? await tryFetchTripForecast({
          trailName: state.trail.name,
          notes: state.trail.notes,
          targetDate: state.trail.targetDate,
        })
      : null;

  // Class-up celebration (unchanged — this is a moment, not chrome)
  const sheet = await computeCharacterSheet(state.user.id);
  const rank = computeRank(sheet);
  const classChange = await detectClassChangeAndUpdate(
    state.user.id,
    rank.current,
  );
  const upgradeMoment = classChange?.direction === "up" ? classChange : null;

  // Context line beats — primary trail proximity + next trip
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
  const primaryDays =
    primaryTrail?.targetDate != null
      ? daysFromYmd(state.today, primaryTrail.targetDate)
      : null;

  const dayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: state.user.timezone,
  }).format(new Date());

  return (
    <div className="space-y-5">
      {upgradeMoment && <ClassUpOverlay change={upgradeMoment} />}

      {/* Thin context line. No h1 greeting. */}
      <section>
        <div className="text-[11px] uppercase tracking-widest text-muted flex flex-wrap items-baseline gap-x-2">
          <span>{dayLabel}</span>
          {nextTrip && nextTripDays != null && nextTripDays >= 0 && (
            <span className="text-blue-300/90 normal-case tracking-normal">
              · {shortTripLine(nextTrip.name, nextTripDays)}
            </span>
          )}
          {primaryTrail &&
            primaryDays != null &&
            primaryDays >= 0 &&
            (nextTrip?.id !== primaryTrail.id) && (
              <span className="text-muted normal-case tracking-normal">
                · {shortTripLine(primaryTrail.name, primaryDays)}
              </span>
            )}
        </div>
      </section>

      {/* TODAY — the daily loop. Session + Done/Log/Skip via the
          existing hero components (which own the log form). */}
      <TodaySection
        state={state}
        delta={delta}
        tripForecast={tripForecast}
        goalName={goal.name}
      />

      {/* Auto-match confirm card. Silent when no candidate — surfaces
          orphan imports so compliance closes without opening /train. */}
      <Suspense fallback={null}>
        <OrphanWorkoutCard />
      </Suspense>

      {/* YOUR OBJECTIVE — verdict + weakest dimension + weeks-to-ready.
          Replaces the broken summit meter + separate trip card. */}
      <Suspense fallback={null}>
        <ObjectiveCard user={state.user} />
      </Suspense>

      {/* COACH — expanded, not collapsed. Two-way chat link. */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
            [COACH · TODAY]
          </div>
          <Link
            href="/coach"
            className="text-xs text-blue-300 hover:underline"
          >
            Chat with the coach →
          </Link>
        </div>
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
      </section>

      {/* BELOW FOLD — trail worth thinking about. Nothing else fights
          for attention up top. Character sheet + weekly quest live on
          their own tabs where they have context. */}
      <section className="pt-5 border-t border-panel-border/40 space-y-3">
        <Suspense fallback={null}>
          <FeaturedTrailCard />
        </Suspense>
      </section>
    </div>
  );
}

function shortTripLine(name: string, days: number): string {
  const short = name.split(" — ")[0].split(/[·•]/)[0].trim();
  if (days === 0) return `${short} today`;
  if (days === 1) return `${short} tomorrow`;
  return `${short} in ${days}d`;
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
          <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
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
          <div className="text-[10px] font-mono uppercase tracking-widest text-accent">
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

  // no_session — deliberately quiet.
  return (
    <section className="space-y-3">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted">
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
