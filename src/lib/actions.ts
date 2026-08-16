"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import {
  dailyMetric,
  plannedSession,
  squad,
  squadMember,
  stravaAccount,
  strengthExercise,
  trail,
  trailCompletion,
  userProfile,
  workout,
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
  revalidatePath("/");
  revalidatePath("/week");
  revalidatePath("/history");
  revalidatePath("/settings");
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

  await db.insert(trailCompletion).values({
    userId: user.id,
    trailId: input.trailId,
    completedAt: input.completedAt,
    timeMinutes:
      input.timeMinutes != null && input.timeMinutes > 0
        ? input.timeMinutes
        : null,
    notes: input.notes?.trim() || null,
  });

  revalidatePath(`/trails/${input.trailId}`);
  revalidatePath("/progress");
  revalidatePath("/trails");
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
