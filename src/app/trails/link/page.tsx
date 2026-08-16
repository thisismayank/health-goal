import Link from "next/link";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { trail, trailCompletion, workout } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/data";
import { backfillSourceNamesFromStrava } from "@/lib/trails/backfill";
import {
  suggestFromSavedTrails,
  suggestPresetsForName,
} from "@/lib/trails/auto-match";
import { LinkSuggestionRow } from "@/components/trails/link-suggestion-row";

export const dynamic = "force-dynamic";

// Only match hike-family workouts against trails. Runs on a treadmill etc.
// aren't trail attempts even if the name mentions a peak.
const HIKE_CATS = [
  "OUTDOOR_HIKE",
  "LOADED_HIKE",
  "LONG_MOUNTAIN_SESSION",
];

export default async function TrailLinkPage() {
  const user = await requireOnboardedUser();

  // Idempotent: populates sourceName for legacy Strava rows that predate
  // the column. After the first visit, this is a no-op each time.
  await backfillSourceNamesFromStrava(user.id);

  // Workouts already linked to a trail (via trailCompletion.workoutId).
  const alreadyLinked = await db
    .select({ workoutId: trailCompletion.workoutId })
    .from(trailCompletion)
    .where(eq(trailCompletion.userId, user.id));
  const linkedSet = new Set(
    alreadyLinked
      .map((r) => r.workoutId)
      .filter((v): v is number => v != null),
  );

  const candidates = await db
    .select()
    .from(workout)
    .where(
      and(
        eq(workout.userId, user.id),
        isNotNull(workout.sourceName),
        inArray(workout.type, HIKE_CATS),
      ),
    )
    .orderBy(desc(workout.startTime));

  const unlinked = candidates.filter((w) => !linkedSet.has(w.id));

  const savedTrails = await db
    .select({
      id: trail.id,
      name: trail.name,
      presetSlug: trail.presetSlug,
    })
    .from(trail)
    .where(eq(trail.userId, user.id));

  const items = unlinked.map((w) => {
    const name = w.sourceName ?? "";
    const savedMatches = suggestFromSavedTrails(name, savedTrails).map((m) => ({
      trailId: m.trail.id,
      trailName: m.trail.name,
      score: m.score,
    }));
    const presetMatches =
      savedMatches.length > 0
        ? []
        : suggestPresetsForName(name).map((m) => ({
            slug: m.preset.slug,
            name: m.preset.name,
            region: m.preset.region,
            score: m.score,
          }));
    return { workout: w, savedMatches, presetMatches };
  });

  const suggested = items.filter(
    (x) => x.savedMatches.length > 0 || x.presetMatches.length > 0,
  );
  const unresolvedCount = items.length - suggested.length;

  return (
    <div className="space-y-5">
      <section>
        <Link
          href="/trails"
          className="text-xs text-muted hover:text-foreground"
        >
          ← Trails
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Backfill your passport</h1>
        <p className="text-sm text-muted mt-1 leading-relaxed">
          Basecamp scanned your{" "}
          <span className="text-foreground">{candidates.length}</span> synced
          hikes for matches against the trail library. Tap Link to add each
          match to your Trail Passport.
        </p>
      </section>

      {suggested.length === 0 ? (
        <section className="rounded-lg border border-panel-border bg-panel p-5 text-sm text-muted leading-relaxed">
          <p>
            No new automatic matches found. That can mean everything's already
            linked, or your Strava activity names don't contain trail names
            we recognize (e.g. named &quot;Morning hike&quot; not &quot;Angel's
            Landing&quot;).
          </p>
          <p className="mt-2">
            You can still log completions manually — open any saved trail and
            tap{" "}
            <span className="text-accent font-medium">✓ I've done this</span>.
          </p>
        </section>
      ) : (
        <>
          <section className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs uppercase tracking-widest text-muted">
                Auto-matched · {suggested.length}
              </h2>
            </div>
            <div className="space-y-2">
              {suggested.map((item) => (
                <LinkSuggestionRow
                  key={item.workout.id}
                  workoutId={item.workout.id}
                  workoutName={item.workout.sourceName ?? "Untitled workout"}
                  workoutDateLabel={new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: user.timezone,
                  }).format(item.workout.startTime)}
                  workoutDetail={workoutSummary(item.workout)}
                  savedMatches={item.savedMatches}
                  presetMatches={item.presetMatches}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {unresolvedCount > 0 && (
        <p className="text-xs text-muted italic">
          {unresolvedCount} other unlinked hike
          {unresolvedCount === 1 ? "" : "s"} had no confident match. Log those
          manually from the trail's page if you want them stamped.
        </p>
      )}
    </div>
  );
}

function workoutSummary(w: {
  durationSeconds: number | null;
  distanceMeters: number | null;
  elevationGainMeters: number | null;
  type: string;
}): string {
  const parts: string[] = [];
  if (w.durationSeconds != null) {
    const min = Math.round(w.durationSeconds / 60);
    const h = Math.floor(min / 60);
    const mm = min % 60;
    parts.push(h > 0 ? `${h}h ${mm}m` : `${mm}m`);
  }
  if (w.distanceMeters != null && w.distanceMeters > 0) {
    parts.push(`${(w.distanceMeters / 1000).toFixed(1)} km`);
  }
  if (w.elevationGainMeters != null && w.elevationGainMeters > 0) {
    parts.push(`+${Math.round(w.elevationGainMeters * 3.281)} ft`);
  }
  parts.push(w.type.replaceAll("_", " ").toLowerCase());
  return parts.join(" · ");
}
