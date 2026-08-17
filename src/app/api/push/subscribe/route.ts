import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { pushSubscription } from "@/db/schema";
import { requireCurrentUser } from "@/lib/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SubscriptionPayload = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(req: Request) {
  const user = await requireCurrentUser();
  let sub: SubscriptionPayload;
  try {
    sub = (await req.json()) as SubscriptionPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json(
      { ok: false, error: "missing_fields" },
      { status: 400 },
    );
  }

  const userAgent = req.headers.get("user-agent") ?? null;

  // Upsert by endpoint. If someone else's userId is on it, take it over
  // (fine — the user is authenticated, they own this browser now).
  const existing = await db
    .select({ id: pushSubscription.id })
    .from(pushSubscription)
    .where(eq(pushSubscription.endpoint, sub.endpoint))
    .limit(1);
  if (existing[0]) {
    await db
      .update(pushSubscription)
      .set({
        userId: user.id,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent,
        lastUsedAt: new Date(),
      })
      .where(eq(pushSubscription.id, existing[0].id));
  } else {
    await db.insert(pushSubscription).values({
      userId: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent,
    });
  }
  return NextResponse.json({ ok: true });
}
