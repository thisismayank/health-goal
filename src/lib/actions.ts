"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { notifySquadOfCompletion } from "@/lib/notifications/squad-activity";
import {
  dailyMetric,
  plannedSession,
  squad,
  squadMember,
  stravaAccount,
  strengthExercise,
  trail,
  trailCompletion,
  trainingPlan,
  userProfile,
  workout,
  PLAN_GOAL_TYPES,
  SESSION_CATEGORIES,
  type PlanGoalType,
  type SessionCategory,
  type TrailTerrainGrade,
} from "@/db/schema";
import { getCurrentUser } from "./data";
import {
  getCumulativeVerticalFt,
  RAINIER_SUMMIT_FT,
  WAYPOINTS,
  type Waypoint,
} from "./basecamp/summit";

export type LoggedStrengthSet = {
  reps: number | null;
  weightKg: number | null;
  rir: number | null;
};

export type LoggedExercise = {
  name: string;
  sets: LoggedStrengthSet[];
};

export type CompleteSessionInput = {
  plannedSessionId: number;
  actualDurationMinutes: number;
  rpe: number;
  notes?: string;
  exercises?: LoggedExercise[];
  packWeightLb?: number;
};

export type CompletionSummary = {
  sessionTitle: string;
  categoryDisplay: string;
  actualDurationMinutes: number;
  rpe: number;
  verticalGainedFt: number;
  newTotalFt: number;
  waypointCleared: Waypoint | null;
  summitCount: number;
};

export async function completeSession(input: CompleteSessionInput): Promise<{
  workoutId: number;
  summary: CompletionSummary;
}> {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");

  const [ps] = await db
    .select()
    .from(plannedSession)
    .where(eq(plannedSession.id, input.plannedSessionId))
    .limit(1);
  if (!ps) throw new Error("Planned session not found");

  const preTotalFt = await getCumulativeVerticalFt(user.id);

  const endTime = new Date();
  const startTime = new Date(
    endTime.getTime() - input.actualDurationMinutes * 60_000,
  );

  const packWeightKg = input.packWeightLb != null
    ? +(input.packWeightLb / 2.205).toFixed(2)
    : null;

  const [w] = await db
    .insert(workout)
    .values({
      userId: user.id,
      plannedSessionId: ps.id,
      startTime,
      endTime,
      type: ps.sessionCategory,
      durationSeconds: input.actualDurationMinutes * 60,
      rpe: input.rpe,
      notes: input.notes ?? null,
      packWeightKg,
      canonicalSource: "manual",
    })
    .returning();

  if (input.exercises && input.exercises.length > 0) {
    const rows = input.exercises.flatMap((ex) =>
      ex.sets
        .filter((s) => s.reps != null || s.weightKg != null)
        .map((s, i) => ({
          workoutId: w.id,
          exerciseName: ex.name,
          setNumber: i + 1,
          reps: s.reps,
          weightKg: s.weightKg,
          rir: s.rir,
        })),
    );
    if (rows.length > 0) {
      await db.insert(strengthExercise).values(rows);
    }
  }

  await db
    .update(plannedSession)
    .set({ status: "completed" })
    .where(eq(plannedSession.id, ps.id));

  const postTotalFt = await getCumulativeVerticalFt(user.id);
  const verticalGainedFt = Math.max(0, postTotalFt - preTotalFt);

  // Waypoint cleared? Compare pre/post within the CURRENT mountain (mod summit).
  // A single workout can push you past multiple waypoints; report the highest.
  const perMountain = RAINIER_SUMMIT_FT;
  const preRemainder = preTotalFt % perMountain;
  const postRemainder = postTotalFt % perMountain;
  // Handle the case where we crossed a full summit (preRemainder is high,
  // postRemainder wraps back). Then anything the postRemainder is above counts.
  const crossedSummit = Math.floor(postTotalFt / perMountain) > Math.floor(preTotalFt / perMountain);
  const waypointCleared = WAYPOINTS.reduce<Waypoint | null>((best, w) => {
    const justCrossed = crossedSummit
      ? postRemainder >= w.ft
      : preRemainder < w.ft && postRemainder >= w.ft;
    if (justCrossed && (!best || w.ft > best.ft)) return w;
    return best;
  }, null);

  revalidatePath("/");
  revalidatePath("/week");
  revalidatePath("/character");

  return {
    workoutId: w.id,
    summary: {
      sessionTitle: ps.title,
      categoryDisplay: ps.sessionCategory.replaceAll("_", " ").toLowerCase(),
      actualDurationMinutes: input.actualDurationMinutes,
      rpe: input.rpe,
      verticalGainedFt,
      newTotalFt: postTotalFt,
      waypointCleared,
      summitCount: Math.floor(postTotalFt / perMountain),
    },
  };
}

export async function skipSession(plannedSessionId: number) {
  await db
    .update(plannedSession)
    .set({ status: "skipped" })
    .where(eq(plannedSession.id, plannedSessionId));
  revalidatePath("/");
  revalidatePath("/week");
}

export async function reopenSession(plannedSessionId: number) {
  await db
    .update(plannedSession)
    .set({ status: "planned" })
    .where(eq(plannedSession.id, plannedSessionId));
  // Unlink any workouts (preserves imported/manual data as extras on that day)
  // rather than deleting them.
  await db
    .update(workout)
    .set({ plannedSessionId: null })
    .where(eq(workout.plannedSessionId, plannedSessionId));
  revalidatePath("/");
  revalidatePath("/week");
  revalidatePath("/history");
}

export async function logBodyMetric(input: {
  date: string;
  weightKg?: number | null;
  fatigue?: number | null;
  notes?: string | null;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");

  const existing = await db
    .select()
    .from(dailyMetric)
    .where(and(eq(dailyMetric.userId, user.id), eq(dailyMetric.date, input.date)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(dailyMetric)
      .set({
        bodyWeightKg: input.weightKg ?? existing[0].bodyWeightKg,
        fatigue1to10: input.fatigue ?? existing[0].fatigue1to10,
        notes: input.notes ?? existing[0].notes,
      })
      .where(eq(dailyMetric.id, existing[0].id));
  } else {
    await db.insert(dailyMetric).values({
      userId: user.id,
      date: input.date,
      bodyWeightKg: input.weightKg ?? null,
      fatigue1to10: input.fatigue ?? null,
      notes: input.notes ?? null,
    });
  }

  revalidatePath("/body");
  revalidatePath("/");
}

export async function syncStravaNow() {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  const { syncRecent } = await import("./strava/sync");
  const results = await syncRecent(user.id, 30);
  // If the plan hasn't been started yet, use fresh data to reclassify
  // fitness and regenerate. No-op if user has completed anything.
  try {
    const { refreshPlanIfEligible } = await import("./plan/generator");
    await refreshPlanIfEligible(user.id);
  } catch (e) {
    console.error("[syncStravaNow] refresh failed:", e);
  }
  revalidatePath("/");
  revalidatePath("/week");
  revalidatePath("/history");
  revalidatePath("/settings");
  revalidatePath("/train");
  const created = results.filter((r) => r.action === "created").length;
  const updated = results.filter((r) => r.action === "updated").length;
  return { total: results.length, created, updated };
}

export type CreateTrailInput = {
  name: string;
  url?: string;
  distanceKm: number;
  elevationGainFt: number;
  maxAltitudeFt: number;
  typicalHours: number;
  packWeightLb?: number;
  terrainGrade: TrailTerrainGrade;
  targetDate?: string;
  notes?: string;
};

export async function createTrailFromPreset(slug: string, targetDate?: string): Promise<{ id: number }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  const { findTrailBySlug } = await import("./basecamp/trail-library");
  const preset = findTrailBySlug(slug);
  if (!preset) throw new Error(`Preset not found: ${slug}`);

  // Idempotent: if the user already saved this preset, return that
  // row instead of creating a duplicate. If a target date is passed
  // and the existing row has none, patch it in. This is what fixes
  // the 'Skyline saved twice with different pack weights' bug —
  // previously every save action inserted a fresh row.
  const [existing] = await db
    .select({ id: trail.id, targetDate: trail.targetDate })
    .from(trail)
    .where(and(eq(trail.userId, user.id), eq(trail.presetSlug, preset.slug)))
    .limit(1);
  if (existing) {
    if (targetDate && !existing.targetDate) {
      await db
        .update(trail)
        .set({ targetDate })
        .where(eq(trail.id, existing.id));
    }
    revalidatePath("/trails");
    return { id: existing.id };
  }

  const [row] = await db
    .insert(trail)
    .values({
      userId: user.id,
      name: preset.name,
      url: null,
      distanceKm: preset.distanceKm,
      elevationGainFt: preset.elevationGainFt,
      maxAltitudeFt: preset.maxAltitudeFt,
      typicalHours: preset.typicalHours,
      packWeightLb: preset.packWeightLb,
      terrainGrade: preset.terrainGrade,
      targetDate: targetDate ?? null,
      notes: `${preset.notes} · Sources: ${preset.sources.join(", ")}`,
      presetSlug: preset.slug,
    })
    .returning({ id: trail.id });
  revalidatePath("/trails");
  return { id: row.id };
}

export async function setPrimaryTrail(trailId: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  // Ensure the trail belongs to this user
  const [existing] = await db
    .select()
    .from(trail)
    .where(and(eq(trail.id, trailId), eq(trail.userId, user.id)))
    .limit(1);
  if (!existing) throw new Error("Trail not found");
  // Unset any current primary, then set the new one
  await db
    .update(trail)
    .set({ isPrimary: false })
    .where(and(eq(trail.userId, user.id), eq(trail.isPrimary, true)));
  await db
    .update(trail)
    .set({ isPrimary: true })
    .where(eq(trail.id, trailId));
  revalidatePath("/trails");
  revalidatePath("/");
  revalidatePath(`/trails/${trailId}`);
}

export async function unsetPrimaryTrail(trailId: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  await db
    .update(trail)
    .set({ isPrimary: false })
    .where(and(eq(trail.id, trailId), eq(trail.userId, user.id)));
  revalidatePath("/trails");
  revalidatePath("/");
  revalidatePath(`/trails/${trailId}`);
}

export async function createTrail(input: CreateTrailInput): Promise<{ id: number }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  const [row] = await db
    .insert(trail)
    .values({
      userId: user.id,
      name: input.name,
      url: input.url ?? null,
      distanceKm: input.distanceKm,
      elevationGainFt: input.elevationGainFt,
      maxAltitudeFt: input.maxAltitudeFt,
      typicalHours: input.typicalHours,
      packWeightLb: input.packWeightLb ?? 0,
      terrainGrade: input.terrainGrade,
      targetDate: input.targetDate ?? null,
      notes: input.notes ?? null,
    })
    .returning({ id: trail.id });
  revalidatePath("/trails");
  return { id: row.id };
}

export type UpdateTrailInput = {
  trailId: number;
  name?: string;
  packWeightLb?: number;
  targetDate?: string | null;
  notes?: string | null;
};

export async function updateTrail(input: UpdateTrailInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");

  const patch: Record<string, unknown> = {};
  if (input.name != null && input.name.trim()) patch.name = input.name.trim();
  if (input.packWeightLb != null) {
    if (input.packWeightLb < 0)
      throw new Error("Pack weight must be non-negative");
    patch.packWeightLb = input.packWeightLb;
  }
  if (input.targetDate !== undefined) {
    patch.targetDate = input.targetDate || null;
  }
  if (input.notes !== undefined) {
    patch.notes = input.notes?.trim() || null;
  }

  if (Object.keys(patch).length === 0) return;

  await db
    .update(trail)
    .set(patch)
    .where(and(eq(trail.id, input.trailId), eq(trail.userId, user.id)));
  revalidatePath("/trails");
  revalidatePath(`/trails/${input.trailId}`);
  revalidatePath("/");
}

export async function deleteTrail(trailId: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  await db
    .delete(trail)
    .where(and(eq(trail.id, trailId), eq(trail.userId, user.id)));
  revalidatePath("/trails");
}

export async function syncIntervalsNow() {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  const { syncRecent } = await import("./intervals/sync");
  const result = await syncRecent(user.id, 30);
  revalidatePath("/");
  revalidatePath("/body");
  revalidatePath("/settings");
  return result;
}

/**
 * Validate + persist intervals.icu credentials for the current user.
 * The API key is encrypted before storage (AES-256-GCM) and NEVER
 * returned back through any read path. If validation fails we don't
 * persist — user sees the error and can retry.
 */
export async function saveIntervalsCredentials(input: {
  athleteId: string;
  apiKey: string;
}): Promise<{ ok: true; upserted: number } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const athleteId = input.athleteId.trim();
  const apiKey = input.apiKey.trim();
  // Sanity guard — reject obviously bogus input so we don't waste an
  // API round-trip. intervals.icu athlete IDs look like "i123456" or
  // digits-only, and API keys are ~32+ chars.
  if (!/^[a-zA-Z0-9]{3,32}$/.test(athleteId)) {
    return { ok: false, error: "Athlete ID looks malformed" };
  }
  if (apiKey.length < 16 || apiKey.length > 128) {
    return { ok: false, error: "API key looks malformed" };
  }

  try {
    const { validateCredentials } = await import("./intervals/client");
    await validateCredentials({ athleteId, apiKey });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Validation failed" };
  }

  const { saveCredentials } = await import("./intervals/credentials");
  await saveCredentials(user.id, athleteId, apiKey);

  // Kick off an initial 30d sync so the user sees data immediately.
  let upserted = 0;
  try {
    const { syncRecent } = await import("./intervals/sync");
    const r = await syncRecent(user.id, 30);
    upserted = r.upserted;
  } catch (e) {
    console.error("[saveIntervalsCredentials] initial sync failed:", e);
  }

  revalidatePath("/");
  revalidatePath("/settings/integrations");
  revalidatePath("/body");
  return { ok: true, upserted };
}

/**
 * Backfill historical activities from intervals.icu into the workout
 * table. Pulls last N days (default 365). Idempotent via workoutSource
 * unique (provider, providerActivityId) — safe to re-run.
 */
export async function backfillIntervalsActivities(daysBack = 365) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  const { syncActivitiesRecent } = await import("./intervals/activities");
  const result = await syncActivitiesRecent(user.id, daysBack);
  revalidatePath("/trails/backfill");
  revalidatePath("/history");
  revalidatePath("/");
  return result;
}

export async function disconnectIntervals(): Promise<{ ok: true }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  const { deleteCredentials } = await import("./intervals/credentials");
  await deleteCredentials(user.id);
  revalidatePath("/settings/integrations");
  revalidatePath("/settings");
  return { ok: true };
}

// App base URL for links in outbound emails. Prefers explicit env,
// falls back to Vercel URL, else the request's own origin.
async function resolveAppUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("host") ?? "localhost:3000";
    return `${proto}://${host}`;
  } catch {
    return "https://basecamp.example";
  }
}

// Fire squad notification for a completion. Awaited inline (~300-500ms
// on Resend send). Silent on failure so a Resend outage never breaks
// the log-completion flow.
async function notifyForCompletion(completionId: number, actorUserId: number) {
  try {
    const appUrl = await resolveAppUrl();
    await notifySquadOfCompletion({ actorUserId, completionId, appUrl });
  } catch (e) {
    console.warn(
      "notifySquadOfCompletion failed:",
      e instanceof Error ? e.message : e,
    );
  }
}

/**
 * Link an existing workout to a saved trail as a completion. Duration
 * and completedAt are derived from the workout's own data. Idempotent
 * on (workoutId, trailId) — safe to call twice.
 */
export async function linkWorkoutToSavedTrail(input: {
  workoutId: number;
  trailId: number;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");

  const [w] = await db
    .select()
    .from(workout)
    .where(and(eq(workout.id, input.workoutId), eq(workout.userId, user.id)))
    .limit(1);
  if (!w) throw new Error("Workout not found or not yours");

  const [t] = await db
    .select({ id: trail.id })
    .from(trail)
    .where(and(eq(trail.id, input.trailId), eq(trail.userId, user.id)))
    .limit(1);
  if (!t) throw new Error("Trail not found or not yours");

  const existing = await db
    .select({ id: trailCompletion.id })
    .from(trailCompletion)
    .where(
      and(
        eq(trailCompletion.userId, user.id),
        eq(trailCompletion.trailId, input.trailId),
        eq(trailCompletion.workoutId, input.workoutId),
      ),
    )
    .limit(1);
  if (existing[0]) {
    revalidatePath("/trails/link");
    return { id: existing[0].id, alreadyLinked: true };
  }

  // completedAt: YMD from workout's startTime in user's timezone.
  const tz = user.timezone;
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(w.startTime);

  const durationMin =
    w.durationSeconds != null && w.durationSeconds > 0
      ? Math.round(w.durationSeconds / 60)
      : null;

  const [row] = await db
    .insert(trailCompletion)
    .values({
      userId: user.id,
      trailId: input.trailId,
      completedAt: localDate,
      workoutId: input.workoutId,
      timeMinutes: durationMin,
    })
    .returning({ id: trailCompletion.id });

  revalidatePath("/trails/link");
  revalidatePath("/progress");
  revalidatePath(`/trails/${input.trailId}`);
  await notifyForCompletion(row.id, user.id);
  return { id: row.id, alreadyLinked: false };
}

/**
 * Link a workout to a preset trail — saves the preset first if the user
 * doesn't have it yet, then attaches the workout as a completion.
 */
export async function linkWorkoutToPreset(input: {
  workoutId: number;
  presetSlug: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");

  // Reuse or create the saved trail row for this preset.
  const [existingTrail] = await db
    .select({ id: trail.id })
    .from(trail)
    .where(
      and(
        eq(trail.userId, user.id),
        eq(trail.presetSlug, input.presetSlug),
      ),
    )
    .limit(1);

  let trailId: number;
  if (existingTrail) {
    trailId = existingTrail.id;
  } else {
    const saved = await createTrailFromPreset(input.presetSlug);
    trailId = saved.id;
  }

  return linkWorkoutToSavedTrail({ workoutId: input.workoutId, trailId });
}

export async function logTrailCompletion(input: {
  trailId: number;
  completedAt: string; // YMD
  timeMinutes?: number;
  notes?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");

  // Verify the trail belongs to the user (basic authorization).
  const [t] = await db
    .select({ id: trail.id })
    .from(trail)
    .where(and(eq(trail.id, input.trailId), eq(trail.userId, user.id)))
    .limit(1);
  if (!t) throw new Error("Trail not found or not yours");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.completedAt)) {
    throw new Error("completedAt must be YYYY-MM-DD");
  }

  const [row] = await db
    .insert(trailCompletion)
    .values({
      userId: user.id,
      trailId: input.trailId,
      completedAt: input.completedAt,
      timeMinutes:
        input.timeMinutes != null && input.timeMinutes > 0
          ? input.timeMinutes
          : null,
      notes: input.notes?.trim() || null,
    })
    .returning({ id: trailCompletion.id });

  revalidatePath(`/trails/${input.trailId}`);
  revalidatePath("/progress");
  revalidatePath("/trails");
  await notifyForCompletion(row.id, user.id);
}

export async function deleteTrailCompletion(completionId: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  await db
    .delete(trailCompletion)
    .where(
      and(
        eq(trailCompletion.id, completionId),
        eq(trailCompletion.userId, user.id),
      ),
    );
  revalidatePath("/progress");
  revalidatePath("/trails");
}

// ─────────────────────────── Squads ───────────────────────────

const SQUAD_MEMBER_CAP = 8;

function generateSquadInviteToken(): string {
  // Same format as magic-link tokens: base64url, plenty of entropy.
  return randomBytes(24).toString("base64url");
}

export async function createSquad(input: { name: string }) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  const name = input.name.trim();
  if (!name) throw new Error("Squad name is required");
  if (name.length > 60) throw new Error("Squad name too long");

  const [created] = await db
    .insert(squad)
    .values({
      name,
      inviteToken: generateSquadInviteToken(),
      createdBy: user.id,
    })
    .returning();

  await db.insert(squadMember).values({
    squadId: created.id,
    userId: user.id,
    role: "admin",
  });

  revalidatePath("/squad");
  revalidatePath("/progress");
  return { id: created.id };
}

export async function regenerateSquadInviteToken(squadId: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  const [membership] = await db
    .select({ role: squadMember.role })
    .from(squadMember)
    .where(
      and(eq(squadMember.squadId, squadId), eq(squadMember.userId, user.id)),
    )
    .limit(1);
  if (!membership || membership.role !== "admin") {
    throw new Error("Only squad admins can regenerate invite tokens");
  }
  const token = generateSquadInviteToken();
  await db.update(squad).set({ inviteToken: token }).where(eq(squad.id, squadId));
  revalidatePath(`/squad/${squadId}`);
  return { token };
}

export async function joinSquadByToken(token: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  const [target] = await db
    .select()
    .from(squad)
    .where(eq(squad.inviteToken, token))
    .limit(1);
  if (!target) throw new Error("Invite link is invalid or has been revoked");

  // Already a member? Return the id — the join page will redirect.
  const [existing] = await db
    .select({ id: squadMember.id })
    .from(squadMember)
    .where(
      and(eq(squadMember.squadId, target.id), eq(squadMember.userId, user.id)),
    )
    .limit(1);
  if (existing) {
    return { id: target.id, alreadyMember: true };
  }

  // Enforce member cap.
  const members = await db
    .select({ id: squadMember.id })
    .from(squadMember)
    .where(eq(squadMember.squadId, target.id));
  if (members.length >= SQUAD_MEMBER_CAP) {
    throw new Error(
      `This squad is at capacity (${SQUAD_MEMBER_CAP} members). Ask the admin to make room or start a new squad.`,
    );
  }

  await db.insert(squadMember).values({
    squadId: target.id,
    userId: user.id,
    role: "member",
  });

  revalidatePath("/squad");
  revalidatePath(`/squad/${target.id}`);
  return { id: target.id, alreadyMember: false };
}

export async function leaveSquad(squadId: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  await db
    .delete(squadMember)
    .where(
      and(eq(squadMember.squadId, squadId), eq(squadMember.userId, user.id)),
    );
  revalidatePath("/squad");
  revalidatePath(`/squad/${squadId}`);
}

export async function renameSquad(input: { squadId: number; name: string }) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  const [m] = await db
    .select({ role: squadMember.role })
    .from(squadMember)
    .where(
      and(
        eq(squadMember.squadId, input.squadId),
        eq(squadMember.userId, user.id),
      ),
    )
    .limit(1);
  if (!m || m.role !== "admin") throw new Error("Only admins can rename");
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  if (name.length > 60) throw new Error("Name too long");
  await db.update(squad).set({ name }).where(eq(squad.id, input.squadId));
  revalidatePath(`/squad/${input.squadId}`);
}

export async function setNotificationPreference(input: {
  kind: string;
  emailEnabled: boolean;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  const { notificationPreference } = await import("@/db/schema");
  const existing = await db
    .select({ id: notificationPreference.id })
    .from(notificationPreference)
    .where(
      and(
        eq(notificationPreference.userId, user.id),
        eq(notificationPreference.kind, input.kind),
      ),
    )
    .limit(1);
  if (existing[0]) {
    await db
      .update(notificationPreference)
      .set({ emailEnabled: input.emailEnabled })
      .where(eq(notificationPreference.id, existing[0].id));
  } else {
    await db
      .insert(notificationPreference)
      .values({
        userId: user.id,
        kind: input.kind,
        emailEnabled: input.emailEnabled,
      });
  }
  revalidatePath("/settings");
}

/**
 * Save all trails from a generated itinerary as user's trails, assigning
 * each the corresponding day's date as targetDate. Idempotent per preset:
 * if the user already has a saved trail for a given presetSlug, we UPDATE
 * its targetDate instead of creating a duplicate.
 */
/**
 * Generate an LLM narrative for a client-computed itinerary. Called on
 * demand from the itinerary planner. Cached in coach_narrative — same
 * shape + fitness fingerprint returns cached instantly.
 */
export async function generateItineraryAdvice(input: {
  destination: string;
  days: number;
  totals: { hikes: number; hours: number; verticalFt: number };
  itinerary: Array<
    | {
        kind: "hike";
        dayIndex: number;
        dateYmd: string;
        trailName: string;
        distanceKm: number;
        elevationGainFt: number;
        typicalHours: number;
        terrainGrade: string;
        verdict: "comfortable" | "achievable" | "hard" | "do_not_attempt";
      }
    | { kind: "rest"; dayIndex: number; dateYmd: string; reason: string }
    | { kind: "unfilled"; dayIndex: number; dateYmd: string }
  >;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  const { generateItineraryNarrative } = await import(
    "./coach/itinerary-narrative"
  );
  const narrative = await generateItineraryNarrative({
    user,
    destination: input.destination,
    days: input.days,
    totals: input.totals,
    itinerary: input.itinerary,
  });
  return { narrative };
}

export async function saveItineraryTrails(input: {
  entries: Array<{ presetSlug: string; targetDate: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  if (!input.entries.length) return { savedIds: [] };
  const { findTrailBySlug } = await import("./basecamp/trail-library");

  const savedIds: number[] = [];
  for (const entry of input.entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.targetDate)) {
      throw new Error(`Invalid date: ${entry.targetDate}`);
    }
    const preset = findTrailBySlug(entry.presetSlug);
    if (!preset) continue;

    const [existing] = await db
      .select({ id: trail.id })
      .from(trail)
      .where(
        and(
          eq(trail.userId, user.id),
          eq(trail.presetSlug, entry.presetSlug),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(trail)
        .set({ targetDate: entry.targetDate })
        .where(eq(trail.id, existing.id));
      savedIds.push(existing.id);
    } else {
      const [row] = await db
        .insert(trail)
        .values({
          userId: user.id,
          name: preset.name,
          url: null,
          distanceKm: preset.distanceKm,
          elevationGainFt: preset.elevationGainFt,
          maxAltitudeFt: preset.maxAltitudeFt,
          typicalHours: preset.typicalHours,
          packWeightLb: preset.packWeightLb,
          terrainGrade: preset.terrainGrade,
          targetDate: entry.targetDate,
          notes: `${preset.notes} · Sources: ${preset.sources.join(", ")}`,
          presetSlug: preset.slug,
        })
        .returning({ id: trail.id });
      savedIds.push(row.id);
    }
  }
  revalidatePath("/trails");
  revalidatePath("/");
  return { savedIds };
}

export async function saveOnboardingConstraints(input: {
  weeklyHours: 3 | 5 | 7 | 10;
  startingFitness: "new" | "occasional" | "regular" | "active";
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  const validHours = [3, 5, 7, 10] as const;
  const validFitness = ["new", "occasional", "regular", "active"] as const;
  if (!validHours.includes(input.weeklyHours)) {
    throw new Error("Invalid weekly hours");
  }
  if (!validFitness.includes(input.startingFitness)) {
    throw new Error("Invalid starting fitness");
  }

  await db
    .update(userProfile)
    .set({
      weeklyTrainingHours: input.weeklyHours,
      startingFitness: input.startingFitness,
      updatedAt: new Date(),
    })
    .where(eq(userProfile.id, user.id));

  // Generate the plan now if the user doesn't already have one. Idempotent
  // — if a plan exists (Mayank's Rainier plan), we skip.
  const { generateUserPlan } = await import("./plan/generator");
  const result = await generateUserPlan({
    userId: user.id,
    weeklyHours: input.weeklyHours,
    startingFitness: input.startingFitness,
  });

  revalidatePath("/train");
  revalidatePath("/");
  return { planId: result.planId, sessionsCreated: result.sessions };
}

export async function markOnboardingComplete() {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  if (user.onboardedAt) return; // idempotent
  await db
    .update(userProfile)
    .set({ onboardedAt: new Date(), updatedAt: new Date() })
    .where(eq(userProfile.id, user.id));
  revalidatePath("/");
  revalidatePath("/welcome");
}

/**
 * Terminal onboarding step — persists plan constraints, generates
 * the 12-week plan, and marks the user as onboarded in one round trip.
 * Called from the final wizard step so we don't split a single UI
 * action into two server calls.
 */
export async function finishOnboardingWithPlan(input: {
  weeklyHours: 3 | 5 | 7 | 10;
  startingFitness: "new" | "occasional" | "regular" | "active";
}) {
  const result = await saveOnboardingConstraints(input);
  await markOnboardingComplete();
  return result;
}

export async function disconnectStrava() {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  const rows = await db
    .select()
    .from(stravaAccount)
    .where(eq(stravaAccount.userId, user.id))
    .limit(1);
  const account = rows[0];
  if (account) {
    try {
      const { deauthorize } = await import("./strava/client");
      await deauthorize(account.accessToken);
    } catch (e) {
      console.warn("strava deauth failed (deleting local record anyway):", e);
    }
    await db.delete(stravaAccount).where(eq(stravaAccount.id, account.id));
  }
  revalidatePath("/settings");
}

/**
 * Archive the user's current plan (if any) and generate a fresh one
 * with the given goal type + constraints. This is the /plan/new
 * regenerate flow — deliberately destructive of the OLD plan (any
 * completions in the old plan stay logged, but planned_session rows
 * for the future are replaced).
 */
export async function regeneratePlan(input: {
  goalType: PlanGoalType;
  goalEvent?: string;
  weeklyHours: 3 | 5 | 7 | 10;
  startingFitness: "new" | "occasional" | "regular" | "active";
  weeks?: number;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  if (!PLAN_GOAL_TYPES.includes(input.goalType)) {
    throw new Error(`Unknown goal type: ${input.goalType}`);
  }

  // Archive current active plan (keeps history queryable, drops it
  // out of "active" so generateUserPlan doesn't short-circuit).
  await db
    .update(trainingPlan)
    .set({ status: "archived" })
    .where(
      and(
        eq(trainingPlan.userId, user.id),
        eq(trainingPlan.status, "active"),
      ),
    );

  // Persist the new constraints on the user profile too so future
  // fitness-suggest / refresh flows pick them up.
  await db
    .update(userProfile)
    .set({
      weeklyTrainingHours: input.weeklyHours,
      startingFitness: input.startingFitness,
      updatedAt: new Date(),
    })
    .where(eq(userProfile.id, user.id));

  const { generateUserPlan } = await import("./plan/generator");
  const result = await generateUserPlan({
    userId: user.id,
    goalType: input.goalType,
    goalEvent: input.goalEvent,
    weeklyHours: input.weeklyHours,
    startingFitness: input.startingFitness,
    weeks: input.weeks,
  });

  revalidatePath("/");
  revalidatePath("/train");
  revalidatePath("/plan/new");
  return { planId: result.planId, sessions: result.sessions };
}

/**
 * Upload-a-plan path: accept a validated JSON payload with a list of
 * sessions and persist as a new active plan (source='uploaded'). We
 * archive any existing active plan first. The LLM validation /
 * feedback layer comes later — this ships the ingest path.
 */
export type UploadedPlanInput = {
  name: string;
  goalType: PlanGoalType;
  goalEvent?: string;
  sessions: Array<{
    date: string; // YYYY-MM-DD
    category: SessionCategory;
    title: string;
    durationMinutes: number;
    rpeMin?: number | null;
    rpeMax?: number | null;
    instructions?: string;
    strengthPrescription?: Array<{ name: string; sets: number; reps: string }>;
  }>;
};

export async function uploadPlan(input: UploadedPlanInput) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  if (!PLAN_GOAL_TYPES.includes(input.goalType)) {
    throw new Error(`Unknown goal type: ${input.goalType}`);
  }
  if (!Array.isArray(input.sessions) || input.sessions.length === 0) {
    throw new Error("Plan must include at least one session");
  }
  if (input.sessions.length > 500) {
    throw new Error("Plan too large (max 500 sessions)");
  }

  // Row-level validation before anything gets written. Bail out on
  // first bad row so users see one clear error not a wall.
  for (const [i, s] of input.sessions.entries()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) {
      throw new Error(`Session ${i + 1}: invalid date "${s.date}"`);
    }
    if (!SESSION_CATEGORIES.includes(s.category)) {
      throw new Error(
        `Session ${i + 1}: unknown category "${s.category}". Allowed: ${SESSION_CATEGORIES.join(", ")}`,
      );
    }
    if (!Number.isFinite(s.durationMinutes) || s.durationMinutes <= 0) {
      throw new Error(`Session ${i + 1}: durationMinutes must be > 0`);
    }
    if (!s.title || s.title.length > 120) {
      throw new Error(`Session ${i + 1}: title required (≤120 chars)`);
    }
  }

  const sortedDates = input.sessions
    .map((s) => s.date)
    .sort((a, b) => a.localeCompare(b));
  const startDate = sortedDates[0];
  const endDate = sortedDates[sortedDates.length - 1];

  // Archive current active plan.
  await db
    .update(trainingPlan)
    .set({ status: "archived" })
    .where(
      and(
        eq(trainingPlan.userId, user.id),
        eq(trainingPlan.status, "active"),
      ),
    );

  const [plan] = await db
    .insert(trainingPlan)
    .values({
      userId: user.id,
      name: input.name,
      goalEvent: input.goalEvent ?? null,
      goalType: input.goalType,
      source: "uploaded",
      startDate,
      eventDate: endDate,
      currentPhase: 1,
      status: "active",
    })
    .returning();

  const inserts: (typeof plannedSession.$inferInsert)[] = input.sessions.map(
    (s) => ({
      planId: plan.id,
      date: s.date,
      sessionCategory: s.category,
      title: s.title,
      targetDurationMinutes: Math.round(s.durationMinutes),
      targetRpeMin: s.rpeMin ?? null,
      targetRpeMax: s.rpeMax ?? null,
      targetPackWeightLb: null,
      targetElevationGainFt: null,
      instructions: s.instructions ?? null,
      strengthPrescription: s.strengthPrescription
        ? JSON.stringify(s.strengthPrescription)
        : null,
      status: "planned",
    }),
  );
  await db.insert(plannedSession).values(inserts);

  revalidatePath("/");
  revalidatePath("/train");
  revalidatePath("/plan/new");
  revalidatePath("/plan/upload");
  return { planId: plan.id, sessions: inserts.length };
}

/**
 * Manually mark a planned session complete. Inserts a workout row
 * that represents the session — no strength sets, no HR data, just
 * the fact that it happened. Used when a user wants to log without
 * having imported the activity from Strava.
 *
 * Idempotent: if a workout is already linked to this session, updates
 * the actual duration + RPE + notes in place.
 */
export async function markSessionComplete(input: {
  plannedSessionId: number;
  actualDurationMinutes?: number;
  rpe?: number;
  notes?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");

  const [ps] = await db
    .select()
    .from(plannedSession)
    .innerJoin(trainingPlan, eq(trainingPlan.id, plannedSession.planId))
    .where(
      and(
        eq(plannedSession.id, input.plannedSessionId),
        eq(trainingPlan.userId, user.id),
      ),
    )
    .limit(1);
  if (!ps) throw new Error("Planned session not found");

  const [existing] = await db
    .select()
    .from(workout)
    .where(
      and(
        eq(workout.userId, user.id),
        eq(workout.plannedSessionId, input.plannedSessionId),
      ),
    )
    .limit(1);

  const durationSeconds =
    input.actualDurationMinutes != null && input.actualDurationMinutes > 0
      ? Math.round(input.actualDurationMinutes * 60)
      : (ps.planned_session.targetDurationMinutes ?? 30) * 60;
  const startTime = new Date(ps.planned_session.date + "T09:00:00Z");
  const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

  if (existing) {
    await db
      .update(workout)
      .set({
        durationSeconds,
        endTime,
        rpe: input.rpe ?? existing.rpe,
        notes: input.notes ?? existing.notes,
      })
      .where(eq(workout.id, existing.id));
  } else {
    await db.insert(workout).values({
      userId: user.id,
      plannedSessionId: input.plannedSessionId,
      startTime,
      endTime,
      type: ps.planned_session.sessionCategory,
      durationSeconds,
      rpe: input.rpe ?? null,
      notes: input.notes ?? null,
      canonicalSource: "manual",
    });
  }

  revalidatePath("/");
  revalidatePath("/train");
  revalidatePath(`/plan/${ps.planned_session.planId}`);
  revalidatePath(`/plan/${ps.planned_session.planId}/session/${input.plannedSessionId}`);
  revalidatePath("/history");
  return { ok: true };
}

/**
 * Undo a manual completion. Only deletes workouts we created via the
 * manual mark-complete path (canonicalSource='manual'); leaves Strava
 * / intervals imports alone even if they're linked.
 */
export async function unmarkSessionComplete(plannedSessionId: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  await db
    .delete(workout)
    .where(
      and(
        eq(workout.userId, user.id),
        eq(workout.plannedSessionId, plannedSessionId),
        eq(workout.canonicalSource, "manual"),
      ),
    );
  revalidatePath("/");
  revalidatePath("/train");
  revalidatePath("/history");
  return { ok: true };
}

/**
 * Attach an existing imported workout to a planned session. Used by
 * the Home 'was this it?' suggest-link card when auto-linking missed.
 */
export async function linkWorkoutToPlannedSession(input: {
  workoutId: number;
  plannedSessionId: number;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  const [w] = await db
    .select({ id: workout.id, userId: workout.userId })
    .from(workout)
    .where(and(eq(workout.id, input.workoutId), eq(workout.userId, user.id)))
    .limit(1);
  if (!w) throw new Error("Workout not found or not yours");
  await db
    .update(workout)
    .set({ plannedSessionId: input.plannedSessionId })
    .where(eq(workout.id, input.workoutId));
  revalidatePath("/");
  revalidatePath("/train");
  return { ok: true };
}

/**
 * Save (or update) the user's LLM provider credentials for the coach
 * chat. Validated against a lightweight sanity pattern before storage
 * — real auth happens the first time the chat actually calls the
 * provider. AES-256-GCM encrypted at rest via APP_ENCRYPTION_KEY.
 */
export async function saveLlmCredentials(input: {
  provider: "anthropic" | "openai";
  apiKey: string;
  modelId?: string | null;
}) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Not signed in" };
  const apiKey = input.apiKey.trim();
  const modelId = input.modelId?.trim() || null;
  if (apiKey.length < 20 || apiKey.length > 200) {
    return { ok: false as const, error: "API key looks malformed" };
  }
  const { getAdapter } = await import("./llm/providers");
  const adapter = getAdapter(input.provider);
  if (!adapter.keyPattern.test(apiKey)) {
    return {
      ok: false as const,
      error: `Doesn't look like an ${adapter.displayName} key (expected pattern ${adapter.keyPattern.source})`,
    };
  }
  const { saveCredentials } = await import("./llm/credentials");
  await saveCredentials(user.id, input.provider, apiKey, modelId);
  revalidatePath("/coach");
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function disconnectLlm() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const { deleteCredentials } = await import("./llm/credentials");
  await deleteCredentials(user.id);
  revalidatePath("/coach");
  revalidatePath("/settings");
  return { ok: true as const };
}

/**
 * Toggle unit display preference. Storage stays SI; this only
 * affects rendering.
 */
export async function setUnitsPreference(units: "imperial" | "metric") {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  if (units !== "imperial" && units !== "metric") {
    throw new Error("Invalid units");
  }
  await db
    .update(userProfile)
    .set({ units, updatedAt: new Date() })
    .where(eq(userProfile.id, user.id));
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Trigger a plan-wide relink pass. Called from Settings 'Sync now' and
 * from any plan-mutating action so newly-widened categories or new
 * planned sessions pick up orphan workouts.
 */
export async function relinkCurrentPlan() {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found");
  const { relinkOrphanWorkouts } = await import("./plan/relink");
  const result = await relinkOrphanWorkouts(user.id);
  revalidatePath("/");
  revalidatePath("/train");
  revalidatePath("/history");
  if (result.planId > 0) revalidatePath(`/plan/${result.planId}`);
  return result;
}
