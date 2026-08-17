/**
 * Oura sync — pulls daily readiness + daily sleep (last N days) and
 * upserts into dailyMetric using field-level merge so we don't stomp
 * other sources (Strava, intervals, manual entry).
 *
 * Endpoints used (all free tier, member-scoped):
 *   /v2/usercollection/daily_readiness?start_date&end_date
 *   /v2/usercollection/daily_sleep?start_date&end_date
 *
 * We deliberately skip:
 *   - workout endpoint (Strava already covers this and Oura's data is thinner)
 *   - heartrate series (too much volume for MVP)
 */

import { addDays } from "date-fns";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { dailyMetric, ouraAccount } from "@/db/schema";
import { ymd } from "@/lib/date";
import { apiGet } from "./client";
import { getValidTokens } from "./tokens";

export type OuraSyncResult = {
  fetched: number;
  upserted: number;
};

type DailyReadinessRow = {
  id: string;
  day: string; // YYYY-MM-DD
  score: number | null;
  contributors?: {
    resting_hr?: number | null;
    hrv_balance?: number | null;
  };
};

type DailySleepRow = {
  id: string;
  day: string;
  score: number | null;
  contributors?: {
    total_sleep?: number | null; // score 0-100, NOT minutes
  };
};

type OuraCollectionResponse<T> = {
  data: T[];
  next_token: string | null;
};

async function fetchDailyReadiness(
  accessToken: string,
  startYmd: string,
  endYmd: string,
): Promise<DailyReadinessRow[]> {
  const path = `/usercollection/daily_readiness?start_date=${startYmd}&end_date=${endYmd}`;
  const res = await apiGet<OuraCollectionResponse<DailyReadinessRow>>(
    accessToken,
    path,
  );
  return res.data ?? [];
}

async function fetchDailySleep(
  accessToken: string,
  startYmd: string,
  endYmd: string,
): Promise<DailySleepRow[]> {
  const path = `/usercollection/daily_sleep?start_date=${startYmd}&end_date=${endYmd}`;
  const res = await apiGet<OuraCollectionResponse<DailySleepRow>>(
    accessToken,
    path,
  );
  return res.data ?? [];
}

export async function syncRecent(
  userId: number,
  daysBack = 30,
): Promise<OuraSyncResult> {
  const tokens = await getValidTokens(userId);
  if (!tokens) throw new Error("No Oura account for user");

  const today = new Date();
  const start = addDays(today, -daysBack);
  const startYmd = ymd(start);
  const endYmd = ymd(today);

  const [readiness, sleep] = await Promise.all([
    fetchDailyReadiness(tokens.accessToken, startYmd, endYmd),
    fetchDailySleep(tokens.accessToken, startYmd, endYmd),
  ]);

  // Merge by day so we upsert once per date.
  type Merged = {
    date: string;
    readiness?: number | null;
    sleepScore?: number | null;
    restingHrBpm?: number | null;
    hrvMs?: number | null;
  };
  const byDay = new Map<string, Merged>();
  for (const r of readiness) {
    const cur = byDay.get(r.day) ?? { date: r.day };
    cur.readiness = r.score ?? cur.readiness;
    cur.restingHrBpm = r.contributors?.resting_hr ?? cur.restingHrBpm;
    // Oura's hrv_balance contributor is a 0-100 score, not an absolute
    // HRV ms value. Skip it — a score isn't comparable to Garmin's ms.
    byDay.set(r.day, cur);
  }
  for (const s of sleep) {
    const cur = byDay.get(s.day) ?? { date: s.day };
    cur.sleepScore = s.score ?? cur.sleepScore;
    byDay.set(s.day, cur);
  }

  let upserted = 0;
  for (const m of byDay.values()) {
    // Only overwrite fields where Oura has a non-null value — preserves
    // other sources' data (Strava, HAE, manual).
    const patch: Record<string, unknown> = { lastAutoSyncAt: new Date() };
    if (m.readiness != null) patch.readiness = m.readiness;
    if (m.sleepScore != null) patch.sleepScore = m.sleepScore;
    if (m.restingHrBpm != null) patch.restingHrBpm = m.restingHrBpm;

    await db
      .insert(dailyMetric)
      .values({
        userId,
        date: m.date,
        readiness: m.readiness ?? null,
        sleepScore: m.sleepScore ?? null,
        restingHrBpm: m.restingHrBpm ?? null,
        lastAutoSyncAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [dailyMetric.userId, dailyMetric.date],
        set: patch,
      });
    upserted += 1;
  }

  await db
    .update(ouraAccount)
    .set({ lastSyncAt: new Date() })
    .where(eq(ouraAccount.userId, userId));

  return { fetched: readiness.length + sleep.length, upserted };
}
