import Link from "next/link";
import { computeDecayState } from "@/lib/basecamp/decay";

const MIN_IDLE_DAYS = 5;

/**
 * Detraining nudge on Home. Silent for the first ~4 days off (normal
 * rest week). Once idle days ≥ 5 the app owes the user an honest
 * read: which capacities have decayed, by how much, and what's the
 * fastest thing that arrests the slide.
 *
 * Tone is matter-of-fact, not scolding. Numbers come from the decay
 * curves in lib/basecamp/decay.ts.
 */
export async function IdleBanner({
  userId,
  todayIso,
}: {
  userId: number;
  todayIso?: string; // ISO string; component computes its own Date if omitted
}) {
  const now = todayIso ? new Date(todayIso) : new Date();
  const state = await computeDecayState(userId, now);
  if (state.idleDays == null || state.idleDays < MIN_IDLE_DAYS) return null;

  const aerobic = state.dims.find((d) => d.dim === "aerobic");
  const vertical = state.dims.find((d) => d.dim === "vertical");
  const pack = state.dims.find((d) => d.dim === "pack");

  const pieces: string[] = [];
  if (aerobic && aerobic.daysSinceLast != null && aerobic.lossPct > 0.02) {
    pieces.push(`endurance −${Math.round(aerobic.lossPct * 100)}%`);
  }
  if (vertical && vertical.daysSinceLast != null && vertical.lossPct > 0.02) {
    pieces.push(`vertical −${Math.round(vertical.lossPct * 100)}%`);
  }
  if (pack && pack.daysSinceLast != null && pack.lossPct > 0.02) {
    pieces.push(`pack −${Math.round(pack.lossPct * 100)}%`);
  }
  if (
    state.altitudeWindowDaysLeft != null &&
    state.altitudeWindowDaysLeft > 0 &&
    state.altitudeWindowDaysLeft <= 10
  ) {
    pieces.push(
      `altitude window closes in ${state.altitudeWindowDaysLeft}d`,
    );
  }

  // Nothing worth surfacing (all dims fresh, e.g. user rested from
  // strength but still ran) — bail silently.
  if (pieces.length === 0) return null;

  return (
    <section className="rounded-lg border border-warn/40 bg-warn/5 p-4 space-y-2">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="text-[10px] font-mono uppercase tracking-widest text-warn">
          [DETRAINING · {state.idleDays}D OFF]
        </div>
        <Link
          href="/progress"
          className="text-[11px] text-blue-300 hover:underline"
        >
          Trend on /progress →
        </Link>
      </div>
      <p className="text-sm leading-relaxed">
        <span className="text-foreground/90">{pieces.join(" · ")}</span>
      </p>
      <p className="text-xs text-muted leading-relaxed">
        Aerobic base drops fastest in week 2. A 30–45 min Z2 today arrests
        the slide. Strength retains longer — one full-body session this
        week keeps pack capacity intact.
      </p>
      <div className="flex gap-2 pt-1">
        <Link
          href="/train"
          className="text-xs rounded-md border border-blue-500/40 bg-blue-950/20 hover:border-blue-400 px-3 py-1.5 text-blue-100"
        >
          See this week →
        </Link>
        <Link
          href="/coach"
          className="text-xs rounded-md border border-panel-border bg-panel hover:border-blue-500/40 px-3 py-1.5"
        >
          Ask the coach
        </Link>
      </div>
    </section>
  );
}
