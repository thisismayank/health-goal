"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { TrailPreset } from "@/lib/basecamp/trail-library";

type Difficulty = "any" | "easy" | "moderate" | "hard" | "technical" | "mountaineering";
type Duration = "any" | "short" | "day" | "long" | "epic";

const DURATION_LABEL: Record<Duration, string> = {
  any: "Any duration",
  short: "≤ 3 h",
  day: "3–6 h",
  long: "6–10 h",
  epic: "10+ h",
};

function matchesDuration(hours: number, filter: Duration): boolean {
  if (filter === "any") return true;
  if (filter === "short") return hours <= 3;
  if (filter === "day") return hours > 3 && hours <= 6;
  if (filter === "long") return hours > 6 && hours <= 10;
  return hours > 10;
}

export function LibrarySearch({ trails }: { trails: TrailPreset[] }) {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("any");
  const [duration, setDuration] = useState<Duration>("any");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    return trails.filter((t) => {
      if (difficulty !== "any" && t.terrainGrade !== difficulty) return false;
      if (!matchesDuration(t.typicalHours, duration)) return false;
      if (words.length === 0) return true;
      const hay = `${t.name} ${t.region} ${t.country}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [trails, query, difficulty, duration]);

  const grouped = useMemo(() => {
    const byRegion = new Map<string, TrailPreset[]>();
    for (const t of filtered) {
      const arr = byRegion.get(t.region) ?? [];
      arr.push(t);
      byRegion.set(t.region, arr);
    }
    return [...byRegion.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="space-y-2 sticky top-0 z-10 bg-background/95 backdrop-blur pt-1 pb-2 -mx-1 px-1">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search trail, region, country…"
          className="w-full rounded-md bg-panel border border-panel-border px-3 py-2.5 text-base placeholder:text-muted focus:border-blue-500/50 focus:outline-none"
        />

        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            active={difficulty === "any"}
            onClick={() => setDifficulty("any")}
          >
            All terrain
          </FilterChip>
          {(["easy", "moderate", "hard", "technical", "mountaineering"] as const).map(
            (d) => (
              <FilterChip
                key={d}
                active={difficulty === d}
                onClick={() => setDifficulty(d)}
              >
                {d}
              </FilterChip>
            ),
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(DURATION_LABEL) as Duration[]).map((d) => (
            <FilterChip
              key={d}
              active={duration === d}
              onClick={() => setDuration(d)}
            >
              {DURATION_LABEL[d]}
            </FilterChip>
          ))}
        </div>

        <div className="text-[11px] text-muted">
          {filtered.length} of {trails.length} · across {grouped.length}{" "}
          region{grouped.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="space-y-5">
        {grouped.length === 0 ? (
          <p className="text-sm text-muted">
            No trails match. Loosen the filters or search a broader term.
          </p>
        ) : (
          grouped.map(([region, list]) => (
            <section key={region} className="space-y-1.5">
              <h4 className="text-xs uppercase tracking-widest text-muted">
                {region}
              </h4>
              <div className="space-y-1">
                {list.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/trails/preset/${t.slug}`}
                    className="block rounded-md border border-panel-border bg-panel px-3 py-2 hover:border-blue-500/40 transition"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="font-medium text-sm truncate">
                        {t.name}
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted whitespace-nowrap">
                        {t.terrainGrade}
                      </div>
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {t.distanceKm} km · +
                      {t.elevationGainFt.toLocaleString()} ft · ~
                      {t.typicalHours}h
                      {t.packWeightLb > 0 && ` · ${t.packWeightLb} lb`}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] px-2.5 py-1 rounded-full border transition whitespace-nowrap ${
        active
          ? "bg-blue-500/20 text-blue-200 border-blue-500/40"
          : "text-muted border-panel-border hover:text-foreground hover:border-blue-500/30"
      }`}
    >
      {children}
    </button>
  );
}
