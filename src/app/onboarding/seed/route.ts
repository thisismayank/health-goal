import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { trail, userProfile, type PlanGoalType } from "@/db/schema";
import { getUserFromSession } from "@/lib/auth/sessions";
import { readAndConsumeSeed } from "@/lib/cold-start/seed";
import {
  findTrailBySlug,
  type TrailPreset,
} from "@/lib/basecamp/trail-library";
import { getFullTrailLibrary } from "@/lib/basecamp/trail-coords";
import type { ColdStartAnswers } from "@/lib/basecamp/synthetic-snapshot";
import { generateUserPlan } from "@/lib/plan/generator";
import { track } from "@/lib/analytics/track";

export const dynamic = "force-dynamic";

/**
 * Cold-start post-signup handoff.
 *
 * Runs once, right after a user signs up via the /start flow. Reads
 * the signed seed cookie the pre-auth /start page wrote, then:
 *   1. Marks the user onboarded + seeds profile fields from bucketed
 *      answers (skipped for returning users so /start peeks don't
 *      clobber existing preferences).
 *   2. Saves the chosen trail as primary.
 *   3. Auto-generates a plan sized to the objective (mountain_summit
 *      for mountaineering / high altitude, trail_hike otherwise).
 *   4. Redirects to /?welcome=cold-start so Home renders the
 *      welcome banner instead of /welcome pitching them again.
 *
 * Idempotent-ish: if there's no seed cookie or the seed already
 * consumed, we redirect to home. If the trail slug doesn't resolve
 * we skip trail + plan work. Plan generator is itself idempotent
 * against an existing active plan.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/onboarding/seed", url));
  }

  const seed = await readAndConsumeSeed();
  if (!seed) {
    // No seed (direct visit, expired, or already consumed). Just
    // land on home — routing there will steer to /welcome if the
    // user isn't onboarded yet.
    return NextResponse.redirect(new URL("/", url));
  }

  const { weeklyHours, startingFitness } = mapAnswers(seed.answers);

  // Only seed profile fields + mark onboarded for TRULY new users.
  // A returning user who peeks at /start and picks a trail shouldn't
  // have their existing weeklyTrainingHours / startingFitness
  // overwritten by cold-start buckets. Trail-save + plan-gen below
  // are independently idempotent — safe either way.
  const isFirstTime = !user.onboardedAt;
  if (isFirstTime) {
    await db
      .update(userProfile)
      .set({
        weeklyTrainingHours: weeklyHours,
        startingFitness,
        // Persist raw answers — the verdict engine layers them into
        // FitnessSnapshot as a permanent per-dim floor so the
        // verdict doesn't silently degrade the moment the user
        // hands over their email. Devin's Reddit-launch test caught
        // the failure mode this fixes.
        coldStartAnswers: seed.answers,
        onboardedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userProfile.id, user.id));
  }

  // Save the trail as primary — the whole hook of cold-start is
  // "you cared about this hike enough to answer three questions;
  // it's now your objective."
  const preset =
    findTrailBySlug(seed.slug) ??
    getFullTrailLibrary().find((p) => p.slug === seed.slug);
  if (preset) {
    // Enforce the "one primary at a time" invariant: unmark all
    // existing primaries first, then insert/mark ours.
    await db
      .update(trail)
      .set({ isPrimary: false })
      .where(and(eq(trail.userId, user.id), eq(trail.isPrimary, true)));

    const [existing] = await db
      .select({ id: trail.id })
      .from(trail)
      .where(
        and(eq(trail.userId, user.id), eq(trail.presetSlug, preset.slug)),
      )
      .limit(1);
    if (existing) {
      await db
        .update(trail)
        .set({ isPrimary: true })
        .where(eq(trail.id, existing.id));
    } else {
      await db.insert(trail).values({
        userId: user.id,
        name: preset.name,
        distanceKm: preset.distanceKm,
        elevationGainFt: preset.elevationGainFt,
        maxAltitudeFt: preset.maxAltitudeFt,
        typicalHours: preset.typicalHours,
        packWeightLb: preset.packWeightLb,
        terrainGrade: preset.terrainGrade,
        notes: preset.notes
          ? `${preset.region} — ${preset.notes}`
          : preset.region,
        presetSlug: preset.slug,
        isPrimary: true,
      });
    }

    // Auto-generate a plan sized to the objective. Idempotent — if the
    // user already had an active plan we short-circuit. Ship-fast beats
    // dropping them into a wizard right after they answered three
    // questions on /start.
    try {
      const goalType = inferGoalType(preset);
      await generateUserPlan({
        userId: user.id,
        weeklyHours,
        startingFitness,
        goalType,
        goalEvent: preset.name,
      });
    } catch (err) {
      // Best-effort — plan generation errors shouldn't block the user
      // from reaching Home. They can always regenerate from /plan/new.
      console.error("cold-start plan generation failed:", err);
    }
  }

  await track("onboarded", {
    userId: user.id,
    properties: {
      slug: seed.slug,
      weeklyHours,
      startingFitness,
      firstTime: isFirstTime,
    },
  });

  // Land on Home with a welcome banner. Cold-start users have already
  // seen the pitch on /start — /welcome would repeat it.
  return NextResponse.redirect(new URL("/?welcome=cold-start", url));
}

// Mountaineering + high-altitude presets get the 40-week
// mountain_summit template; everything else gets the 12-week
// trail_hike template so Bear Mountain doesn't come back as a
// 40-week Rainier plan.
function inferGoalType(preset: TrailPreset): PlanGoalType {
  if (preset.terrainGrade === "mountaineering") return "mountain_summit";
  if (preset.terrainGrade === "technical") return "mountain_summit";
  if (preset.maxAltitudeFt >= 12000) return "mountain_summit";
  return "trail_hike";
}

// Cold-start buckets → the plan generator's constraint shape. The
// generator doesn't take our raw buckets, and we don't want to change
// its signature just for this path. Map with the same conservatism
// as synthSnapshot — lower end of each range so the plan doesn't
// over-prescribe.
function mapAnswers(
  a: ColdStartAnswers,
): { weeklyHours: 3 | 5 | 7 | 10; startingFitness: "new" | "occasional" | "regular" | "active" } {
  const weeklyHours: 3 | 5 | 7 | 10 =
    a.weeklyHoursBucket === "over_6"
      ? 7
      : a.weeklyHoursBucket === "3_to_6"
        ? 5
        : 3;
  // Fitness self-report proxy: longest-hike bucket. Someone who's
  // done 10+ hour days is 'active'; a beginner who has never hiked
  // is 'new'.
  const startingFitness: "new" | "occasional" | "regular" | "active" =
    a.longestHikeBucket === "never"
      ? "new"
      : a.longestHikeBucket === "under_3"
        ? "occasional"
        : a.longestHikeBucket === "3_to_6"
          ? "regular"
          : "active";
  return { weeklyHours, startingFitness };
}
