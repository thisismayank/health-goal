/**
 * Free-tier geocoder for user home-base setup.
 *
 * Uses Nominatim (OSM). No API key. Rate-limited to 1 req/sec per
 * their fair-use policy — for our use case (one call when a user
 * types their city into settings) that's fine.
 *
 * Never call this on a hot path. Cache the result to user_profile
 * columns instead.
 */

const UA = "BasecampApp/0.1 (rainier-companion; contact via app support)";

export type GeocodeResult = {
  lat: number;
  lng: number;
  label: string; // human-readable place name from the geocoder
};

export async function geocode(query: string): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;

  // Accept "lat, lng" pasted verbatim (common when users grab coords
  // from Google Maps). Skip the network call in that case.
  const paste = q.match(
    /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/,
  );
  if (paste) {
    const lat = Number(paste[1]);
    const lng = Number(paste[2]);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    ) {
      return { lat, lng, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
    }
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  try {
    const res = await fetch(url.toString(), {
      headers: { "user-agent": UA, accept: "application/json" },
      // Nominatim recommends caching; we're one-shot per user setup.
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    if (!rows[0]) return null;
    const lat = Number(rows[0].lat);
    const lng = Number(rows[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, label: rows[0].display_name };
  } catch (e) {
    console.warn("[geocode] failed:", e);
    return null;
  }
}
