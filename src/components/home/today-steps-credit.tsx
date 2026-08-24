import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { dailyMetric } from "@/db/schema";
import { todayInTimeZone } from "@/lib/date";

const STEP_BASELINE = 5000;
const STEPS_PER_MINUTE = 100;
const CAP_MIN = 90;
const SHOW_THRESHOLD_STEPS = 10000;

/**
 * "You walked X today — counts as ~Y active-recovery min."
 *
 * Shows only when today's step count is genuinely high (≥ 10k). On
 * the session-pending Home state it reassures a user who hasn't
 * (yet) done the prescribed session that their walking still counts
 * as effort toward the goal. Aligned with the STR/END compute paths
 * that fold step credit into aerobic minutes — same threshold,
 * same conversion.
 */
export async function TodayStepsCredit({
  userId,
  tz,
}: {
  userId: number;
  tz: string;
}) {
  const today = todayInTimeZone(tz);
  const [row] = await db
    .select({ steps: dailyMetric.steps })
    .from(dailyMetric)
    .where(and(eq(dailyMetric.userId, userId), eq(dailyMetric.date, today)))
    .limit(1);
  const steps = row?.steps ?? null;
  if (steps == null || steps < SHOW_THRESHOLD_STEPS) return null;

  const aerobicMin = Math.min(
    CAP_MIN,
    Math.round((steps - STEP_BASELINE) / STEPS_PER_MINUTE),
  );

  return (
    <div className="rounded-md border border-emerald-500/30 bg-emerald-950/10 p-3 text-xs text-foreground/85 flex items-start gap-2">
      <span className="text-emerald-300 text-sm leading-none">▸</span>
      <div>
        You&apos;ve walked{" "}
        <span className="font-mono text-emerald-300 tabular-nums">
          {steps.toLocaleString()}
        </span>{" "}
        steps today. That&apos;s ~
        <span className="font-mono text-emerald-300 tabular-nums">
          {aerobicMin}
        </span>{" "}
        min of active recovery — if today&apos;s session doesn&apos;t
        happen, this still counts.
      </div>
    </div>
  );
}
