import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  squad,
  squadMember,
  trail,
  trailCompletion,
  userProfile,
  type Squad,
} from "@/db/schema";

export type SquadWithMemberCount = Squad & {
  memberCount: number;
  role: string;
};

export async function getSquadsForUser(
  userId: number,
): Promise<SquadWithMemberCount[]> {
  const memberships = await db
    .select({
      squadId: squadMember.squadId,
      role: squadMember.role,
    })
    .from(squadMember)
    .where(eq(squadMember.userId, userId));
  if (memberships.length === 0) return [];

  const squadIds = memberships.map((m) => m.squadId);
  const squads = await db
    .select()
    .from(squad)
    .where(inArray(squad.id, squadIds));

  // Count members per squad.
  const allMembers = await db
    .select({ squadId: squadMember.squadId })
    .from(squadMember)
    .where(inArray(squadMember.squadId, squadIds));
  const countBySquad = new Map<number, number>();
  for (const m of allMembers) {
    countBySquad.set(m.squadId, (countBySquad.get(m.squadId) ?? 0) + 1);
  }

  const roleBySquad = new Map(memberships.map((m) => [m.squadId, m.role]));

  return squads
    .map((s) => ({
      ...s,
      memberCount: countBySquad.get(s.id) ?? 0,
      role: roleBySquad.get(s.id) ?? "member",
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export type SquadMemberInfo = {
  userId: number;
  name: string;
  email: string | null;
  role: string;
  joinedAt: Date;
  isYou: boolean;
};

export async function getSquadMembers(
  squadId: number,
  viewerUserId: number,
): Promise<SquadMemberInfo[]> {
  const rows = await db
    .select({
      userId: squadMember.userId,
      role: squadMember.role,
      joinedAt: squadMember.joinedAt,
      name: userProfile.name,
      email: userProfile.email,
    })
    .from(squadMember)
    .innerJoin(userProfile, eq(userProfile.id, squadMember.userId))
    .where(eq(squadMember.squadId, squadId))
    .orderBy(squadMember.joinedAt);

  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    role: r.role,
    joinedAt: r.joinedAt,
    isYou: r.userId === viewerUserId,
  }));
}

export type SquadActivityItem = {
  completionId: number;
  userId: number;
  userName: string;
  isYou: boolean;
  completedAt: string;
  timeMinutes: number | null;
  trailId: number;
  trailName: string;
};

/**
 * Recent trail completions across all members of the squad. Deterministic
 * sort: most recent first.
 */
export async function getSquadActivityFeed(
  squadId: number,
  viewerUserId: number,
  limit = 20,
): Promise<SquadActivityItem[]> {
  const members = await db
    .select({ userId: squadMember.userId })
    .from(squadMember)
    .where(eq(squadMember.squadId, squadId));
  if (members.length === 0) return [];
  const memberIds = members.map((m) => m.userId);

  const rows = await db
    .select({
      completionId: trailCompletion.id,
      userId: trailCompletion.userId,
      userName: userProfile.name,
      completedAt: trailCompletion.completedAt,
      timeMinutes: trailCompletion.timeMinutes,
      trailId: trail.id,
      trailName: trail.name,
    })
    .from(trailCompletion)
    .innerJoin(trail, eq(trail.id, trailCompletion.trailId))
    .innerJoin(userProfile, eq(userProfile.id, trailCompletion.userId))
    .where(inArray(trailCompletion.userId, memberIds))
    .orderBy(desc(trailCompletion.completedAt), desc(trailCompletion.id))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    isYou: r.userId === viewerUserId,
  }));
}

/**
 * For a given preset trail slug, find all squad members' completions of
 * that same trail (matched via trail.presetSlug). Used for the
 * "Your squad" section on preset detail pages.
 */
export async function getSquadCompletionsForPreset(
  viewerUserId: number,
  presetSlug: string,
): Promise<
  Array<{
    userId: number;
    userName: string;
    isYou: boolean;
    completedAt: string;
    timeMinutes: number | null;
  }>
> {
  // Union of all squad-mates across all this user's squads.
  const myMemberships = await db
    .select({ squadId: squadMember.squadId })
    .from(squadMember)
    .where(eq(squadMember.userId, viewerUserId));
  if (myMemberships.length === 0) return [];
  const squadIds = myMemberships.map((m) => m.squadId);

  const squadmates = await db
    .select({ userId: squadMember.userId })
    .from(squadMember)
    .where(inArray(squadMember.squadId, squadIds));
  const memberIds = Array.from(new Set(squadmates.map((m) => m.userId)));
  if (memberIds.length === 0) return [];

  const rows = await db
    .select({
      userId: trailCompletion.userId,
      userName: userProfile.name,
      completedAt: trailCompletion.completedAt,
      timeMinutes: trailCompletion.timeMinutes,
    })
    .from(trailCompletion)
    .innerJoin(trail, eq(trail.id, trailCompletion.trailId))
    .innerJoin(userProfile, eq(userProfile.id, trailCompletion.userId))
    .where(
      and(
        inArray(trailCompletion.userId, memberIds),
        eq(trail.presetSlug, presetSlug),
      ),
    )
    .orderBy(desc(trailCompletion.completedAt));

  return rows.map((r) => ({ ...r, isYou: r.userId === viewerUserId }));
}

export async function isMemberOf(
  squadId: number,
  userId: number,
): Promise<{ member: boolean; role: string | null }> {
  const [row] = await db
    .select({ role: squadMember.role })
    .from(squadMember)
    .where(
      and(eq(squadMember.squadId, squadId), eq(squadMember.userId, userId)),
    )
    .limit(1);
  return { member: !!row, role: row?.role ?? null };
}
