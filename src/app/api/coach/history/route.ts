import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { coachMessage, coachSummary } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/data";
import { maybeGenerateTeeUp } from "@/lib/coach/tee-up";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // tee-up gen may take ~5-10s

export async function GET() {
  const user = await requireOnboardedUser();

  // Consider producing a proactive opener before we return history.
  // maybeGenerateTeeUp is a no-op when the last turn is fresh, so
  // this is cheap in the common case (mid-conversation reload).
  await maybeGenerateTeeUp(user);

  const messages = await db
    .select({
      id: coachMessage.id,
      role: coachMessage.role,
      content: coachMessage.content,
      createdAt: coachMessage.createdAt,
      origin: coachMessage.origin,
    })
    .from(coachMessage)
    .where(eq(coachMessage.userId, user.id))
    .orderBy(asc(coachMessage.createdAt));
  return NextResponse.json({ ok: true, messages });
}

export async function DELETE() {
  const user = await requireOnboardedUser();
  // Wipe messages AND the rolling summary — "clear history" should
  // mean the coach genuinely doesn't remember, not "clear the log
  // but keep secretly summarizing from it."
  await db.delete(coachMessage).where(eq(coachMessage.userId, user.id));
  await db.delete(coachSummary).where(eq(coachSummary.userId, user.id));
  return NextResponse.json({ ok: true });
}
