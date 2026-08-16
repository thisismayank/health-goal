/**
 * Hiker Class change detection. Compares the user's currently-computed
 * class against last_known_class on their profile and returns a delta
 * when they've crossed a threshold. Updates last_known_class in the
 * same call so subsequent renders don't repeat the celebration.
 *
 * First-time users (last_known_class NULL) are seeded silently — no
 * celebration on signup.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userProfile } from "@/db/schema";
import { RANKS, RANK_LABELS, RANK_UNLOCKS, type Rank } from "./rank";

export type ClassChange = {
  direction: "up" | "down";
  from: Rank;
  fromLabel: string;
  to: Rank;
  toLabel: string;
  newUnlocks: string[]; // unlocks at the new class
};

function isRank(v: string | null): v is Rank {
  return v !== null && (RANKS as readonly string[]).includes(v);
}

export async function detectClassChangeAndUpdate(
  userId: number,
  currentClass: Rank,
): Promise<ClassChange | null> {
  const [row] = await db
    .select({ lastKnownClass: userProfile.lastKnownClass })
    .from(userProfile)
    .where(eq(userProfile.id, userId))
    .limit(1);
  if (!row) return null;

  const last = row.lastKnownClass;

  // First time we've seen this user in the class-tracker era. Persist
  // silently so the *next* real change celebrates, and initial signup
  // doesn't pop a modal.
  if (!isRank(last)) {
    await db
      .update(userProfile)
      .set({ lastKnownClass: currentClass })
      .where(eq(userProfile.id, userId));
    return null;
  }

  if (last === currentClass) return null;

  // Persist BEFORE returning so a page reload doesn't refire the
  // celebration (idempotent on second render).
  await db
    .update(userProfile)
    .set({ lastKnownClass: currentClass })
    .where(eq(userProfile.id, userId));

  const upgraded = RANKS.indexOf(currentClass) > RANKS.indexOf(last);
  return {
    direction: upgraded ? "up" : "down",
    from: last,
    fromLabel: RANK_LABELS[last],
    to: currentClass,
    toLabel: RANK_LABELS[currentClass],
    newUnlocks: RANK_UNLOCKS[currentClass],
  };
}
