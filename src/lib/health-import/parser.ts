import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { dailyMetric } from "@/db/schema";
import { ymdInTimeZone } from "@/lib/date";

type HAEMetric = {
  name: string;
  units?: string;
  data: Array<Record<string, unknown>>;
};

export type ImportResult = {
  metricsSeen: string[];
  metricsHandled: string[];
  metricsIgnored: string[];
  datesUpdated: string[];
};

type MetricKind =
  | "sleep"
  | "hrv"
  | "rhr"
  | "steps"
  | "weight"
  | "energy";

// Health Auto Export has emitted several formats over the years. Match on
// common aliases (snake, spaced, HK-prefixed) to be robust.
const NAME_ALIASES: Record<string, MetricKind> = {
  sleep_analysis: "sleep",
  "sleep analysis": "sleep",
  sleep: "sleep",
  heart_rate_variability: "hrv",
  heart_rate_variability_sdnn: "hrv",
  hrv: "hrv",
  "hrv sdnn": "hrv",
  hkquantitytypeidentifierheartratevariabilitysdnn: "hrv",
  resting_heart_rate: "rhr",
  "resting heart rate": "rhr",
  restinghr: "rhr",
  hkquantitytypeidentifierrestingheartrate: "rhr",
  step_count: "steps",
  steps: "steps",
  hkquantitytypeidentifierstepcount: "steps",
  body_mass: "weight",
  bodymass: "weight",
  weight: "weight",
  "weight body mass": "weight",
  hkquantitytypeidentifierbodymass: "weight",
  active_energy: "energy",
  "active energy": "energy",
  active_energy_burned: "energy",
  hkquantitytypeidentifieractiveenergyburned: "energy",
};

function classifyMetric(name: string): MetricKind | null {
  const norm = name.toLowerCase().trim();
  return (
    NAME_ALIASES[norm] ??
    NAME_ALIASES[norm.replace(/\s+/g, "_")] ??
    NAME_ALIASES[norm.replace(/[_\s]/g, "")] ??
    null
  );
}

function extractMetricsArray(raw: unknown): HAEMetric[] {
  if (typeof raw !== "object" || raw == null) return [];
  const r = raw as Record<string, unknown>;
  // Common shapes: { data: { metrics: [...] } } OR { metrics: [...] }
  const container =
    (r.data as Record<string, unknown>) ?? r;
  const metrics = (container as { metrics?: unknown[] }).metrics;
  if (!Array.isArray(metrics)) return [];
  return metrics as HAEMetric[];
}

function extractDate(
  entry: Record<string, unknown>,
  tz: string,
): string | null {
  const dateStr =
    (entry.date as string | undefined) ??
    (entry.Date as string | undefined) ??
    (entry.dateStart as string | undefined) ??
    (entry.startDate as string | undefined);
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return ymdInTimeZone(d, tz);
}

function extractValue(
  kind: MetricKind,
  entry: Record<string, unknown>,
  units: string | undefined,
): number | null {
  const asleepHours =
    typeof entry.asleep === "number"
      ? entry.asleep
      : typeof entry.total === "number"
        ? entry.total
        : null;

  if (kind === "sleep") {
    let value: number | null = null;
    if (asleepHours != null) value = asleepHours;
    else if (typeof entry.value === "number") value = entry.value;
    else if (typeof entry.qty === "number") value = entry.qty;
    if (value == null) return null;
    // If unit hint is minutes, keep. If hours (typical for sleep_analysis), convert.
    const u = (units ?? "").toLowerCase();
    if (u.includes("min")) return Math.round(value);
    return Math.round(value * 60);
  }

  if (kind === "hrv") {
    const v =
      (typeof entry.qty === "number" && entry.qty) ??
      (typeof entry.value === "number" && entry.value) ??
      (typeof entry.avg === "number" && entry.avg) ??
      null;
    return typeof v === "number" ? +v.toFixed(1) : null;
  }

  if (kind === "rhr") {
    const v =
      (typeof entry.qty === "number" && entry.qty) ??
      (typeof entry.value === "number" && entry.value) ??
      (typeof entry.avg === "number" && entry.avg) ??
      null;
    return typeof v === "number" ? Math.round(v) : null;
  }

  if (kind === "steps") {
    const v =
      (typeof entry.qty === "number" && entry.qty) ??
      (typeof entry.value === "number" && entry.value) ??
      (typeof entry.total === "number" && entry.total) ??
      null;
    return typeof v === "number" ? Math.round(v) : null;
  }

  if (kind === "weight") {
    const v =
      (typeof entry.qty === "number" && entry.qty) ??
      (typeof entry.value === "number" && entry.value) ??
      null;
    if (typeof v !== "number") return null;
    const u = (units ?? "").toLowerCase();
    if (u.includes("lb") || u.includes("pound")) return +(v * 0.453592).toFixed(2);
    return +v.toFixed(2);
  }

  if (kind === "energy") {
    const v =
      (typeof entry.qty === "number" && entry.qty) ??
      (typeof entry.value === "number" && entry.value) ??
      (typeof entry.total === "number" && entry.total) ??
      null;
    return typeof v === "number" ? Math.round(v) : null;
  }
  return null;
}

type DailyPatch = Partial<{
  sleepMinutes: number;
  hrvMs: number;
  restingHrBpm: number;
  steps: number;
  bodyWeightKg: number;
  activeEnergyKcal: number;
}>;

async function upsertDailyMetric(
  userId: number,
  date: string,
  patch: DailyPatch,
) {
  await db
    .insert(dailyMetric)
    .values({
      userId,
      date,
      sleepMinutes: patch.sleepMinutes ?? null,
      hrvMs: patch.hrvMs ?? null,
      restingHrBpm: patch.restingHrBpm ?? null,
      steps: patch.steps ?? null,
      bodyWeightKg: patch.bodyWeightKg ?? null,
      activeEnergyKcal: patch.activeEnergyKcal ?? null,
      lastAutoSyncAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [dailyMetric.userId, dailyMetric.date],
      set: {
        ...patch,
        lastAutoSyncAt: new Date(),
      },
    });
}

export async function importHealthPayload(
  userId: number,
  tz: string,
  raw: unknown,
): Promise<ImportResult> {
  const metrics = extractMetricsArray(raw);
  const perDate = new Map<string, DailyPatch>();
  const metricsSeen: string[] = [];
  const metricsHandled: string[] = [];
  const metricsIgnored: string[] = [];

  for (const m of metrics) {
    if (!m?.name) continue;
    metricsSeen.push(m.name);
    const kind = classifyMetric(m.name);
    if (!kind) {
      metricsIgnored.push(m.name);
      continue;
    }
    metricsHandled.push(m.name);
    for (const entry of m.data ?? []) {
      const dateStr = extractDate(entry, tz);
      if (!dateStr) continue;
      const value = extractValue(kind, entry, m.units);
      if (value == null) continue;
      const patch = perDate.get(dateStr) ?? {};
      switch (kind) {
        case "sleep":
          patch.sleepMinutes = value;
          break;
        case "hrv":
          patch.hrvMs = value;
          break;
        case "rhr":
          patch.restingHrBpm = value;
          break;
        case "steps":
          patch.steps = value;
          break;
        case "weight":
          patch.bodyWeightKg = value;
          break;
        case "energy":
          patch.activeEnergyKcal = value;
          break;
      }
      perDate.set(dateStr, patch);
    }
  }

  const datesUpdated: string[] = [];
  for (const [date, patch] of perDate) {
    await upsertDailyMetric(userId, date, patch);
    datesUpdated.push(date);
  }

  return { metricsSeen, metricsHandled, metricsIgnored, datesUpdated };
}
