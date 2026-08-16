/**
 * One-shot: parse a Garmin GDPR data export and backfill daily_metric.
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/garmin-backup-ingest.ts <extracted-dir>
 *
 * Field-level merge: existing non-null values are PRESERVED (intervals.icu
 * live data takes precedence when both sources have the same field for the
 * same date). Only NULL fields get filled from the Garmin export.
 *
 * HRV is NOT in Garmin's GDPR export — it stays behind the live Garmin API
 * and only flows through intervals.icu.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { dailyMetric } from "../src/db/schema";

const ROOT = process.argv[2];
if (!ROOT) {
  console.error("usage: garmin-backup-ingest.ts <extracted-dir>");
  process.exit(1);
}

const USER_ID = Number(process.env.GARMIN_INGEST_USER_ID ?? "1");

type Patch = {
  restingHrBpm?: number;
  steps?: number;
  activeEnergyKcal?: number;
  sleepMinutes?: number;
  respirationRpm?: number;
  vo2Max?: number;
};

const perDate = new Map<string, Patch>();

function listFiles(dir: string, pattern: RegExp): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => pattern.test(f))
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

function mergePatch(date: string, patch: Patch) {
  const existing = perDate.get(date) ?? {};
  perDate.set(date, { ...existing, ...patch });
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

// ---------- UDS files (daily aggregates) ----------
type UdsDay = {
  calendarDate?: string;
  restingHeartRate?: number;
  totalSteps?: number;
  activeKilocalories?: number;
};

const udsDir = join(ROOT, "DI_CONNECT/DI-Connect-Aggregator");
let udsCount = 0;
for (const f of listFiles(udsDir, /^UDSFile_.*\.json$/)) {
  const days = readJson<UdsDay[]>(f);
  for (const day of days) {
    if (!day.calendarDate) continue;
    const patch: Patch = {};
    if (day.restingHeartRate && day.restingHeartRate > 0) {
      patch.restingHrBpm = Math.round(day.restingHeartRate);
    }
    if (day.totalSteps && day.totalSteps > 0) {
      patch.steps = Math.round(day.totalSteps);
    }
    if (day.activeKilocalories && day.activeKilocalories > 0) {
      patch.activeEnergyKcal = Math.round(day.activeKilocalories);
    }
    if (Object.keys(patch).length > 0) {
      mergePatch(day.calendarDate, patch);
      udsCount++;
    }
  }
}
console.log(`UDS: parsed ${udsCount} day-records`);

// ---------- Sleep files ----------
type SleepDay = {
  calendarDate?: string;
  sleepStartTimestampGMT?: string;
  sleepEndTimestampGMT?: string;
  awakeSleepSeconds?: number;
  averageRespiration?: number;
};

const wellDir = join(ROOT, "DI_CONNECT/DI-Connect-Wellness");
let sleepCount = 0;
for (const f of listFiles(wellDir, /_sleepData\.json$/)) {
  const days = readJson<SleepDay[]>(f);
  for (const day of days) {
    if (!day.calendarDate) continue;
    const patch: Patch = {};
    if (day.sleepStartTimestampGMT && day.sleepEndTimestampGMT) {
      const start = new Date(day.sleepStartTimestampGMT).getTime();
      const end = new Date(day.sleepEndTimestampGMT).getTime();
      if (!isNaN(start) && !isNaN(end) && end > start) {
        const durSec = (end - start) / 1000;
        const awakeSec = day.awakeSleepSeconds ?? 0;
        const sleepSec = Math.max(0, durSec - awakeSec);
        if (sleepSec > 60) patch.sleepMinutes = Math.round(sleepSec / 60);
      }
    }
    if (day.averageRespiration && day.averageRespiration > 0) {
      patch.respirationRpm = +day.averageRespiration.toFixed(1);
    }
    if (Object.keys(patch).length > 0) {
      mergePatch(day.calendarDate, patch);
      sleepCount++;
    }
  }
}
console.log(`Sleep: parsed ${sleepCount} day-records`);

// ---------- VO2 max ----------
type Vo2Record = {
  calendarDate?: string;
  vo2MaxValue?: number;
};

const metricsDir = join(ROOT, "DI_CONNECT/DI-Connect-Metrics");
let vo2Count = 0;
// If multiple readings per day, keep the latest (files iterate old->new due
// to sorted filename ordering by date range).
const vo2Files = listFiles(metricsDir, /^MetricsMaxMet.*\.json$/).sort();
for (const f of vo2Files) {
  const records = readJson<Vo2Record[]>(f);
  for (const r of records) {
    if (!r.calendarDate) continue;
    if (r.vo2MaxValue && r.vo2MaxValue > 0) {
      mergePatch(r.calendarDate, { vo2Max: +r.vo2MaxValue.toFixed(1) });
      vo2Count++;
    }
  }
}
console.log(`VO2: parsed ${vo2Count} readings`);

console.log(`\ntotal unique dates with any data: ${perDate.size}`);

async function main() {
  console.log("upserting into daily_metric (COALESCE merge)...");
  let upserted = 0;
  const now = new Date();

  for (const [date, patch] of perDate) {
    await db
      .insert(dailyMetric)
      .values({
        userId: USER_ID,
        date,
        restingHrBpm: patch.restingHrBpm ?? null,
        steps: patch.steps ?? null,
        activeEnergyKcal: patch.activeEnergyKcal ?? null,
        sleepMinutes: patch.sleepMinutes ?? null,
        respirationRpm: patch.respirationRpm ?? null,
        vo2Max: patch.vo2Max ?? null,
        lastAutoSyncAt: now,
      })
      .onConflictDoUpdate({
        target: [dailyMetric.userId, dailyMetric.date],
        set: {
          restingHrBpm: sql`COALESCE(${dailyMetric.restingHrBpm}, EXCLUDED.resting_hr_bpm)`,
          steps: sql`COALESCE(${dailyMetric.steps}, EXCLUDED.steps)`,
          activeEnergyKcal: sql`COALESCE(${dailyMetric.activeEnergyKcal}, EXCLUDED.active_energy_kcal)`,
          sleepMinutes: sql`COALESCE(${dailyMetric.sleepMinutes}, EXCLUDED.sleep_minutes)`,
          respirationRpm: sql`COALESCE(${dailyMetric.respirationRpm}, EXCLUDED.respiration_rpm)`,
          vo2Max: sql`COALESCE(${dailyMetric.vo2Max}, EXCLUDED.vo2_max)`,
          lastAutoSyncAt: now,
        },
      });
    upserted++;
    if (upserted % 200 === 0) console.log(`  ...${upserted} dates`);
  }

  console.log(`\ndone. upserted ${upserted} dates.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
