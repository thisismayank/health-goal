"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTrailFromPreset } from "@/lib/actions";
import { TRAIL_LIBRARY, type TrailPreset } from "@/lib/basecamp/trail-library";

const REGIONS = Array.from(new Set(TRAIL_LIBRARY.map((t) => t.region))).sort();

export function TrailSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [_pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  const onSelect = (preset: TrailPreset) => {
    setError(null);
    setPendingSlug(preset.slug);
    startTransition(async () => {
      try {
        const result = await createTrailFromPreset(preset.slug);
        router.push(`/trails/${result.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add trail");
        setPendingSlug(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${TRAIL_LIBRARY.length} preset trails (name, region, country)…`}
          className="w-full rounded-md bg-panel border border-panel-border px-3 py-2"
          autoFocus
        />
        <div className="text-xs text-muted">
          {results.length} of {TRAIL_LIBRARY.length} · covering{" "}
          {REGIONS.length} regions
        </div>
      </div>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
        {grouped.length === 0 ? (
          <p className="text-sm text-muted">
            No matches. Add a custom trail below.
          </p>
        ) : (
          grouped.map(([region, trails]) => (
            <section key={region} className="space-y-2">
              <h4 className="text-xs uppercase tracking-widest text-muted">
                {region}
              </h4>
              <div className="space-y-1">
                {trails.map((t) => (
                  <button
                    key={t.slug}
                    type="button"
                    onClick={() => onSelect(t)}
                    disabled={pendingSlug !== null}
                    className={`w-full text-left rounded-md border border-panel-border bg-panel px-3 py-2 hover:border-blue-500/40 transition disabled:opacity-50 ${
                      pendingSlug === t.slug ? "border-blue-500/60" : ""
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="font-medium text-sm truncate">
                        {t.name}
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted whitespace-nowrap">
                        {pendingSlug === t.slug ? "adding…" : t.terrainGrade}
                      </div>
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {t.distanceKm} km · {t.elevationGainFt.toLocaleString()} ft
                      · max {t.maxAltitudeFt.toLocaleString()} ft · ~
                      {t.typicalHours}h
                      {t.packWeightLb > 0 && ` · ${t.packWeightLb} lb pack`}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
