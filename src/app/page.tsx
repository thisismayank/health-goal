import { Suspense } from "react";
import { getHomeState, type HomeState } from "@/lib/home/state";
import { QuestPendingHero } from "@/components/home/quest-pending-hero";
import { QuestDoneHero } from "@/components/home/quest-done-hero";
import { RecapHero } from "@/components/home/recap-hero";
import { NoSessionHero } from "@/components/home/no-session-hero";
import { StatsStrip } from "@/components/home/stats-strip";
import { SummitHero } from "@/components/summit-hero";
import { UpcomingTrails } from "@/components/upcoming-trails";
import { CoachCardSkeleton, DailyCoachCard } from "@/components/coach-cards";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const state = await getHomeState();

  if (state.kind === "no_user") {
    return (
      <div className="text-center text-muted py-16">
        No user found. Run <code className="text-foreground">npm run db:seed</code>{" "}
        to initialize.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Greeting state={state} />
      <Hero state={state} />
      <StatsStrip userId={state.user.id} />
      <SummitHero userId={state.user.id} />
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
}: {
  state: Exclude<HomeState, { kind: "no_user" }>;
}) {
  switch (state.kind) {
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
        />
      );
    case "no_session":
      return <NoSessionHero tomorrowSession={state.tomorrowSession} />;
  }
}
