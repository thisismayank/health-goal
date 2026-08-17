import Link from "next/link";
import { and, eq, desc, isNotNull, sql, notInArray, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { workout, trailCompletion } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/data";
import { matchWorkoutToTrails } from "@/lib/basecamp/trail-matcher";
import { BackfillList } from "./backfill-list";
import { RunBackfillButton } from "./run-backfill-button";
import { AutoLinkButton } from "./auto-link-button";
import { TrailsSubNav } from "@/components/shell/trails-sub-nav";
import { pickUnits } from "@/lib/units";

export const dynamic = "force-dynamic";

const HIKEY_TYPES = ["OUTDOOR_HIKE", "LOADED_HIKE", "ZONE2_CARDIO"];

export default async function BackfillPage() {
  const user = await requireOnboardedUser();
  const units = pickUnits(user);

  // Workouts already linked to a trail completion — exclude from
  // suggestions so we don't ask twice.
  const linkedRows = await db
    .select({ workoutId: trailCompletion.workoutId })
    .from(trailCompletion)
    .where(
      and(
        eq(trailCompletion.userId, user.id),
        isNotNull(trailCompletion.workoutId),
      ),
    );
  const linkedIds = linkedRows
    .map((r) => r.workoutId)
    .filter((id): id is number => id != null);

  // Candidate workouts: outdoor-y activities with GPS OR a source name,
  // not already linked. Cap at 100 most recent to keep the page snappy.
  const conditions = [
    eq(workout.userId, user.id),
    inArray(workout.type, HIKEY_TYPES),
  ];
  if (linkedIds.length > 0) {
    conditions.push(notInArray(workout.id, linkedIds));
  }
  const candidates = await db
    .select()
    .from(workout)
    .where(and(...conditions))
    .orderBy(desc(workout.startTime))
    .limit(100);

  const enriched = candidates.map((w) => {
    const matches = matchWorkoutToTrails(w, { limit: 3 });
    return { workout: w, matches };
  });

  const withMatches = enriched.filter((e) => e.matches.length > 0);
  const withoutMatches = enriched.filter((e) => e.matches.length === 0);

  return (
    <div className="space-y-6">
      <TrailsSubNav />
      <section>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Backfill from history</h1>
          <RunBackfillButton />
        </div>
        <p className="text-sm text-muted mt-1">
          Match Garmin activities to trails in the library.{" "}
          <span className="text-blue-300">
            {candidates.length}
          </span>{" "}
          candidate workout{candidates.length === 1 ? "" : "s"} found.
          Suggestions use GPS + activity name — you confirm each match.
        </p>
        <div className="mt-3 flex items-start justify-between gap-3 rounded-md border border-blue-500/20 bg-blue-950/10 p-3">
          <div className="text-xs text-muted leading-relaxed">
            Strong matches (proximity + name overlap ≥ 70%) can be auto-linked
            to your Trail Passport in one click. Weaker candidates still stay
            manual so you don&apos;t inherit wrong picks.
          </div>
          <AutoLinkButton />
        </div>
      </section>

      {candidates.length === 0 && (
        <section className="rounded-md border border-panel-border bg-panel p-4 text-sm text-muted">
          No hike-like workouts in the DB yet. Click{" "}
          <strong className="text-foreground">Sync history</strong> above
          to pull the last year from intervals.icu.
        </section>
      )}

      {withMatches.length > 0 && (
        <section className="space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
            [POSSIBLE MATCHES · {withMatches.length}]
          </div>
          <BackfillList items={withMatches} units={units} />
        </section>
      )}

      {withoutMatches.length > 0 && (
        <section className="space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted">
            [NO MATCH · {withoutMatches.length}]
          </div>
          <div className="text-xs text-muted">
            These didn&apos;t land close to any known trailhead — either
            they&apos;re not hikes, or the trail isn&apos;t in our library
            yet.
          </div>
          <ul className="text-xs text-muted space-y-1 pl-2">
            {withoutMatches.slice(0, 20).map((e) => (
              <li key={e.workout.id}>
                {formatDate(e.workout.startTime)} —{" "}
                {e.workout.sourceName ?? "(unnamed)"}
                {e.workout.distanceMeters != null && (
                  <span className="opacity-60">
                    {" · "}
                    {(e.workout.distanceMeters / 1000).toFixed(1)} km
                  </span>
                )}
              </li>
            ))}
            {withoutMatches.length > 20 && (
              <li className="opacity-60 italic">
                …and {withoutMatches.length - 20} more
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}
