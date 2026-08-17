import Link from "next/link";
import { and, asc, eq, gte, lte, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { trail } from "@/db/schema";
import {
  assessTrail,
  VERDICT_COLOR,
  VERDICT_LABEL,
} from "@/lib/basecamp/trail-assessment";
import { parseYmd, todayInTimeZone, ymd } from "@/lib/date";
import { formatFt, formatKm, type Units } from "@/lib/units";

export async function UpcomingTrails({
  userId,
  tz,
  units,
}: {
  userId: number;
  tz: string;
  units: Units;
}) {
  const today = todayInTimeZone(tz);
  const horizon = ymd(new Date(new Date(today).getTime() + 60 * 86_400_000));

  const rows = await db
    .select()
    .from(trail)
    .where(
      and(
        eq(trail.userId, userId),
        isNotNull(trail.targetDate),
        gte(trail.targetDate, today),
        lte(trail.targetDate, horizon),
      ),
    )
    .orderBy(asc(trail.targetDate));

  // Empty state promotes destination-recommendation flow. Common case for
  // new users who haven't saved any trails yet.
  if (rows.length === 0) {
    return (
      <section className="space-y-2">
        <h3 className="text-xs uppercase tracking-widest text-muted">
          Planning a trip?
        </h3>
        <Link
          href="/trails/discover"
          className="block rounded-md border border-accent/40 bg-accent-strong/5 px-4 py-3 hover:border-accent/70 transition"
        >
          <div className="text-sm font-medium">
            Show me hikes at a destination →
          </div>
          <div className="text-xs text-muted mt-0.5">
            Type a national park or region and see which trails are ready for
            you.
          </div>
        </Link>
      </section>
    );
  }

  // Assess each — fine at 60-day horizon (max a handful of trails)
  const assessed = await Promise.all(
    rows.map(async (t) => ({
      trail: t,
      assessment: await assessTrail(userId, t, today),
    })),
  );

  return (
    <section className="space-y-2">
      <h3 className="text-xs uppercase tracking-widest text-muted">
        Upcoming trails · next 60 days
      </h3>
      <div className="space-y-2">
        {assessed.map(({ trail: t, assessment }) => {
          const daysAway = assessment.daysUntilTrail ?? 0;
          const dayLabel =
            daysAway === 0
              ? "Today"
              : daysAway === 1
                ? "Tomorrow"
                : `In ${daysAway} days`;
          return (
            <Link
              key={t.id}
              href={`/trails/${t.id}`}
              className={`block rounded-md border px-4 py-3 hover:border-blue-500/40 transition ${
                t.isPrimary
                  ? "border-blue-500/60 bg-blue-950/20"
                  : "border-panel-border bg-panel"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-medium truncate">
                  {t.isPrimary && <span className="text-blue-300 mr-1.5">★</span>}
                  {t.name}
                </div>
                <div className="text-xs text-muted whitespace-nowrap">
                  {dayLabel}
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-3 mt-1">
                <div className="text-xs text-muted">
                  {formatKm(t.distanceKm, units)} · +
                  {formatFt(t.elevationGainFt, units)} · ~{t.typicalHours}h
                </div>
                <div
                  className={`text-[10px] font-mono uppercase tracking-wider whitespace-nowrap ${VERDICT_COLOR[assessment.verdict]}`}
                >
                  {VERDICT_LABEL[assessment.verdict]}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="pt-1">
        <Link
          href="/trails/discover"
          className="text-xs text-blue-300 hover:underline"
        >
          Planning another trip? Discover more →
        </Link>
      </div>
    </section>
  );
}
