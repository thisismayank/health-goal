/**
 * Home state engine.
 *
 * The state-aware home surface picks one hero card based on the user's
 * current context. This engine resolves that context once so the home
 * page doesn't need to reason about ordering.
 *
 * Slice 1 supports 3 states:
 *   - session_pending  (today's session exists and is not completed)
 *   - post_workout     (session completed AND workout synced in last 3h)
 *   - session_done     (session completed, no fresh sync)
 *   - no_session       (no planned session today)
 *
 * Future slices will add: rest_day, sick_day, trip_week, level_up,
 * streak_milestone.
 */

import { addDays, differenceInCalendarWeeks } from "date-fns";
import { and, asc, desc, eq, gte, isNotNull, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { trail, trailCompletion } from "@/db/schema";
import {
  getActivePlan,
  getCurrentUser,
  getSessionForDate,
  getWorkoutForPlannedSession,
} from "@/lib/data";
import { parseYmd, todayInTimeZone, ymd } from "@/lib/date";
import { phaseForWeek, type Phase } from "@/lib/plan";
import type {
  PlannedSession,
  Trail,
  TrailCompletion,
  TrainingPlan,
  UserProfile,
  Workout,
} from "@/db/schema";

const POST_WORKOUT_WINDOW_MINUTES = 180; // 3 hours

type HomeStateBase = {
  user: UserProfile;
  today: string;
  plan: TrainingPlan | null;
  weekNumber: number | null;
  phase: Phase | null;
};

export type TripPhase =
  | "final_prep" // T-7 to T-4: last real training window
  | "taper" // T-3 to T-1: rest, hydrate, no strenuous work
  | "trip_day" // T-0: today is the day
  | "post_trip"; // T+1 to T+3: log the completion

export type HomeState =
  | (HomeStateBase & {
      kind: "trip_week";
      trail: Trail;
      daysUntilTrip: number; // 0..7 (positive: days until; 0: today; negative: past for post-trip)
      phaseKind: TripPhase;
      todaySession: PlannedSession | null;
      recentCompletion: TrailCompletion | null;
    })
  | (HomeStateBase & {
      kind: "session_pending";
      session: PlannedSession;
    })
  | (HomeStateBase & {
      kind: "session_done";
      session: PlannedSession;
      workout: Workout | null;
      tomorrowSession: PlannedSession | null;
    })
  | (HomeStateBase & {
      kind: "post_workout";
      session: PlannedSession;
      workout: Workout;
      freshMinutesAgo: number;
    })
  | (HomeStateBase & {
      kind: "no_session";
      tomorrowSession: PlannedSession | null;
    })
  | { kind: "no_user" };

function tripPhaseFor(daysUntilTrip: number): TripPhase | null {
  if (daysUntilTrip >= 4 && daysUntilTrip <= 7) return "final_prep";
  if (daysUntilTrip >= 1 && daysUntilTrip <= 3) return "taper";
  if (daysUntilTrip === 0) return "trip_day";
  if (daysUntilTrip >= -3 && daysUntilTrip <= -1) return "post_trip";
  return null;
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = parseYmd(fromYmd).getTime();
  const b = parseYmd(toYmd).getTime();
  return Math.round((b - a) / 86_400_000);
}

async function findActiveTripTrail(
  userId: number,
  todayYmd: string,
): Promise<Trail | null> {
  // Look 3 days back (post-trip window) → 7 days forward.
  const from = ymd(addDays(parseYmd(todayYmd), -3));
  const to = ymd(addDays(parseYmd(todayYmd), 7));
  // Prefer the soonest upcoming, then most recent past.
  const [upcoming] = await db
    .select()
    .from(trail)
    .where(
      and(
        eq(trail.userId, userId),
        isNotNull(trail.targetDate),
        gte(trail.targetDate, todayYmd),
        lte(trail.targetDate, to),
      ),
    )
    .orderBy(asc(trail.targetDate))
    .limit(1);
  if (upcoming) return upcoming;
  const [past] = await db
    .select()
    .from(trail)
    .where(
      and(
        eq(trail.userId, userId),
        isNotNull(trail.targetDate),
        gte(trail.targetDate, from),
        lte(trail.targetDate, todayYmd),
      ),
    )
    .orderBy(desc(trail.targetDate))
    .limit(1);
  return past ?? null;
}

async function mostRecentCompletionInWindow(
  userId: number,
  trailId: number,
  todayYmd: string,
): Promise<TrailCompletion | null> {
  // Any completion for this trail logged within the past 5 days.
  const cutoff = ymd(addDays(parseYmd(todayYmd), -5));
  const [row] = await db
    .select()
    .from(trailCompletion)
    .where(
      and(
        eq(trailCompletion.userId, userId),
        eq(trailCompletion.trailId, trailId),
        gte(trailCompletion.completedAt, cutoff),
      ),
    )
    .orderBy(desc(trailCompletion.completedAt))
    .limit(1);
  return row ?? null;
}

export async function getHomeState(): Promise<HomeState> {
  const user = await getCurrentUser();
  if (!user) return { kind: "no_user" };

  const today = todayInTimeZone(user.timezone);
  const plan = await getActivePlan(user.id);
  const session = plan ? await getSessionForDate(plan.id, today) : null;

  const weekNumber = plan
    ? differenceInCalendarWeeks(parseYmd(today), parseYmd(plan.startDate), {
        weekStartsOn: 1,
      }) + 1
    : null;
  const phase = weekNumber != null ? phaseForWeek(weekNumber) : null;

  const base: HomeStateBase = { user, today, plan, weekNumber, phase };

  // Trip week takes priority over normal session states — countdown +
  // taper + trip-day + post-trip logging all live under this one branch.
  const tripTrail = await findActiveTripTrail(user.id, today);
  if (tripTrail && tripTrail.targetDate) {
    const days = daysBetween(today, tripTrail.targetDate);
    const phaseKind = tripPhaseFor(days);
    if (phaseKind) {
      const recentCompletion = await mostRecentCompletionInWindow(
        user.id,
        tripTrail.id,
        today,
      );
      return {
        ...base,
        kind: "trip_week",
        trail: tripTrail,
        daysUntilTrip: days,
        phaseKind,
        todaySession: session,
        recentCompletion,
      };
    }
  }

  if (!session) {
    const tomorrowSession = plan
      ? await getSessionForDate(plan.id, ymd(addDays(parseYmd(today), 1)))
      : null;
    return { ...base, kind: "no_session", tomorrowSession };
  }

  if (session.status !== "completed") {
    return { ...base, kind: "session_pending", session };
  }

  const workout = await getWorkoutForPlannedSession(session.id);
  if (workout) {
    const minutesAgo =
      (Date.now() - workout.createdAt.getTime()) / 60_000;
    if (minutesAgo <= POST_WORKOUT_WINDOW_MINUTES) {
      return {
        ...base,
        kind: "post_workout",
        session,
        workout,
        freshMinutesAgo: Math.round(minutesAgo),
      };
    }
  }

  const tomorrowSession = plan
    ? await getSessionForDate(plan.id, ymd(addDays(parseYmd(today), 1)))
    : null;
  return { ...base, kind: "session_done", session, workout, tomorrowSession };
}
