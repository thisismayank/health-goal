import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getHomeState, type HomeState } from "@/lib/home/state";
import { QuestPendingHero } from "@/components/home/quest-pending-hero";
import { QuestDoneHero } from "@/components/home/quest-done-hero";
import { RecapHero } from "@/components/home/recap-hero";
import { NoSessionHero } from "@/components/home/no-session-hero";
import { TripWeekHero } from "@/components/home/trip-week-hero";
import { StatsStrip } from "@/components/home/stats-strip";
import { WeeklyQuestCard } from "@/components/home/weekly-quest-card";
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

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const state = await getHomeState();

  if (state.kind === "no_user") {
    // Session cookie was present but invalid/expired — send back to login.
    redirect("/login");
  }

  // Route new users through the onboarding wizard.
  if (!state.user.onboardedAt) {
    redirect("/welcome");
  }

  // Post-workout state = compute the delta once, cascade it through the
  // hero, stats strip, and summit hero so the whole surface reflects
  // what just changed.
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

  // Fetch trip-day forecast when we're in a trip-week state so the hero
  // can render weather inline. Best-effort — null if the trail's region
  // isn't in POPULAR_DESTINATIONS or date is beyond horizon.
  const tripForecast: DailyForecast | null =
    state.kind === "trip_week" && state.trail.targetDate
      ? await tryFetchTripForecast({
          trailName: state.trail.name,
          notes: state.trail.notes,
          targetDate: state.trail.targetDate,
        })
      : null;

  // Class-up detection — compare current computed class vs last_known
  // and celebrate if the user just crossed a threshold. Also updates
  // last_known so it fires at most once per real change.
  const currentSheet = await computeCharacterSheet(state.user.id);
  const currentRank = computeRank(currentSheet);
  const classChange = await detectClassChangeAndUpdate(
    state.user.id,
    currentRank.current,
  );
  const upgradeMoment = classChange?.direction === "up" ? classChange : null;

  return (
    <div className="space-y-5">
      {upgradeMoment && <ClassUpOverlay change={upgradeMoment} />}
      <Greeting state={state} />
      <Hero state={state} delta={delta} tripForecast={tripForecast} />
      <StatsStrip userId={state.user.id} highlightStats={highlightStats} />
      <WeeklyQuestCard userId={state.user.id} tz={state.user.timezone} />
      <SummitHero userId={state.user.id} deltaFt={summitDeltaFt} />
      <UpcomingTrails userId={state.user.id} tz={state.user.timezone} />
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
  );
}

function Greeting({
  state,
}: {
  state: Exclude<HomeState, { kind: "no_user" }>;
}) {
  const dayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: state.user.timezone,
  }).format(new Date());
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted">
        {dayLabel}
      </div>
      <h1 className="text-2xl font-semibold mt-0.5">
        {greetingFor(state.user.name)}
      </h1>
    </div>
  );
}

function greetingFor(name: string): string {
  const hour = new Date().getHours();
  const first = name.split(" ")[0];
  if (hour < 5) return `Still up, ${first}?`;
  if (hour < 12) return `Good morning, ${first}.`;
  if (hour < 17) return `Afternoon, ${first}.`;
  if (hour < 21) return `Evening, ${first}.`;
  return `Late night, ${first}.`;
}

async function Hero({
  state,
  delta,
  tripForecast,
}: {
  state: Exclude<HomeState, { kind: "no_user" }>;
  delta: CompletionDelta | null;
  tripForecast: DailyForecast | null;
}) {
  switch (state.kind) {
    case "trip_week":
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
    case "session_pending":
      return (
        <QuestPendingHero session={state.session} userId={state.user.id} />
      );
    case "session_done":
      return (
        <QuestDoneHero
          session={state.session}
          workout={state.workout}
          tomorrowSession={state.tomorrowSession}
        />
      );
    case "post_workout":
      return (
        <RecapHero
          session={state.session}
          workout={state.workout}
          freshMinutesAgo={state.freshMinutesAgo}
          delta={delta}
        />
      );
    case "no_session":
      return <NoSessionHero tomorrowSession={state.tomorrowSession} />;
  }
}
