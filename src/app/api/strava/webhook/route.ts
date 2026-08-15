import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stravaAccount } from "@/db/schema";
import { deleteActivity, syncActivity } from "@/lib/strava/sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected && challenge) {
    return NextResponse.json({ "hub.challenge": challenge });
  }
  return new NextResponse("forbidden", { status: 403 });
}

type WebhookEvent = {
  aspect_type: "create" | "update" | "delete";
  object_type: "activity" | "athlete";
  object_id: number;
  owner_id: number;
  event_time: number;
  subscription_id: number;
  updates?: Record<string, string>;
};

export async function POST(request: Request) {
  let event: WebhookEvent;
  try {
    event = (await request.json()) as WebhookEvent;
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Only handle activity events. Athlete deauth events are logged and ignored for MVP.
  if (event.object_type !== "activity") {
    return NextResponse.json({ ok: true });
  }

  const rows = await db
    .select()
    .from(stravaAccount)
    .where(eq(stravaAccount.athleteId, String(event.owner_id)))
    .limit(1);
  const account = rows[0];
  if (!account) {
    // Unknown athlete — most likely we already disconnected.
    return NextResponse.json({ ok: true });
  }

  try {
    if (event.aspect_type === "create" || event.aspect_type === "update") {
      await syncActivity(account.userId, event.object_id);
    } else if (event.aspect_type === "delete") {
      await deleteActivity(account.userId, event.object_id);
    }
  } catch (e) {
    console.error("strava webhook sync failed:", e);
    // Still return 200 so Strava doesn't retry aggressively; we'll rely on
    // the manual "Sync now" button for recovery.
  }

  return NextResponse.json({ ok: true });
}
