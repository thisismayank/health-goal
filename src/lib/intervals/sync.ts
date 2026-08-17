import { addDays, formatISO } from "date-fns";
import { db } from "@/db/client";
import { dailyMetric } from "@/db/schema";
import { ymd } from "@/lib/date";
import { getWellnessRange, type IntervalsWellness } from "./client";
import { getCredsForSync, markSynced } from "./credentials";

export type IntervalsSyncResult = {
  fetched: number;
  upserted: number;
  skippedEmpty: number;
  oldest: string;
  newest: string;
};

function nonZero(v: number | null | undefined): boolean {
  return v != null && !Number.isNaN(v);
}

function readNumber(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

// Only upsert if the row has at least one signal we care about.
function hasSignal(w: IntervalsWellness): boolean {
  return (
    nonZero(w.weight) ||
    nonZero(w.restingHR) ||
    nonZero(w.hrv) ||
    nonZero(w.hrvSDNN) ||
    nonZero(w.sleepSecs) ||
    nonZero(w.steps) ||
    nonZero(w.sleepScore as number | null | undefined) ||
    nonZero(readNumber((w as Record<string, unknown>).vo2max)) ||
    nonZero(readNumber((w as Record<string, unknown>).spO2)) ||
    nonZero(readNumber((w as Record<string, unknown>).ctl)) ||
    nonZero(readNumber((w as Record<string, unknown>).atl))
  );
}

function normalize(w: IntervalsWellness) {
  const raw = w as Record<string, unknown>;
  const hrvMs = nonZero(w.hrvSDNN) ? w.hrvSDNN : nonZero(w.hrv) ? w.hrv : null;
  const round = (v: number | null, decimals = 1) =>
    v != null ? +v.toFixed(decimals) : null;

  return {
    date: w.id,
    bodyWeightKg: nonZero(w.weight) ? +(w.weight as number).toFixed(2) : null,
    restingHrBpm: nonZero(w.restingHR)
      ? Math.round(w.restingHR as number)
      : null,
    hrvMs: hrvMs != null ? +(hrvMs as number).toFixed(1) : null,
    sleepMinutes: nonZero(w.sleepSecs)
      ? Math.round((w.sleepSecs as number) / 60)
      : null,
    steps: nonZero(w.steps) ? Math.round(w.steps as number) : null,
    sleepScore: nonZero(w.sleepScore as number | null | undefined)
      ? Math.round(w.sleepScore as number)
      : null,
    sleepQuality: nonZero(w.sleepQuality as number | null | undefined)
      ? Math.round(w.sleepQuality as number)
      : null,
    vo2Max: round(readNumber(raw.vo2max), 1),
    spo2Pct: round(readNumber(raw.spO2), 1),
    bodyFatPct: round(readNumber(raw.bodyFat), 1),
    respirationRpm: round(readNumber(raw.respiration), 1),
    avgSleepingHrBpm: (() => {
      const v = readNumber(raw.avgSleepingHR);
      return v != null ? Math.round(v) : null;
    })(),
    readiness: nonZero(w.readiness as number | null | undefined)
      ? Math.round(w.readiness as number)
      : null,
    stressScore: (() => {
      const v = readNumber(raw.stress);
      return v != null ? Math.round(v) : null;
    })(),
    ctl: round(readNumber(raw.ctl), 1),
    atl: round(readNumber(raw.atl), 1),
  };
}

export async function syncRecent(
  userId: number,
  daysBack = 30,
): Promise<IntervalsSyncResult> {
  const creds = await getCredsForSync(userId);
  if (!creds) {
    // User hasn't connected intervals.icu — return an empty result
    // instead of throwing so callers can no-op cleanly.
    const today = ymd(new Date());
    return {
      fetched: 0,
      upserted: 0,
      skippedEmpty: 0,
      oldest: today,
      newest: today,
    };
  }

  const newest = new Date();
  const oldest = addDays(newest, -daysBack);
  const oldestYmd = ymd(oldest);
  const newestYmd = ymd(newest);

  const rows = await getWellnessRange(creds, oldestYmd, newestYmd);

  let upserted = 0;
  let skippedEmpty = 0;
  for (const w of rows) {
    if (!hasSignal(w)) {
      skippedEmpty += 1;
      continue;
    }
    const n = normalize(w);
    // Field-level merge: only overwrite when the source has a non-null value.
    const patch: Record<string, unknown> = { lastAutoSyncAt: new Date() };
    for (const [k, v] of Object.entries(n)) {
      if (k === "date") continue;
      if (v != null) patch[k] = v;
    }

    await db
      .insert(dailyMetric)
      .values({
        userId,
        date: n.date,
        bodyWeightKg: n.bodyWeightKg,
        restingHrBpm: n.restingHrBpm,
        hrvMs: n.hrvMs,
        sleepMinutes: n.sleepMinutes,
        steps: n.steps,
        sleepScore: n.sleepScore,
        sleepQuality: n.sleepQuality,
        vo2Max: n.vo2Max,
        spo2Pct: n.spo2Pct,
        bodyFatPct: n.bodyFatPct,
        respirationRpm: n.respirationRpm,
        avgSleepingHrBpm: n.avgSleepingHrBpm,
        readiness: n.readiness,
        stressScore: n.stressScore,
        ctl: n.ctl,
        atl: n.atl,
        lastAutoSyncAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [dailyMetric.userId, dailyMetric.date],
        set: patch,
      });
    upserted += 1;
  }

  await markSynced(userId);

  return {
    fetched: rows.length,
    upserted,
    skippedEmpty,
    oldest: oldestYmd,
    newest: newestYmd,
  };
}
