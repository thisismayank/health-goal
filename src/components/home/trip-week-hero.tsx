import Link from "next/link";
import { LogCompletionForm } from "@/components/trails/log-completion";
import type { TripPhase } from "@/lib/home/state";
import type { PlannedSession, Trail, TrailCompletion } from "@/db/schema";
import {
  interpretWeatherCode,
  type DailyForecast,
} from "@/lib/weather/open-meteo";

type Props = {
  trail: Trail;
  daysUntilTrip: number;
  phaseKind: TripPhase;
  todayYmd: string;
  todaySession: PlannedSession | null;
  recentCompletion: TrailCompletion | null;
  // Trip-day forecast, when we could resolve destination coords. Absent
  // on post-trip phase and for unknown destinations.
  forecast: DailyForecast | null;
};

const PHASE_STYLE: Record<TripPhase, string> = {
  final_prep:
    "border-blue-500/40 bg-blue-950/10 shadow-lg shadow-blue-500/10",
  taper: "border-warn/40 bg-warn/5 shadow-lg shadow-warn/10",
  trip_day:
    "border-accent/60 bg-accent-strong/10 shadow-lg shadow-accent/20 recap-glow",
  post_trip:
    "border-blue-500/40 bg-blue-950/10 shadow-lg shadow-blue-500/10",
};

const PHASE_LABEL_COLOR: Record<TripPhase, string> = {
  final_prep: "text-blue-400",
  taper: "text-warn",
  trip_day: "text-accent",
  post_trip: "text-blue-400",
};

const PHASE_TAG: Record<TripPhase, string> = {
  final_prep: "[FINAL PREP]",
  taper: "[TAPER]",
  trip_day: "[TRIP DAY]",
  post_trip: "[POST-TRIP]",
};

export function TripWeekHero({
  trail,
  daysUntilTrip,
  phaseKind,
  todayYmd,
  todaySession,
  recentCompletion,
  forecast,
}: Props) {
  const countdownLabel =
    daysUntilTrip > 1
      ? `${daysUntilTrip} DAYS`
      : daysUntilTrip === 1
        ? "1 DAY"
        : daysUntilTrip === 0
          ? "TODAY"
          : daysUntilTrip === -1
            ? "YESTERDAY"
            : `${Math.abs(daysUntilTrip)} DAYS AGO`;

  return (
    <div className="space-y-3">
      <section
        className={`rounded-lg border p-5 space-y-4 ${PHASE_STYLE[phaseKind]}`}
      >
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div
              className={`text-xs font-mono uppercase tracking-widest ${PHASE_LABEL_COLOR[phaseKind]}`}
            >
              {PHASE_TAG[phaseKind]} · TRIP IN {countdownLabel}
            </div>
            <h2 className="text-xl font-semibold mt-1 leading-tight">
              {trail.name}
            </h2>
            <div className="text-xs text-muted mt-0.5">
              {trail.distanceKm} km · +{trail.elevationGainFt.toLocaleString()} ft
              · max {trail.maxAltitudeFt.toLocaleString()} ft · ~
              {trail.typicalHours}h
            </div>
          </div>
          {daysUntilTrip > 0 && (
            <div className="text-right shrink-0">
              <div className="text-4xl font-mono font-semibold text-blue-300 leading-none tabular-nums">
                {daysUntilTrip}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted mt-1">
                days out
              </div>
            </div>
          )}
        </div>

        {forecast && phaseKind !== "post_trip" && (
          <WeatherLine forecast={forecast} phase={phaseKind} />
        )}

        <PhaseGuidance kind={phaseKind} trail={trail} />

        {phaseKind === "trip_day" && recentCompletion == null && (
          <div className="pt-3 border-t border-accent/30">
            <div className="text-[11px] text-muted mb-2">
              Log it when you're back:
            </div>
            <LogCompletionForm trailId={trail.id} todayYmd={todayYmd} />
          </div>
        )}

        {phaseKind === "post_trip" && recentCompletion == null && (
          <div className="pt-3 border-t border-blue-500/20">
            <div className="text-sm mb-2">
              How did it go? Log your completion to close out the trip.
            </div>
            <LogCompletionForm trailId={trail.id} todayYmd={todayYmd} />
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Link
            href={`/trails/${trail.id}`}
            className="text-xs text-blue-300 hover:underline"
          >
            Open trail →
          </Link>
          <span className="text-blue-500/30 text-xs">·</span>
          <Link
            href={`/trails/${trail.id}`}
            className="text-xs text-muted hover:text-foreground"
          >
            Update pack weight
          </Link>
        </div>
      </section>

      {recentCompletion && (
        <section className="rounded-lg border border-accent/50 bg-accent-strong/5 shadow-lg shadow-accent/10 p-5 space-y-3 recap-glow">
          <div className="text-xs font-mono uppercase tracking-widest text-accent">
            [TRIP REPORT · CLEARED]
          </div>
          <div>
            <h3 className="text-lg font-medium">
              You did {trail.name}. Nice.
            </h3>
            <div className="text-xs text-muted mt-0.5 tabular-nums">
              Completed {recentCompletion.completedAt}
              {recentCompletion.timeMinutes != null && (
                <span> · {formatMinutes(recentCompletion.timeMinutes)}</span>
              )}
            </div>
          </div>
          {recentCompletion.notes && (
            <p className="text-sm text-foreground/80 italic">
              "{recentCompletion.notes}"
            </p>
          )}
          <div className="pt-3 border-t border-accent/20 text-xs text-muted">
            Stamp added to your{" "}
            <Link
              href="/progress"
              className="text-blue-300 hover:underline"
            >
              trail passport
            </Link>
            .
          </div>
        </section>
      )}

      {todaySession && (daysUntilTrip <= 3 || daysUntilTrip === 0) && (
        <Link
          href="/train"
          className="block rounded-lg border border-panel-border bg-panel/60 px-4 py-3 hover:border-blue-500/40 transition"
        >
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-muted">
                Today's planned session
              </div>
              <div className="text-sm font-medium mt-0.5 truncate">
                {todaySession.title}
              </div>
            </div>
            <div className="text-xs text-muted whitespace-nowrap tabular-nums">
              {todaySession.targetDurationMinutes != null
                ? `${todaySession.targetDurationMinutes} min`
                : "—"}
            </div>
          </div>
          {phaseKind === "taper" && (
            <div className="text-[11px] text-warn italic mt-1">
              Consider swapping for rest or light mobility only.
            </div>
          )}
        </Link>
      )}
    </div>
  );
}

function PhaseGuidance({
  kind,
  trail,
}: {
  kind: TripPhase;
  trail: Trail;
}) {
  if (kind === "final_prep") {
    return (
      <div className="space-y-2">
        <div className="text-[11px] font-mono uppercase tracking-widest text-blue-300">
          Focus this week
        </div>
        <ul className="text-sm space-y-1">
          <li className="flex gap-2">
            <span className="text-blue-400">▸</span>
            <span>
              One mid-week long session (approximate the trail's demands).
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-blue-400">▸</span>
            <span>Start your gear checklist. Break in any new boots.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-blue-400">▸</span>
            <span>Check the extended forecast for the trip window.</span>
          </li>
          {trail.packWeightLb > 0 && (
            <li className="flex gap-2">
              <span className="text-blue-400">▸</span>
              <span>
                Test your pack at target weight (~{trail.packWeightLb} lb) on
                one of the sessions.
              </span>
            </li>
          )}
        </ul>
      </div>
    );
  }

  if (kind === "taper") {
    return (
      <div className="space-y-2">
        <div className="text-[11px] font-mono uppercase tracking-widest text-warn">
          Rest window
        </div>
        <ul className="text-sm space-y-1">
          <li className="flex gap-2">
            <span className="text-warn">▸</span>
            <span>
              No strenuous training. Walks and mobility only. Fitness is
              already in the bank.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-warn">▸</span>
            <span>Hydrate consistently. Aim for 8+ hours of sleep.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-warn">▸</span>
            <span>Finalize gear, snacks, route notes. Weather one more check.</span>
          </li>
          {trail.maxAltitudeFt >= 10000 && (
            <li className="flex gap-2">
              <span className="text-warn">▸</span>
              <span>
                Altitude {trail.maxAltitudeFt.toLocaleString()} ft — sleep as
                high as you can the night before if possible.
              </span>
            </li>
          )}
        </ul>
      </div>
    );
  }

  if (kind === "trip_day") {
    return (
      <div className="space-y-2">
        <p className="text-sm leading-relaxed">
          Have an amazing hike. Trust the training you've done.
        </p>
        <ul className="text-sm space-y-1">
          <li className="flex gap-2">
            <span className="text-accent">▸</span>
            <span>Start early. Weather + light are both easier in the AM.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-accent">▸</span>
            <span>Eat + drink on schedule, not by feel. Prevent bonking.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-accent">▸</span>
            <span>Turnaround time non-negotiable. Summit is optional; going home is not.</span>
          </li>
        </ul>
      </div>
    );
  }

  // post_trip
  return (
    <p className="text-sm leading-relaxed">
      Whether you crushed it or turned back — log what happened. It counts
      toward your Hiker Class and adds a stamp to your passport.
    </p>
  );
}

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}m`;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

// Actionable weather one-liner — same triggers as the trip-week emails
// (kept in sync intentionally: same logic, same thresholds, so users see
// the same advice via email and in-app).
function weatherAdvice(f: DailyForecast): string {
  const bits: string[] = [];
  if (f.weatherCode >= 95) {
    bits.push("Thunderstorms possible — off exposed terrain by 1pm.");
  }
  if (f.precipProbabilityPct >= 60) {
    bits.push("Wet day — waterproof layers, extra grip on rocks.");
  } else if (f.precipProbabilityPct >= 40) {
    bits.push("Chance of rain — pack a shell.");
  }
  if (f.windMaxMph >= 30) {
    bits.push("High wind — helmet or hood on ridges; watch for cornices.");
  } else if (f.windMaxMph >= 20) {
    bits.push("Windy — layer up on exposed sections.");
  }
  if (f.tempMaxF <= 40) {
    bits.push("Cold — layer up + protect extremities early.");
  } else if (f.tempMaxF >= 85) {
    bits.push("Hot — front-load water, start early.");
  }
  return bits.join(" ");
}

function WeatherLine({
  forecast,
  phase,
}: {
  forecast: DailyForecast;
  phase: TripPhase;
}) {
  const { glyph, label } = interpretWeatherCode(forecast.weatherCode);
  const advice = weatherAdvice(forecast);
  const header =
    phase === "trip_day" ? "Conditions today" : "Trip-day outlook";
  const rainSignal = forecast.precipProbabilityPct >= 40;
  const windSignal = forecast.windMaxMph >= 20;
  return (
    <div className="rounded-md border border-blue-500/30 bg-background/40 px-3 py-2 space-y-1">
      <div className="text-[10px] font-mono uppercase tracking-widest text-blue-300">
        {header} · {forecast.date}
      </div>
      <div className="text-sm flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-blue-300">
          {glyph} {label}
        </span>
        <span className="text-muted">·</span>
        <span className="tabular-nums">
          {forecast.tempMinF}–{forecast.tempMaxF}°F
        </span>
        <span className="text-muted">·</span>
        <span
          className={
            rainSignal ? "text-warn tabular-nums" : "text-muted tabular-nums"
          }
        >
          {forecast.precipProbabilityPct}% precip
          {forecast.precipInches >= 0.1 &&
            ` (${forecast.precipInches.toFixed(2)}″)`}
        </span>
        <span className="text-muted">·</span>
        <span
          className={
            windSignal ? "text-warn tabular-nums" : "text-muted tabular-nums"
          }
        >
          {forecast.windMaxMph} mph wind
        </span>
      </div>
      {advice && (
        <p className="text-xs text-warn leading-relaxed">{advice}</p>
      )}
    </div>
  );
}
