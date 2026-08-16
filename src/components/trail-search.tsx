"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TRAIL_LIBRARY, type TrailPreset } from "@/lib/basecamp/trail-library";

const REGIONS = Array.from(new Set(TRAIL_LIBRARY.map((t) => t.region))).sort();

export function TrailSearch() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TRAIL_LIBRARY;
    const words = q.split(/\s+/).filter(Boolean);
    return TRAIL_LIBRARY.filter((t) => {
      const hay = `${t.name} ${t.region} ${t.country}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [query]);

  const grouped = useMemo(() => {
    const byRegion = new Map<string, TrailPreset[]>();
    for (const t of results) {
      const arr = byRegion.get(t.region) ?? [];
      arr.push(t);
      byRegion.set(t.region, arr);
    }
    return [...byRegion.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [results]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any trail — name, region, country…"
          className="w-full rounded-md bg-panel border border-panel-border px-3 py-2.5 text-base placeholder:text-muted focus:border-blue-500/50 focus:outline-none"
          autoFocus
        />
        <div className="text-xs text-muted">
          {results.length} of {TRAIL_LIBRARY.length} · across {REGIONS.length}{" "}
          regions
        </div>
      </div>

      <div className="space-y-4 max-h-[540px] overflow-y-auto pr-1">
        {grouped.length === 0 ? (
          <p className="text-sm text-muted">
            No matches. Try a different search or add a custom trail below.
          </p>
        ) : (
          grouped.map(([region, trails]) => (
            <section key={region} className="space-y-1.5">
              <h4 className="text-xs uppercase tracking-widest text-muted sticky top-0 bg-background/95 backdrop-blur py-1">
                {region}
              </h4>
              <div className="space-y-1">
                {trails.map((t) => (
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
                      {t.elevationGainFt.toLocaleString()} ft · max{" "}
                      {t.maxAltitudeFt.toLocaleString()} ft · ~{t.typicalHours}h
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
