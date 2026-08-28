import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stravaAccount, trail, trainingPlan } from "@/db/schema";

/**
 * Cold-start welcome banner. Renders once, on the first Home visit
 * after signup via /start, driven by ?welcome=cold-start. The whole
 * point is to close the loop opened by the /start verdict card:
 * "you cared about this hike, we saved it and built you a plan —
 * here's what happens next."
 *
 * Dismissible via a same-page link that drops the query param.
 */
export async function WelcomeBanner({ userId }: { userId: number }) {
  const [primary] = await db
    .select({ name: trail.name })
    .from(trail)
    .where(and(eq(trail.userId, userId), eq(trail.isPrimary, true)))
    .limit(1);

  const [plan] = await db
    .select({
      id: trainingPlan.id,
      startDate: trainingPlan.startDate,
    })
    .from(trainingPlan)
    .where(
      and(
        eq(trainingPlan.userId, userId),
        eq(trainingPlan.status, "active"),
      ),
    )
    .limit(1);

  const [strava] = await db
    .select({ athleteId: stravaAccount.athleteId })
    .from(stravaAccount)
    .where(eq(stravaAccount.userId, userId))
    .limit(1);
  const stravaConnected = !!strava;

  const trailShort = primary
    ? primary.name.split(" — ")[0].split(/[·•]/)[0].trim()
    : null;

  return (
    <section className="rounded-lg border border-blue-500/40 bg-blue-950/10 p-4 sm:p-5 space-y-3 shadow-lg shadow-blue-500/10">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
          [WELCOME]
        </div>
        <Link
          href="/"
          className="text-[11px] text-muted hover:text-foreground"
        >
          Dismiss ×
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-semibold leading-tight">
          {trailShort
            ? `Your plan for ${trailShort} is live.`
            : "You're in."}
        </h2>
        <p className="text-sm text-muted mt-1 leading-relaxed">
          {plan
            ? "First week starts today. Your daily session shows up below — log it, skip it, or swap it. Ratings will get sharper as you feed in data."
            : "Head to Plan to build your training block. Ratings sharpen as you log workouts."}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
        <Link
          href="/train"
          className="rounded-md border border-blue-500/40 bg-blue-950/20 hover:border-blue-400 px-3 py-2 text-sm font-medium text-blue-100 text-center"
        >
          See this week →
        </Link>
        {!stravaConnected && (
          <Link
            href="/api/strava/connect"
            className="rounded-md border border-panel-border bg-panel hover:border-blue-500/40 px-3 py-2 text-sm text-center"
          >
            Connect Strava
            <span className="block text-[10px] text-muted mt-0.5">
              optional · sharper reads
            </span>
          </Link>
        )}
        <Link
          href="/settings"
          className="rounded-md border border-panel-border bg-panel hover:border-blue-500/40 px-3 py-2 text-sm text-center"
        >
          Set your target date
          <span className="block text-[10px] text-muted mt-0.5">
            weeks-to-ready needs it
          </span>
        </Link>
      </div>
    </section>
  );
}
