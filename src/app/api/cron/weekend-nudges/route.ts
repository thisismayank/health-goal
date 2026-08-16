/**
 * Weekly cron: Thursday morning email suggesting 3 trails ready for the
 * user's fitness. Recurring hook independent of scheduled trips — for
 * casual users who haven't planned anything, this triggers a "let me
 * see what's suggested" open.
 *
 * Schedule (vercel.json): 0 15 * * 4 (Thursday 15:00 UTC = 10am ET).
 * Dedupe key: nudge_{yyyy-Www} so at most one per user per ISO week.
 */

import { NextResponse } from "next/server";
import { isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { userProfile, type UserProfile } from "@/db/schema";
import {
  buildWeekendNudge,
  renderWeekendNudgeEmail,
} from "@/lib/notifications/weekend-nudge";
import {
  isEmailEnabled,
  sendNotificationEmail,
} from "@/lib/notifications/send";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KIND = "weekend_nudge";

function isoWeekTag(now: Date): string {
  // Rough ISO-week fingerprint: yyyy + week-of-year based on Thursday
  // heuristic. Sufficient for a one-per-week dedupe key.
  const target = new Date(now.valueOf());
  const dayNr = (target.getUTCDay() + 6) % 7; // Mon = 0
  target.setUTCDate(target.getUTCDate() - dayNr + 3); // move to Thu of the week
  const firstThu = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const weekNo =
    1 +
    Math.round(
      ((target.getTime() - firstThu.getTime()) / 86_400_000 -
        3 +
        ((firstThu.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

type ProcessResult = {
  userId: number;
  email: string;
  result:
    | "sent"
    | "deduped"
    | "opted_out"
    | "no_email"
    | "no_picks"
    | "send_failed";
  detail?: string;
};

async function processUser(
  user: UserProfile,
  appUrl: string,
  weekTag: string,
): Promise<ProcessResult> {
  if (!user.email) {
    return { userId: user.id, email: "", result: "no_email" };
  }
  const enabled = await isEmailEnabled(user.id, KIND);
  if (!enabled) {
    return { userId: user.id, email: user.email, result: "opted_out" };
  }

  const payload = await buildWeekendNudge(user);
  if (!payload || (payload.ready.length === 0 && payload.achievable.length === 0)) {
    return { userId: user.id, email: user.email, result: "no_picks" };
  }

  const rendered = renderWeekendNudgeEmail({ payload, appUrl });
  const dedupeKey = `nudge_${weekTag}`;
  const send = await sendNotificationEmail({
    userId: user.id,
    to: user.email,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
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

  const weekTag = isoWeekTag(new Date());
  const results: ProcessResult[] = [];
  for (const u of users) {
    try {
      results.push(await processUser(u, appUrl, weekTag));
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
    weekTag,
    checkedUsers: users.length,
    summary,
    results,
  });
}

export const POST = GET;
