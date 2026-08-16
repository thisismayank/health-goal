/**
 * Daily cron: finds every user with an active trip trail and, if today
 * hits a notification day (T-7 / T-3 / T-1 / T-0 / T+1) in their local
 * timezone, sends the phase-specific email via Resend.
 *
 * Wired via vercel.json crons — Vercel invokes this endpoint on schedule.
 * Auth: Vercel adds `Authorization: Bearer $CRON_SECRET` header; endpoint
 * rejects requests without it.
 *
 * Idempotent: dedupe on (userId, dedupeKey) via notification_delivery
 * unique index. Safe to hit multiple times per day.
 */

import { addDays } from "date-fns";
import { and, asc, desc, eq, gte, isNotNull, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { trail, userProfile, type Trail, type UserProfile } from "@/db/schema";
import { parseYmd, todayInTimeZone, ymd } from "@/lib/date";
import { buildTripEmail } from "@/lib/notifications/trip-emails";
import { isEmailEnabled, sendNotificationEmail } from "@/lib/notifications/send";
import type { TripPhase } from "@/lib/home/state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KIND = "trip_week";

// Days-until-trip that trigger a notification.
// -1 corresponds to "yesterday" (post-trip reminder).
const NOTIFICATION_DAYS = [7, 3, 1, 0, -1] as const;

type NotificationDay = (typeof NOTIFICATION_DAYS)[number];

function tagFor(day: NotificationDay): string {
  return day === 0
    ? "t0"
    : day > 0
      ? `t-${day}`
      : `t+${Math.abs(day)}`;
}

function phaseFor(day: NotificationDay): TripPhase {
  if (day === 7) return "final_prep";
  if (day === 3 || day === 1) return "taper";
  if (day === 0) return "trip_day";
  return "post_trip"; // -1
}

async function findTripTrail(
  userId: number,
  todayYmd: string,
): Promise<Trail | null> {
  const from = ymd(addDays(parseYmd(todayYmd), -3));
  const to = ymd(addDays(parseYmd(todayYmd), 7));
  const [upcoming] = await db
    .select()
    .from(trail)
    .where(
      and(
        eq(trail.userId, userId),
        isNotNull(trail.targetDate),
        gte(trail.targetDate, todayYmd),
        lte(trail.targetDate, to),
      ),
    )
    .orderBy(asc(trail.targetDate))
    .limit(1);
  if (upcoming) return upcoming;
  const [past] = await db
    .select()
    .from(trail)
    .where(
      and(
        eq(trail.userId, userId),
        isNotNull(trail.targetDate),
        gte(trail.targetDate, from),
        lte(trail.targetDate, todayYmd),
      ),
    )
    .orderBy(desc(trail.targetDate))
    .limit(1);
  return past ?? null;
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = parseYmd(fromYmd).getTime();
  const b = parseYmd(toYmd).getTime();
  return Math.round((b - a) / 86_400_000);
}

type ProcessResult = {
  userId: number;
  email: string;
  result:
    | "sent"
    | "deduped"
    | "opted_out"
    | "not_today"
    | "no_trip"
    | "no_email"
    | "send_failed";
  detail?: string;
};

async function processUser(user: UserProfile, appUrl: string): Promise<ProcessResult> {
  if (!user.email) {
    return { userId: user.id, email: "", result: "no_email" };
  }
  const today = todayInTimeZone(user.timezone);
  const trip = await findTripTrail(user.id, today);
  if (!trip || !trip.targetDate) {
    return { userId: user.id, email: user.email, result: "no_trip" };
  }
  const days = daysBetween(today, trip.targetDate) as NotificationDay;
  if (!NOTIFICATION_DAYS.includes(days as NotificationDay)) {
    return { userId: user.id, email: user.email, result: "not_today" };
  }
  const enabled = await isEmailEnabled(user.id, KIND);
  if (!enabled) {
    return { userId: user.id, email: user.email, result: "opted_out" };
  }
  const phase = phaseFor(days);
  const dedupeKey = `trip_${trip.id}_${trip.targetDate}_${tagFor(days)}`;
  const email = buildTripEmail({
    user,
    trail: trip,
    phase,
    daysUntil: Math.max(0, days),
    appUrl,
  });
  const send = await sendNotificationEmail({
    userId: user.id,
    to: user.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
    kind: KIND,
    dedupeKey,
  });
  if (send.ok && send.skipped === "deduped") {
    return { userId: user.id, email: user.email, result: "deduped" };
  }
  if (!send.ok) {
    return {
      userId: user.id,
      email: user.email,
      result: "send_failed",
      detail: send.error,
    };
  }
  return {
    userId: user.id,
    email: user.email,
    result: "sent",
    detail: dedupeKey,
  };
}

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  return header.slice(7) === expected;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return new NextResponse("unauthorized", { status: 401 });
  }
  const appUrl =
    process.env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin;
  const users = await db
    .select()
    .from(userProfile)
    .where(isNotNull(userProfile.email));

  const results: ProcessResult[] = [];
  for (const u of users) {
    try {
      results.push(await processUser(u, appUrl));
    } catch (e) {
      results.push({
        userId: u.id,
        email: u.email ?? "",
        result: "send_failed",
        detail: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  const summary = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.result] = (acc[r.result] ?? 0) + 1;
    return acc;
  }, {});
  return NextResponse.json({
    ok: true,
    checkedUsers: users.length,
    summary,
    results,
  });
}

// Convenience: POST maps to GET so you can trigger manually via
//   curl -X POST -H 'Authorization: Bearer ...' /api/cron/trip-notifications
export const POST = GET;
