"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { generateItineraryAdvice, saveItineraryTrails } from "@/lib/actions";
import {
  buildItinerary,
  type AssessedPreset,
  type Overrides,
  type Verdict,
} from "@/lib/basecamp/itinerary";
import type { TrailPreset } from "@/lib/basecamp/trail-library";
import {
  fetchDailyForecast,
  interpretWeatherCode,
  type DailyForecast,
} from "@/lib/weather/open-meteo";

// Local mirror of ItineraryNarrativeSchema from the coach module. That
// module imports drizzle/postgres and can't be pulled into a client
// bundle. Keep this shape in sync.
type ItineraryNarrative = {
  headline: string;
  summary: string;
  perDay: string[];
};

// Inlined here so the client bundle stays free of trail-assessment's
// server-only transitive imports. Keep labels in sync with the server-side
// VERDICT_LABEL / VERDICT_COLOR in trail-assessment.ts.
const VERDICT_LABEL: Record<Verdict, string> = {
  comfortable: "READY",
  achievable: "ACHIEVABLE",
  hard: "HARD",
  do_not_attempt: "DO NOT ATTEMPT",
};
const VERDICT_COLOR: Record<Verdict, string> = {
  comfortable: "text-accent",
  achievable: "text-blue-300",
  hard: "text-warn",
  do_not_attempt: "text-danger",
};

// Compact wire shape — we pass a minimal subset of the assessment from
// the server, not the full object.
export type ItineraryPresetInput = {
  slug: string;
  name: string;
  region: string;
  distanceKm: number;
  elevationGainFt: number;
  maxAltitudeFt: number;
  typicalHours: number;
  packWeightLb: number;
  terrainGrade: string;
  verdict: Verdict;
};

const VERDICT_TONE: Record<Verdict, string> = {
  comfortable: "border-accent/40 bg-accent-strong/5",
  achievable: "border-blue-500/30 bg-blue-950/10",
  hard: "border-warn/30 bg-warn/5",
  do_not_attempt: "border-danger/30 bg-danger/5",
  // fall-throughs for exhaustiveness
};

function todayLocalYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ItineraryPlanner({
  presets,
  destinationLabel,
  coords,
}: {
  presets: ItineraryPresetInput[];
  destinationLabel: string;
  // If provided, planner fetches Open-Meteo forecast when opened + shows
  // per-day weather badges on each day card. Null = destination coords
  // aren't in our lookup table; weather section is hidden.
  coords: { lat: number; lng: number; label: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(3);
  const [startDate, setStartDate] = useState(todayLocalYmd());
  const [includeStretch, setIncludeStretch] = useState(false);
  const [pending, startTransition] = useTransition();
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<ItineraryNarrative | null>(null);
  const [narrativeShape, setNarrativeShape] = useState<string | null>(null);
  const [narrativePending, startNarrativeTransition] = useTransition();
  const [narrativeError, setNarrativeError] = useState<string | null>(null);
  // Per-dayIndex user overrides. Trims to current day range when `days` changes.
  const [overrides, setOverrides] = useState<Overrides>({});
  const [forecast, setForecast] = useState<Map<string, DailyForecast> | null>(null);
  const [forecastState, setForecastState] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");

  // Rehydrate presets into the AssessedPreset shape expected by the
  // sequencer. We only care about fields the sequencer reads.
  const assessed: AssessedPreset[] = useMemo(
    () =>
      presets.map((p) => ({
        preset: presetShape(p),
        assessment: { verdict: p.verdict },
      })),
    [presets],
  );

  const itinerary = useMemo(
    () =>
      buildItinerary({
        matched: assessed,
        startDateYmd: startDate,
        days,
        includeStretch,
        overrides,
      }),
    [assessed, startDate, days, includeStretch, overrides],
  );

  // Fetch weather forecast when the planner opens for a coords-known
  // destination. Refetch if coords change (destination change from
  // parent). Same-session cache: doesn't refetch every open.
  useEffect(() => {
    if (!open || !coords) return;
    if (forecastState === "loading" || forecastState === "loaded") return;
    setForecastState("loading");
    const ctrl = new AbortController();
    fetchDailyForecast(coords.lat, coords.lng, ctrl.signal)
      .then((res) => {
        const map = new Map<string, DailyForecast>();
        for (const d of res.daily) map.set(d.date, d);
        setForecast(map);
        setForecastState("loaded");
      })
      .catch(() => {
        setForecastState("error");
      });
    return () => ctrl.abort();
  }, [open, coords, forecastState]);

  // Trim overrides for day indices beyond current `days` when user
  // shrinks the trip. Prevents stale keys from lingering.
  useEffect(() => {
    setOverrides((prev) => {
      const next: Overrides = {};
      let changed = false;
      for (const [key, val] of Object.entries(prev)) {
        const idx = Number(key);
        if (idx < days) next[idx] = val;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [days]);

  const setDayOverride = (dayIndex: number, slug: string) => {
    setOverrides((prev) => ({ ...prev, [dayIndex]: { kind: "slug", slug } }));
  };
  const setDayRest = (dayIndex: number) => {
    setOverrides((prev) => ({ ...prev, [dayIndex]: { kind: "rest" } }));
  };
  const clearDayOverride = (dayIndex: number) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[dayIndex];
      return next;
    });
  };
  const resetAllOverrides = () => setOverrides({});
  const hasOverrides = Object.keys(overrides).length > 0;

  const hikeEntries = itinerary.days
    .filter((d): d is Extract<typeof itinerary.days[number], { kind: "hike" }> =>
      d.kind === "hike",
    )
    .map((d) => ({ presetSlug: d.preset.slug, targetDate: d.dateYmd }));

  // Compact payload for the coach's advice call. Also used as the
  // fingerprint that determines whether cached narrative is still valid.
  const advicePayload = useMemo(() => {
    const totals = {
      hikes: itinerary.totalHikes,
      hours: itinerary.totalHours,
      verticalFt: itinerary.totalVerticalFt,
    };
    const coachDays = itinerary.days.map((d) => {
      if (d.kind === "hike") {
        return {
          kind: "hike" as const,
          dayIndex: d.dayIndex,
          dateYmd: d.dateYmd,
          trailName: d.preset.name,
          distanceKm: d.preset.distanceKm,
          elevationGainFt: d.preset.elevationGainFt,
          typicalHours: d.preset.typicalHours,
          terrainGrade: d.preset.terrainGrade,
          verdict: d.verdict,
        };
      }
      if (d.kind === "rest") {
        return {
          kind: "rest" as const,
          dayIndex: d.dayIndex,
          dateYmd: d.dateYmd,
          reason: d.reason,
        };
      }
      return {
        kind: "unfilled" as const,
        dayIndex: d.dayIndex,
        dateYmd: d.dateYmd,
      };
    });
    return {
      destination: destinationLabel,
      days,
      totals,
      itinerary: coachDays,
    };
  }, [itinerary, destinationLabel, days]);

  const currentShape = useMemo(
    () => JSON.stringify(advicePayload),
    [advicePayload],
  );
  const narrativeStale = narrative != null && narrativeShape !== currentShape;

  const fetchAdvice = () => {
    setNarrativeError(null);
    startNarrativeTransition(async () => {
      try {
        const res = await generateItineraryAdvice(advicePayload);
        if (!res.narrative) {
          setNarrativeError(
            "Couldn't generate advice right now — coach service may be down.",
          );
          return;
        }
        setNarrative(res.narrative);
        setNarrativeShape(currentShape);
      } catch (e) {
        setNarrativeError(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  // Auto-clear narrative saved state if user makes changes so the
  // narrative and daily notes don't misalign with what they see below.
  useEffect(() => {
    if (savedCount != null) setSavedCount(null);
  }, [currentShape]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAll = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await saveItineraryTrails({ entries: hikeEntries });
        setSavedCount(res.savedIds.length);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  };

  if (!open) {
    return (
      <section className="rounded-lg border border-blue-500/30 bg-blue-950/10 p-4 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-mono uppercase tracking-widest text-blue-400">
            [PLAN A TRIP]
          </div>
          <div className="text-sm font-medium mt-1">
            Multi-day itinerary for {destinationLabel} →
          </div>
          <div className="text-xs text-muted mt-0.5">
            Auto-sequences these trails across the days of your trip,
            inserting rest days when needed.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-blue-500/50 bg-blue-950/20 text-blue-300 text-sm font-medium px-3 py-1.5 whitespace-nowrap hover:border-blue-400 transition"
        >
          Plan →
        </button>
      </section>
    );
  }

  const numHikes = itinerary.totalHikes;
  const restDays = itinerary.days.filter((d) => d.kind === "rest").length;
  const unfilled = itinerary.days.filter((d) => d.kind === "unfilled").length;

  return (
    <section className="rounded-lg border border-blue-500/40 bg-blue-950/10 p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-blue-400">
            [TRIP ITINERARY]
          </div>
          <div className="text-sm text-muted mt-1">{destinationLabel}</div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted hover:text-foreground"
        >
          Close
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-muted">
            Arriving
          </span>
          <input
            type="date"
            value={startDate}
            min={todayLocalYmd()}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-md bg-panel border border-panel-border px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-muted">
            Days on the ground
          </span>
          <input
            type="number"
            min={1}
            max={14}
            value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(14, Number(e.target.value))))}
            className="w-full rounded-md bg-panel border border-panel-border px-3 py-2 text-sm tabular-nums"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={includeStretch}
          onChange={(e) => setIncludeStretch(e.target.checked)}
          className="w-4 h-4 accent-blue-500"
        />
        <span>Include hard/stretch trails</span>
        <span className="text-xs text-muted ml-1">
          (default is Ready + Achievable only)
        </span>
      </label>

      {coords && forecastState === "loaded" && (
        <div className="text-[10px] text-muted italic">
          Forecast for {coords.label} · via Open-Meteo · local time
        </div>
      )}
      {coords && forecastState === "error" && (
        <div className="text-[10px] text-warn">
          Couldn't load forecast — planner still works without it.
        </div>
      )}

      <div className="text-xs text-muted tabular-nums">
        <span className="text-foreground">{numHikes}</span> hike
        {numHikes === 1 ? "" : "s"}
        {restDays > 0 && (
          <>
            {" · "}
            <span className="text-foreground">{restDays}</span> rest day
            {restDays === 1 ? "" : "s"}
          </>
        )}
        {unfilled > 0 && (
          <>
            {" · "}
            <span className="text-warn">{unfilled}</span> unfilled
          </>
        )}
        {" · "}
        <span className="text-foreground">
          ~{itinerary.totalHours}h
        </span>
        {" · "}
        <span className="text-foreground">
          +{itinerary.totalVerticalFt.toLocaleString()} ft
        </span>
      </div>

      <div className="space-y-2">
        {itinerary.days.map((day, i) => {
          const currentSlug =
            day.kind === "hike" ? day.preset.slug : null;
          // Trails available for THIS day's swap: everything in the pool
          // except trails already placed elsewhere in the itinerary.
          const inItinerarySlugs = new Set(
            itinerary.days
              .filter((d): d is Extract<typeof itinerary.days[number], { kind: "hike" }> =>
                d.kind === "hike",
              )
              .filter((d) => d.dayIndex !== day.dayIndex)
              .map((d) => d.preset.slug),
          );
          const availableForSwap = presets.filter(
            (p) => !inItinerarySlugs.has(p.slug),
          );
          return (
            <DayCard
              key={day.dayIndex}
              day={day}
              coachNote={
                narrative && !narrativeStale ? narrative.perDay[i] : undefined
              }
              overridden={overrides[day.dayIndex] != null}
              availableForSwap={availableForSwap}
              currentSlug={currentSlug}
              onSwap={(slug) => setDayOverride(day.dayIndex, slug)}
              onRest={() => setDayRest(day.dayIndex)}
              onRevert={() => clearDayOverride(day.dayIndex)}
              weather={forecast?.get(day.dateYmd) ?? null}
              weatherLoading={forecastState === "loading"}
            />
          );
        })}
      </div>
      {hasOverrides && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={resetAllOverrides}
            className="text-[11px] text-muted hover:text-foreground transition"
          >
            ↺ Reset all to auto
          </button>
        </div>
      )}

      {numHikes > 0 && (
        <div className="rounded-md border border-blue-500/40 bg-blue-950/10 p-4 space-y-2">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
              [COACH'S TAKE]
              {narrative && narrativeStale && (
                <span className="ml-2 text-warn normal-case tracking-normal">
                  (out of date — refresh)
                </span>
              )}
            </div>
            {(!narrative || narrativeStale) && (
              <button
                type="button"
                onClick={fetchAdvice}
                disabled={narrativePending}
                className="rounded-md border border-blue-500/40 bg-blue-950/20 text-blue-300 text-xs font-medium px-3 py-1.5 hover:border-blue-400 transition disabled:opacity-50"
              >
                {narrativePending
                  ? "Thinking…"
                  : narrative
                    ? "Refresh advice →"
                    : "Get coach's take →"}
              </button>
            )}
          </div>

          {narrative ? (
            <div className={narrativeStale ? "opacity-60" : ""}>
              <h4 className="text-sm font-medium">{narrative.headline}</h4>
              <p className="text-sm text-foreground/85 mt-1 leading-relaxed">
                {narrative.summary}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted italic">
              Ask the coach why this order works for your fitness, and
              what to focus on each day.
            </p>
          )}

          {narrativeError && (
            <p className="text-xs text-danger">{narrativeError}</p>
          )}
        </div>
      )}

      {numHikes === 0 ? (
        <p className="text-xs text-muted italic">
          No recommended trails yet. Try enabling stretch trails, or check a
          different destination.
        </p>
      ) : savedCount != null ? (
        <div className="rounded-md border border-accent/40 bg-accent-strong/5 p-3 flex items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-accent font-mono">✓</span>{" "}
            <span className="font-medium">
              Saved {savedCount} trail{savedCount === 1 ? "" : "s"}
            </span>
            <span className="text-muted"> with target dates.</span>
          </div>
          <Link
            href="/trails"
            className="text-xs text-blue-300 hover:underline whitespace-nowrap"
          >
            Open trails →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={saveAll}
            disabled={pending}
            className="w-full rounded-md bg-accent-strong text-background font-medium px-4 py-3 hover:bg-accent transition disabled:opacity-50"
          >
            {pending
              ? "Saving…"
              : `Save all ${numHikes} hike${numHikes === 1 ? "" : "s"} with dates →`}
          </button>
          <p className="text-[11px] text-muted text-center">
            Saved trails will show up under Your trails and trigger trip-week
            emails as their dates approach.
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function DayCard({
  day,
  coachNote,
  overridden = false,
  availableForSwap,
  currentSlug,
  onSwap,
  onRest,
  onRevert,
  weather,
  weatherLoading,
}: {
  day: ReturnType<typeof buildItinerary>["days"][number];
  coachNote?: string;
  overridden?: boolean;
  availableForSwap: ItineraryPresetInput[];
  currentSlug: string | null;
  onSwap: (slug: string) => void;
  onRest: () => void;
  onRevert: () => void;
  weather: DailyForecast | null;
  weatherLoading: boolean;
}) {
  const dayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(day.dateYmd + "T12:00:00Z"));

  const actions = (
    <DayActions
      day={day}
      overridden={overridden}
      availableForSwap={availableForSwap}
      currentSlug={currentSlug}
      onSwap={onSwap}
      onRest={onRest}
      onRevert={onRevert}
    />
  );

  const weatherRow = (
    <WeatherRow weather={weather} weatherLoading={weatherLoading} />
  );

  if (day.kind === "rest") {
    return (
      <div className="rounded-md border border-panel-border bg-panel/40 px-4 py-3 space-y-1">
        <div className="flex items-baseline gap-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted w-14">
            Day {day.dayIndex + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">
              Rest day
              {overridden && <CustomBadge />}
            </div>
            <div className="text-xs text-muted">{day.reason}</div>
          </div>
          <div className="text-[10px] text-muted whitespace-nowrap">
            {dayLabel}
          </div>
        </div>
        {weatherRow}
        {coachNote && <CoachNote text={coachNote} />}
        {actions}
      </div>
    );
  }

  if (day.kind === "unfilled") {
    return (
      <div className="rounded-md border border-dashed border-panel-border bg-panel/20 px-4 py-3 space-y-1">
        <div className="flex items-baseline gap-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted w-14">
            Day {day.dayIndex + 1}
          </div>
          <div className="flex-1 text-xs text-muted italic">
            No suitable trail left in the pool. Free time or repeat a
            favorite.
          </div>
          <div className="text-[10px] text-muted whitespace-nowrap">
            {dayLabel}
          </div>
        </div>
        {weatherRow}
        {coachNote && <CoachNote text={coachNote} />}
        {actions}
      </div>
    );
  }

  // hike
  return (
    <div
      className={`rounded-md border px-4 py-3 space-y-1 ${VERDICT_TONE[day.verdict] ?? "border-panel-border bg-panel"}`}
    >
      <div className="flex items-baseline gap-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted w-14">
          Day {day.dayIndex + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">
              {day.preset.name}
            </span>
            <span
              className={`text-[10px] font-mono uppercase tracking-wider whitespace-nowrap ${VERDICT_COLOR[day.verdict]}`}
            >
              {VERDICT_LABEL[day.verdict]}
            </span>
            {overridden && <CustomBadge />}
          </div>
          <div className="text-xs text-muted mt-0.5">
            {day.preset.distanceKm} km · +
            {day.preset.elevationGainFt.toLocaleString()} ft · ~
            {day.preset.typicalHours}h
          </div>
        </div>
        <div className="text-[10px] text-muted whitespace-nowrap tabular-nums">
          {dayLabel}
        </div>
      </div>
      {weatherRow}
      {coachNote && <CoachNote text={coachNote} />}
      {actions}
    </div>
  );
}

function DayActions({
  day,
  overridden,
  availableForSwap,
  currentSlug,
  onSwap,
  onRest,
  onRevert,
}: {
  day: ReturnType<typeof buildItinerary>["days"][number];
  overridden: boolean;
  availableForSwap: ItineraryPresetInput[];
  currentSlug: string | null;
  onSwap: (slug: string) => void;
  onRest: () => void;
  onRevert: () => void;
}) {
  const [showSwap, setShowSwap] = useState(false);

  const isHike = day.kind === "hike";
  const isRest = day.kind === "rest";
  const isUnfilled = day.kind === "unfilled";

  // If there's nothing to pick from and no override to clear, hide actions
  // entirely to keep the card quiet.
  if (availableForSwap.length === 0 && !overridden) {
    return null;
  }

  return (
    <div className="pl-[calc(3.5rem+0.75rem)] pt-1.5">
      {showSwap ? (
        <div className="rounded border border-panel-border bg-background/40 p-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-muted">
              {isHike ? "Swap for" : "Add hike"}
            </span>
            <button
              type="button"
              onClick={() => setShowSwap(false)}
              className="text-[10px] text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          <select
            defaultValue=""
            onChange={(e) => {
              const slug = e.target.value;
              if (!slug) return;
              onSwap(slug);
              setShowSwap(false);
            }}
            className="w-full rounded bg-panel border border-panel-border px-2 py-1.5 text-xs"
          >
            <option value="" disabled>
              Pick a trail…
            </option>
            {availableForSwap
              .slice()
              .sort((a, b) => {
                const vp = verdictOrder(a.verdict) - verdictOrder(b.verdict);
                return vp !== 0 ? vp : a.typicalHours - b.typicalHours;
              })
              .map((p) => (
                <option
                  key={p.slug}
                  value={p.slug}
                  disabled={p.slug === currentSlug}
                >
                  {VERDICT_LABEL[p.verdict]} · {p.name} ·{" "}
                  {p.typicalHours}h ·{" "}
                  {p.elevationGainFt.toLocaleString()} ft
                  {p.slug === currentSlug ? " (current)" : ""}
                </option>
              ))}
          </select>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-[11px]">
          {(isHike || isRest || isUnfilled) &&
            availableForSwap.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSwap(true)}
                className="text-blue-300 hover:text-blue-200 transition"
              >
                {isHike ? "↔ Swap" : "+ Add hike"}
              </button>
            )}
          {isHike && (
            <button
              type="button"
              onClick={onRest}
              className="text-muted hover:text-foreground transition"
            >
              🛌 Rest instead
            </button>
          )}
          {overridden && (
            <button
              type="button"
              onClick={onRevert}
              className="text-muted hover:text-foreground transition ml-auto"
            >
              ↺ Revert to auto
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function verdictOrder(v: Verdict): number {
  return v === "comfortable"
    ? 0
    : v === "achievable"
      ? 1
      : v === "hard"
        ? 2
        : 3;
}

function CustomBadge() {
  return (
    <span className="text-[9px] font-mono uppercase tracking-wider text-blue-300 bg-blue-950/30 border border-blue-500/40 rounded px-1.5 py-0.5">
      custom
    </span>
  );
}

function CoachNote({ text }: { text: string }) {
  return (
    <div className="pl-[calc(3.5rem+0.75rem)] pt-0.5 flex items-start gap-1.5 text-xs text-blue-300/90 italic">
      <span className="text-blue-400 shrink-0">▸</span>
      <span>{text}</span>
    </div>
  );
}

function WeatherRow({
  weather,
  weatherLoading,
}: {
  weather: DailyForecast | null;
  weatherLoading: boolean;
}) {
  if (weatherLoading) {
    return (
      <div className="pl-[calc(3.5rem+0.75rem)] pt-0.5 text-[11px] text-muted">
        Loading forecast…
      </div>
    );
  }
  if (!weather) return null;
  const { glyph, label } = interpretWeatherCode(weather.weatherCode);
  const rainSignal = weather.precipProbabilityPct >= 40;
  const windSignal = weather.windMaxMph >= 20;
  return (
    <div className="pl-[calc(3.5rem+0.75rem)] pt-0.5 text-[11px] text-muted flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="text-blue-300">
        {glyph} {label}
      </span>
      <span>·</span>
      <span className="tabular-nums">
        {weather.tempMinF}–{weather.tempMaxF}°F
      </span>
      {(rainSignal || weather.precipInches > 0.05) && (
        <>
          <span>·</span>
          <span
            className={
              rainSignal ? "text-warn tabular-nums" : "tabular-nums"
            }
          >
            {weather.precipProbabilityPct}% precip
            {weather.precipInches >= 0.1 &&
              ` (${weather.precipInches.toFixed(2)}″)`}
          </span>
        </>
      )}
      {windSignal && (
        <>
          <span>·</span>
          <span className="text-warn tabular-nums">
            {weather.windMaxMph} mph wind
          </span>
        </>
      )}
    </div>
  );
}

// Rehydrate the compact wire shape back to a shape compatible with the
// sequencer's `TrailPreset` reader. We only touch the fields the sequencer
// actually reads.
function presetShape(p: ItineraryPresetInput): TrailPreset {
  return {
    slug: p.slug,
    name: p.name,
    region: p.region,
    country: "",
    distanceKm: p.distanceKm,
    elevationGainFt: p.elevationGainFt,
    maxAltitudeFt: p.maxAltitudeFt,
    typicalHours: p.typicalHours,
    packWeightLb: p.packWeightLb,
    terrainGrade: p.terrainGrade as TrailPreset["terrainGrade"],
    notes: "",
    sources: [],
  };
}
