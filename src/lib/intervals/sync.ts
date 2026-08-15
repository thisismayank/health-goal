import { addDays, formatISO } from "date-fns";
import { db } from "@/db/client";
import { dailyMetric } from "@/db/schema";
import { ymd } from "@/lib/date";
import { getWellnessRange, type IntervalsWellness } from "./client";

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

// Only upsert if the row has at least one signal we care about.
function hasSignal(w: IntervalsWellness): boolean {
  return (
    nonZero(w.weight) ||
    nonZero(w.restingHR) ||
    nonZero(w.hrv) ||
    nonZero(w.hrvSDNN) ||
    nonZero(w.sleepSecs) ||
    nonZero(w.steps)
  );
}

function normalize(w: IntervalsWellness) {
  const hrvMs = nonZero(w.hrvSDNN) ? w.hrvSDNN : nonZero(w.hrv) ? w.hrv : null;
  return {
    date: w.id,
    bodyWeightKg: nonZero(w.weight) ? +(w.weight as number).toFixed(2) : null,
    restingHrBpm: nonZero(w.restingHR) ? Math.round(w.restingHR as number) : null,
    hrvMs: hrvMs != null ? +(hrvMs as number).toFixed(1) : null,
    sleepMinutes: nonZero(w.sleepSecs)
      ? Math.round((w.sleepSecs as number) / 60)
      : null,
    steps: nonZero(w.steps) ? Math.round(w.steps as number) : null,
  };
}

export async function syncRecent(
  userId: number,
  daysBack = 30,
): Promise<IntervalsSyncResult> {
  const newest = new Date();
  const oldest = addDays(newest, -daysBack);
  const oldestYmd = ymd(oldest);
  const newestYmd = ymd(newest);

  const rows = await getWellnessRange(oldestYmd, newestYmd);

  let upserted = 0;
  let skippedEmpty = 0;
  for (const w of rows) {
    if (!hasSignal(w)) {
      skippedEmpty += 1;
      continue;
    }
    const n = normalize(w);
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
        lastAutoSyncAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [dailyMetric.userId, dailyMetric.date],
        set: {
          // Only overwrite fields where the source has a non-null value.
          ...(n.bodyWeightKg != null ? { bodyWeightKg: n.bodyWeightKg } : {}),
          ...(n.restingHrBpm != null ? { restingHrBpm: n.restingHrBpm } : {}),
          ...(n.hrvMs != null ? { hrvMs: n.hrvMs } : {}),
          ...(n.sleepMinutes != null ? { sleepMinutes: n.sleepMinutes } : {}),
          ...(n.steps != null ? { steps: n.steps } : {}),
          lastAutoSyncAt: new Date(),
        },
      });
    upserted += 1;
  }

  return {
    fetched: rows.length,
    upserted,
    skippedEmpty,
    oldest: oldestYmd,
    newest: newestYmd,
  };
}
