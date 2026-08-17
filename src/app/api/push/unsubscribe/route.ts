import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { pushSubscription } from "@/db/schema";
import { requireCurrentUser } from "@/lib/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireCurrentUser();
  let body: { endpoint?: string };
  try {
    body = (await req.json()) as { endpoint?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  if (!body.endpoint) {
    return NextResponse.json(
      { ok: false, error: "missing_endpoint" },
      { status: 400 },
    );
  }
  await db
    .delete(pushSubscription)
    .where(
      and(
        eq(pushSubscription.userId, user.id),
        eq(pushSubscription.endpoint, body.endpoint),
      ),
    );
  return NextResponse.json({ ok: true });
}
