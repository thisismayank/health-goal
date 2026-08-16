"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTrail } from "@/lib/actions";
import type { TrailTerrainGrade } from "@/db/schema";

const TERRAIN_OPTIONS: { value: TrailTerrainGrade; label: string }[] = [
  { value: "easy", label: "Easy — well-maintained trail" },
  { value: "moderate", label: "Moderate — some steep sections" },
  { value: "hard", label: "Hard — sustained climbing, exposure" },
  { value: "technical", label: "Technical — scrambling / class 3+" },
  { value: "mountaineering", label: "Mountaineering — rope, snow, crampons" },
];

const PRESETS: Array<{ label: string; values: Record<string, string> }> = [
  {
    label: "Skyline Trail (Rainier NP, Paradise loop)",
    values: {
      name: "Skyline Trail — Paradise Loop",
      distanceKm: "8.8",
      elevationGainFt: "1700",
      maxAltitudeFt: "6800",
      typicalHours: "3.5",
      packWeightLb: "12",
      terrainGrade: "moderate",
    },
  },
  {
    label: "Burroughs Mountain (Rainier NP, 3rd Burroughs)",
    values: {
      name: "3rd Burroughs — Sunrise",
      distanceKm: "15",
      elevationGainFt: "2600",
      maxAltitudeFt: "7800",
      typicalHours: "6",
      packWeightLb: "15",
      terrainGrade: "hard",
    },
  },
  {
    label: "Mount Whitney (day hike)",
    values: {
      name: "Mount Whitney Trail",
      distanceKm: "35",
      elevationGainFt: "6100",
      maxAltitudeFt: "14505",
      typicalHours: "14",
      packWeightLb: "20",
      terrainGrade: "hard",
    },
  },
];

export function TrailForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState({
    name: "",
    url: "",
    distanceKm: "",
    elevationGainFt: "",
    maxAltitudeFt: "",
    typicalHours: "",
    packWeightLb: "",
    terrainGrade: "moderate",
    targetDate: "",
    notes: "",
  });

  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  const applyPreset = (idx: number) => {
    const preset = PRESETS[idx];
    setValues((prev) => ({
      ...prev,
      ...preset.values,
    }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const distanceKm = Number(values.distanceKm);
    const elevationGainFt = Number(values.elevationGainFt);
    const maxAltitudeFt = Number(values.maxAltitudeFt);
    const typicalHours = Number(values.typicalHours);
    const packWeightLb = values.packWeightLb === "" ? 0 : Number(values.packWeightLb);

    if (!values.name.trim()) return setError("Name required.");
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) return setError("Distance must be positive.");
    if (!Number.isFinite(elevationGainFt) || elevationGainFt < 0) return setError("Elevation gain must be non-negative.");
    if (!Number.isFinite(maxAltitudeFt) || maxAltitudeFt < 0) return setError("Max altitude must be non-negative.");
    if (!Number.isFinite(typicalHours) || typicalHours <= 0) return setError("Typical hours must be positive.");
    if (!Number.isFinite(packWeightLb) || packWeightLb < 0) return setError("Pack weight must be non-negative.");

    startTransition(async () => {
      try {
        const result = await createTrail({
          name: values.name.trim(),
          url: values.url.trim() || undefined,
          distanceKm,
          elevationGainFt,
          maxAltitudeFt,
          typicalHours,
          packWeightLb,
          terrainGrade: values.terrainGrade as TrailTerrainGrade,
          targetDate: values.targetDate || undefined,
          notes: values.notes.trim() || undefined,
        });
        router.push(`/trails/${result.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save trail");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-md border border-panel-border bg-panel p-3">
        <div className="text-xs uppercase tracking-widest text-muted mb-2">
          Or start from a preset
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(i)}
              className="text-xs rounded border border-panel-border hover:border-blue-500/50 px-2 py-1 text-muted hover:text-blue-300"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <Field label="Trail name">
        <input
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          className="w-full rounded-md bg-panel border border-panel-border px-3 py-2"
          placeholder="e.g. Skyline Trail — Paradise Loop"
        />
      </Field>

      <Field label="AllTrails / URL (optional)">
        <input
          value={values.url}
          onChange={(e) => set("url", e.target.value)}
          className="w-full rounded-md bg-panel border border-panel-border px-3 py-2"
          placeholder="https://…"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Distance (km)">
          <input
            type="number"
            step="0.1"
            value={values.distanceKm}
            onChange={(e) => set("distanceKm", e.target.value)}
            className="w-full rounded-md bg-panel border border-panel-border px-3 py-2"
          />
        </Field>
        <Field label="Elevation gain (ft)">
          <input
            type="number"
            value={values.elevationGainFt}
            onChange={(e) => set("elevationGainFt", e.target.value)}
            className="w-full rounded-md bg-panel border border-panel-border px-3 py-2"
          />
        </Field>
        <Field label="Max altitude (ft)">
          <input
            type="number"
            value={values.maxAltitudeFt}
            onChange={(e) => set("maxAltitudeFt", e.target.value)}
            className="w-full rounded-md bg-panel border border-panel-border px-3 py-2"
          />
        </Field>
        <Field label="Typical hours">
          <input
            type="number"
            step="0.5"
            value={values.typicalHours}
            onChange={(e) => set("typicalHours", e.target.value)}
            className="w-full rounded-md bg-panel border border-panel-border px-3 py-2"
          />
        </Field>
        <Field label="Pack weight (lb)">
          <input
            type="number"
            step="0.5"
            value={values.packWeightLb}
            onChange={(e) => set("packWeightLb", e.target.value)}
            placeholder="0 for day pack"
            className="w-full rounded-md bg-panel border border-panel-border px-3 py-2"
          />
        </Field>
        <Field label="Target date (optional)">
          <input
            type="date"
            value={values.targetDate}
            onChange={(e) => set("targetDate", e.target.value)}
            className="w-full rounded-md bg-panel border border-panel-border px-3 py-2"
          />
        </Field>
      </div>

      <Field label="Terrain grade">
        <select
          value={values.terrainGrade}
          onChange={(e) => set("terrainGrade", e.target.value)}
          className="w-full rounded-md bg-panel border border-panel-border px-3 py-2"
        >
          {TERRAIN_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Notes (optional)">
        <textarea
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={2}
          className="w-full rounded-md bg-panel border border-panel-border px-3 py-2"
        />
      </Field>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent-strong hover:bg-accent text-background font-medium px-4 py-2 disabled:opacity-50"
        >
          {pending ? "Assessing…" : "Assess readiness"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}
