import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { dailyMetric } from "@/db/schema";

export type Baseline = {
  baseline: number | null;
  current: number | null;
  deltaAbs: number | null;
  deltaPct: number | null;
  windowDays: number;
  samples: number;
};

const WINDOW_DAYS = 21;

function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

type Column = "restingHrBpm" | "hrvMs" | "sleepMinutes";

async function loadWindow(
  userId: number,
  todayYmd: string,
  column: Column,
): Promise<{ past: number[]; current: number | null }> {
  const start = shiftYmd(todayYmd, -WINDOW_DAYS);
  const rows = await db
    .select()
    .from(dailyMetric)
    .where(and(eq(dailyMetric.userId, userId), gte(dailyMetric.date, start)));
  const past: number[] = [];
  let current: number | null = null;
  for (const r of rows) {
    const v = r[column];
    if (typeof v !== "number") continue;
    if (r.date === todayYmd) current = v;
    else if (r.date < todayYmd) past.push(v);
  }
  return { past, current };
}

async function baselineFor(
  userId: number,
  todayYmd: string,
  column: Column,
): Promise<Baseline> {
  const { past, current } = await loadWindow(userId, todayYmd, column);
  const baseline = median(past);
  const deltaAbs =
    current != null && baseline != null
      ? +(current - baseline).toFixed(1)
      : null;
  const deltaPct =
    current != null && baseline != null && baseline !== 0
      ? +(((current - baseline) / baseline) * 100).toFixed(1)
      : null;
  return {
    baseline: baseline != null ? +baseline.toFixed(1) : null,
    current,
    deltaAbs,
    deltaPct,
    windowDays: WINDOW_DAYS,
    samples: past.length,
  };
}

export function rhrBaseline(userId: number, todayYmd: string) {
  return baselineFor(userId, todayYmd, "restingHrBpm");
}

export function hrvBaseline(userId: number, todayYmd: string) {
  return baselineFor(userId, todayYmd, "hrvMs");
}

export function sleepBaseline(userId: number, todayYmd: string) {
  return baselineFor(userId, todayYmd, "sleepMinutes");
}
