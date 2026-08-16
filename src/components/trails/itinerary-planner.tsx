"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveItineraryTrails } from "@/lib/actions";
import {
  buildItinerary,
  type AssessedPreset,
  type Verdict,
} from "@/lib/basecamp/itinerary";
import type { TrailPreset } from "@/lib/basecamp/trail-library";

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
}: {
  presets: ItineraryPresetInput[];
  destinationLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(3);
  const [startDate, setStartDate] = useState(todayLocalYmd());
  const [includeStretch, setIncludeStretch] = useState(false);
  const [pending, startTransition] = useTransition();
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      }),
    [assessed, startDate, days, includeStretch],
  );

  const hikeEntries = itinerary.days
    .filter((d): d is Extract<typeof itinerary.days[number], { kind: "hike" }> =>
      d.kind === "hike",
    )
    .map((d) => ({ presetSlug: d.preset.slug, targetDate: d.dateYmd }));

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
        {itinerary.days.map((day) => (
          <DayCard key={day.dayIndex} day={day} />
        ))}
      </div>

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
}: {
  day: ReturnType<typeof buildItinerary>["days"][number];
}) {
  const dayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(day.dateYmd + "T12:00:00Z"));

  if (day.kind === "rest") {
    return (
      <div className="rounded-md border border-panel-border bg-panel/40 px-4 py-3 flex items-baseline gap-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted w-14">
          Day {day.dayIndex + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Rest day</div>
          <div className="text-xs text-muted">{day.reason}</div>
        </div>
        <div className="text-[10px] text-muted whitespace-nowrap">
          {dayLabel}
        </div>
      </div>
    );
  }

  if (day.kind === "unfilled") {
    return (
      <div className="rounded-md border border-dashed border-panel-border bg-panel/20 px-4 py-3 flex items-baseline gap-3">
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
    );
  }

  // hike
  return (
    <div
      className={`rounded-md border px-4 py-3 flex items-baseline gap-3 ${VERDICT_TONE[day.verdict] ?? "border-panel-border bg-panel"}`}
    >
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
