import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { trail } from "@/db/schema";
import {
  assessTrail,
  STATUS_LABEL,
  VERDICT_COLOR,
  VERDICT_LABEL,
} from "@/lib/basecamp/trail-assessment";
import { todayInTimeZone } from "@/lib/date";
import { TrailIcon } from "@/components/ui/icons";
import type { UserProfile } from "@/db/schema";

/**
 * Compact 'your objective' card for the home page. Shows the primary
 * trail's readiness verdict, the weakest dimension name, and how
 * many weeks it takes to close. Absorbs the trip-card + summit-hero
 * roles into one honest tile.
 *
 * Silent when the user has no primary trail set — we don't push a
 * default 'go pick one' card in this slot; the discover CTA
 * elsewhere on home covers that.
 */
export async function ObjectiveCard({ user }: { user: UserProfile }) {
  const [primary] = await db
    .select()
    .from(trail)
    .where(eq(trail.userId, user.id))
    .limit(50)
    .then((rows) => rows.filter((r) => r.isPrimary));
  if (!primary) return null;

  const today = todayInTimeZone(user.timezone);
  const assessment = await assessTrail(user.id, primary, today);
  const verdictColor = VERDICT_COLOR[assessment.verdict];
  const verdictLabel = VERDICT_LABEL[assessment.verdict];

  // Weakest buildable dimension (endurance / vertical / pack) — the
  // one that gates 'ready' and drives the weeks-to-ready count.
  const buildable = assessment.dimensions.filter(
    (d) => d.key === "endurance" || d.key === "vertical" || d.key === "pack",
  );
  const weakest = buildable.reduce((worst, d) =>
    d.ratio < worst.ratio ? d : worst,
  );

  return (
    <Link
      href={`/trails/${primary.id}`}
      className="block rounded-lg border border-blue-500/30 bg-blue-950/10 shadow-lg shadow-blue-500/10 p-4 hover:border-blue-500/50 transition"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-blue-400">
          <TrailIcon size={12} />
          Your objective
        </div>
        {primary.targetDate && (
          <div className="text-[10px] text-muted font-mono tabular-nums">
            {daysUntil(today, primary.targetDate)}
          </div>
        )}
      </div>

      <div className="mt-1.5">
        <div className="text-base font-medium truncate">{primary.name}</div>
        <div className={`text-sm font-medium mt-1 ${verdictColor}`}>
          {verdictLabel}
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-blue-500/10 text-xs space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-muted">
            Weakest:{" "}
            <span className="text-foreground capitalize">{weakest.label}</span>
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted">
            {STATUS_LABEL[weakest.status]}
          </span>
        </div>
        {assessment.weeksToReady != null && (
          <div className="text-blue-300/90">
            ~
            <span className="font-mono font-medium tabular-nums">
              {assessment.weeksToReady}
            </span>{" "}
            week{assessment.weeksToReady === 1 ? "" : "s"} at your current
            trajectory to close it.
          </div>
        )}
      </div>
    </Link>
  );
}

function daysUntil(today: string, target: string): string {
  const [ty, tm, td] = today.split("-").map(Number);
  const [gy, gm, gd] = target.split("-").map(Number);
  const days = Math.round(
    (Date.UTC(gy, gm - 1, gd) - Date.UTC(ty, tm - 1, td)) / 86_400_000,
  );
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days}d`;
}
