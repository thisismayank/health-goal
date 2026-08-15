import { getDailyRollup, getWeeklyRollup } from "@/lib/analytics/rollups";
import { decideProgression } from "@/lib/analytics/progression";
import {
  generateDailyNarrative,
  generateWeeklyReview,
} from "@/lib/coach/narrative";

type PlanRef = { id: number; startDate: string } | null;

export function CoachCardSkeleton({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-panel-border bg-panel/60 p-5 space-y-3 animate-pulse">
      <div className="text-xs uppercase tracking-widest text-muted">
        {label}
      </div>
      <div className="h-4 bg-panel-border rounded w-3/4" />
      <div className="h-3 bg-panel-border rounded w-full" />
      <div className="h-3 bg-panel-border rounded w-5/6" />
    </div>
  );
}

export async function DailyCoachCard({
  userId,
  today,
  tz,
  plan,
}: {
  userId: number;
  today: string;
  tz: string;
  plan: PlanRef;
}) {
  const rollup = await getDailyRollup(userId, today, tz, plan);
  const narrative = await generateDailyNarrative(userId, rollup);
  if (!narrative) return null;

  return (
    <div className="rounded-lg border border-panel-border bg-panel p-5 space-y-3">
      <div className="text-xs uppercase tracking-widest text-muted">
        Coach · today
      </div>
      <p className="text-sm leading-relaxed">{narrative.summary}</p>
      {narrative.wins.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-accent">
            Wins
          </div>
          <ul className="mt-1 space-y-0.5 text-sm">
            {narrative.wins.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent">▸</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {narrative.concerns.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-warn">
            Watch
          </div>
          <ul className="mt-1 space-y-0.5 text-sm">
            {narrative.concerns.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-warn">▸</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted italic border-t border-panel-border pt-2">
        Tomorrow: {narrative.next_hint}
      </p>
    </div>
  );
}

export async function WeeklyReviewCard({
  userId,
  anchor,
  tz,
  plan,
}: {
  userId: number;
  anchor: Date;
  tz: string;
  plan: PlanRef;
}) {
  const rollup = await getWeeklyRollup(userId, anchor, tz, plan);
  const decision = decideProgression(rollup);
  const review = await generateWeeklyReview(userId, rollup, decision);

  const decisionStyle: Record<string, string> = {
    PROGRESS: "text-accent",
    HOLD: "text-warn",
    DELOAD: "text-warn",
    MANUAL_REVIEW: "text-muted",
  };

  if (!review) {
    // LLM failed but we still surface the deterministic decision.
    return (
      <div className="rounded-lg border border-panel-border bg-panel p-5 space-y-2">
        <div className="text-xs uppercase tracking-widest text-muted">
          Week review · deterministic
        </div>
        <div className={`text-lg font-medium ${decisionStyle[decision.decision]}`}>
          {decision.decision}
        </div>
        <div className="text-xs text-muted">
          Compliance {rollup.compliance.percent}% ·{" "}
          {rollup.actual.totalMinutes}/{rollup.planned.totalMinutes} min ·{" "}
          {rollup.actual.sessions}/{rollup.compliance.total} sessions
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-panel-border bg-panel p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-widest text-muted">
          Week review
        </div>
        <span
          className={`text-xs uppercase tracking-wider ${decisionStyle[decision.decision]}`}
        >
          {decision.decision}
        </span>
      </div>
      <h3 className="text-lg font-medium">{review.headline}</h3>
      <p className="text-sm leading-relaxed">{review.summary}</p>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <Stat label="Compliance" value={`${rollup.compliance.percent}%`} />
        <Stat
          label="Volume"
          value={`${rollup.actual.totalMinutes} / ${rollup.planned.totalMinutes} min`}
        />
        <Stat
          label="Longest"
          value={
            rollup.actual.longestSessionMinutes != null
              ? `${rollup.actual.longestSessionMinutes} min`
              : "–"
          }
        />
        <Stat
          label="Avg RPE"
          value={
            rollup.actual.averageRpe != null
              ? `${rollup.actual.averageRpe}`
              : "–"
          }
        />
      </div>

      {(review.wins.length > 0 || review.concerns.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {review.wins.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-accent">
                Wins
              </div>
              <ul className="mt-1 space-y-0.5 text-sm">
                {review.wins.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-accent">▸</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {review.concerns.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-warn">
                Watch
              </div>
              <ul className="mt-1 space-y-0.5 text-sm">
                {review.concerns.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-warn">▸</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-panel-border pt-3 space-y-2">
        <p className="text-sm">{review.decision_explanation}</p>
        {review.proposed_changes.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wider text-muted">
              Next week — proposed
            </div>
            <ul className="mt-1 space-y-1 text-sm">
              {review.proposed_changes.map((c, i) => (
                <li key={i} className="flex flex-col">
                  <span>
                    {c.variable}: <span className="text-muted">{c.from}</span>
                    {" → "}
                    <span className="text-foreground">{c.to}</span>
                  </span>
                  <span className="text-xs text-muted italic">{c.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {review.unchanged.length > 0 && (
          <p className="text-xs text-muted">
            Unchanged: {review.unchanged.join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-panel-border bg-background/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}
