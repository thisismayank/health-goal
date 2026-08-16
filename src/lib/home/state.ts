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

export type HomeState =
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
