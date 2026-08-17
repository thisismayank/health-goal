import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { coachMessage } from "@/db/schema";
import { requireCurrentUser } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireCurrentUser();
  const messages = await db
    .select({
      id: coachMessage.id,
      role: coachMessage.role,
      content: coachMessage.content,
      createdAt: coachMessage.createdAt,
    })
    .from(coachMessage)
    .where(eq(coachMessage.userId, user.id))
    .orderBy(asc(coachMessage.createdAt));
  return NextResponse.json({ ok: true, messages });
}

export async function DELETE() {
  const user = await requireCurrentUser();
  await db.delete(coachMessage).where(eq(coachMessage.userId, user.id));
  return NextResponse.json({ ok: true });
}
