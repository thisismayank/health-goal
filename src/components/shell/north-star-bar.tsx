import Link from "next/link";
import { headers } from "next/headers";
import { differenceInCalendarWeeks } from "date-fns";
import { getActivePlan, getCurrentUser } from "@/lib/data";
import {
  getActiveGoal,
  getCumulativeVertical,
} from "@/lib/basecamp/summit";
import { computeCharacterSheet } from "@/lib/basecamp/stats";
import { computeRank } from "@/lib/basecamp/rank";
import { parseYmd, todayInTimeZone } from "@/lib/date";

// Paths where the shell should be hidden entirely — auth pages that need
// to feel like their own thing, not a page inside the app.
const CHROMELESS_PREFIXES = ["/login", "/welcome"];

export async function NorthStarBar() {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  if (CHROMELESS_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

  const user = await getCurrentUser();
  if (!user) {
    return (
      <NorthStarShell>
        <div className="flex-1 text-xs text-muted">BASECAMP</div>
        <Link
          href="/settings"
          aria-label="Settings"
          className="text-lg text-muted hover:text-foreground"
        >
          ⚙
        </Link>
      </NorthStarShell>
    );
  }

  const [goal, vertical, sheet, plan] = await Promise.all([
    getActiveGoal(user.id),
    getCumulativeVertical(user.id),
    computeCharacterSheet(user.id),
    getActivePlan(user.id),
  ]);

  const rank = computeRank(sheet);
  // If the user has climbed >= 1× the summit's worth of vertical, the
  // '%' badge stops meaning anything (would peg at 100 forever). Switch
  // to a multiplier ('1.4×') so the number stays informative.
  const summitRatio = vertical.totalFt / Math.max(1, goal.summitFt);
  const summitBadge =
    summitRatio >= 1
      ? `${summitRatio.toFixed(1)}×`
      : `${Math.round(summitRatio * 100)}%`;

  const today = todayInTimeZone(user.timezone);
  // Use the plan's actual span, not a hardcoded 16-week seed. Falls
  // back to null when we have no plan.
  const planTotalWeeks =
    plan?.eventDate && plan.startDate
      ? Math.max(
          1,
          differenceInCalendarWeeks(
            parseYmd(plan.eventDate),
            parseYmd(plan.startDate),
            { weekStartsOn: 1 },
          ),
        )
      : null;
  const weekNumberRaw = plan
    ? differenceInCalendarWeeks(parseYmd(today), parseYmd(plan.startDate), {
        weekStartsOn: 1,
      }) + 1
    : null;
  // Clamp to 1..totalWeeks so a plan shifted into the future can't
  // render 'Week -3 / 41' — instead show week 1 until it starts, and
  // the final week after it ends.
  const weekNumber =
    weekNumberRaw != null && planTotalWeeks != null
      ? Math.min(planTotalWeeks, Math.max(1, weekNumberRaw))
      : weekNumberRaw;

  const goalLabel = goal.source === "default_rainier" ? "Rainier" : goal.name;

  return (
    <NorthStarShell>
      <Link
        href="/trails"
        className="flex items-baseline gap-1.5 min-w-0 hover:opacity-80 transition"
        title={`${vertical.totalFt.toLocaleString()} ft climbed · ${goal.summitFt.toLocaleString()} ft summit`}
      >
        <span className="font-mono font-semibold text-blue-300 text-sm tabular-nums">
          {summitBadge}
        </span>
        <span className="text-xs text-muted truncate">{goalLabel}</span>
      </Link>

      <span className="text-blue-500/30 text-xs">·</span>

      <Link
        href="/progress"
        className="flex items-baseline gap-1 hover:opacity-80 transition shrink-0"
        title={`${rank.currentLabel} — ${rank.currentDescription}`}
      >
        <span className="text-[10px] uppercase tracking-wider text-muted">
          Class
        </span>
        <span className="font-mono font-semibold text-blue-300 text-sm">
          {rank.current}
        </span>
      </Link>

      {weekNumber != null && (
        <>
          <span className="text-blue-500/30 text-xs">·</span>
          <Link
            href="/train"
            className="flex items-baseline gap-1 hover:opacity-80 transition shrink-0"
            title="Training week"
          >
            <span className="text-[10px] uppercase tracking-wider text-muted">
              Wk
            </span>
            <span className="font-mono text-blue-300 text-sm tabular-nums">
              {weekNumber}
              <span className="text-muted text-[10px]">/{planTotalWeeks ?? "?"}</span>
            </span>
          </Link>
        </>
      )}

      <div className="flex-1" />

      <Link
        href="/settings"
        aria-label="Settings"
        className="text-lg text-muted hover:text-foreground shrink-0"
      >
        ⚙
      </Link>
    </NorthStarShell>
  );
}

export function NorthStarBarSkeleton() {
  return (
    <NorthStarShell>
      <div className="h-4 w-40 animate-pulse rounded bg-panel-border" />
      <div className="flex-1" />
      <div className="text-lg text-muted">⚙</div>
    </NorthStarShell>
  );
}

function NorthStarShell({ children }: { children: React.ReactNode }) {
  return (
    <header
      className="sticky top-0 z-40 border-b border-blue-500/20 bg-background/95 backdrop-blur"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto max-w-2xl px-4 py-2.5 flex items-center gap-2.5">
        {children}
      </div>
    </header>
  );
}
