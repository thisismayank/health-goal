/**
 * Unit rendering helpers. Storage stays canonical (SI throughout the
 * DB); this module handles the imperial/metric split at the render
 * boundary only. Never do the conversion twice.
 *
 * Rule: if a caller has a Value + Unit tuple to render, use one of
 * these. If it's a magic literal ('5 lb'), it's fine to hardcode.
 */

export type Units = "imperial" | "metric";

// ---- Distance ----

export function formatDistance(
  meters: number | null | undefined,
  units: Units,
): string {
  if (meters == null) return "—";
  if (units === "metric") {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(meters < 10_000 ? 2 : 1)} km`;
  }
  const miles = meters / 1609.344;
  return `${miles.toFixed(miles < 10 ? 2 : 1)} mi`;
}

// ---- Elevation ----

export function formatElevation(
  meters: number | null | undefined,
  units: Units,
): string {
  if (meters == null) return "—";
  if (units === "metric") return `${Math.round(meters).toLocaleString()} m`;
  const feet = meters * 3.28084;
  return `${Math.round(feet).toLocaleString()} ft`;
}

// ---- Pack weight (usually already in lb in the domain) ----

export function formatPackLb(
  lb: number | null | undefined,
  units: Units,
): string {
  if (lb == null || lb === 0) return "—";
  if (units === "metric") {
    const kg = lb / 2.2046;
    return `${kg.toFixed(kg < 10 ? 1 : 0)} kg`;
  }
  return `${lb} lb`;
}

// ---- Body weight (already in kg) ----

export function formatBodyWeightKg(
  kg: number | null | undefined,
  units: Units,
): string {
  if (kg == null || kg === 0) return "—";
  if (units === "metric") return `${kg.toFixed(1)} kg`;
  const lb = kg * 2.2046;
  return `${lb.toFixed(1)} lb`;
}

// ---- Preset-native inputs (trail library stores km + ft directly) ----
// Prefer these when you already have km / ft and want the user's
// display preference applied — cheaper than round-tripping through
// meters and back.

export function formatKm(km: number | null | undefined, units: Units): string {
  if (km == null) return "—";
  if (units === "metric") return `${km.toFixed(km < 10 ? 1 : 0)} km`;
  const miles = km * 0.6213712;
  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

export function formatFt(ft: number | null | undefined, units: Units): string {
  if (ft == null) return "—";
  if (units === "metric") {
    const m = ft * 0.3048;
    return `${Math.round(m).toLocaleString()} m`;
  }
  return `${Math.round(ft).toLocaleString()} ft`;
}

// ---- Convenience: pull user's units off the profile ----

export function pickUnits(
  profile: { units?: string | null } | null | undefined,
): Units {
  return profile?.units === "metric" ? "metric" : "imperial";
}
