/**
 * Popular hiking destinations shown as one-tap chips on /trails/discover.
 * Each label is a search query that fuzzy-matches trail.region /
 * trail.name; results are just the same search flow, prefilled.
 *
 * Coords (lat/lng) are used by the trip-itinerary planner to fetch a
 * weather forecast from Open-Meteo. Coords are approximate — a single
 * point per destination, not per trail — enough for a directional
 * forecast for the trip window.
 */

export type Destination = {
  label: string;
  query: string;
  hint?: string;
  lat?: number;
  lng?: number;
};

export const POPULAR_DESTINATIONS: Destination[] = [
  { label: "Rainier NP", query: "Rainier NP", hint: "Cascades · WA", lat: 46.879, lng: -121.727 },
  { label: "Zion NP", query: "Zion NP", hint: "Utah", lat: 37.298, lng: -113.026 },
  { label: "Yosemite NP", query: "Yosemite NP", hint: "Sierra Nevada · CA", lat: 37.865, lng: -119.538 },
  { label: "Grand Canyon NP", query: "Grand Canyon NP", hint: "Arizona", lat: 36.107, lng: -112.113 },
  { label: "Rocky Mtn NP", query: "Rocky Mtn NP", hint: "Colorado", lat: 40.343, lng: -105.688 },
  { label: "Glacier NP", query: "Glacier NP", hint: "Montana", lat: 48.696, lng: -113.718 },
  { label: "Acadia NP", query: "Acadia NP", hint: "Maine", lat: 44.339, lng: -68.273 },
  { label: "Colorado 14ers", query: "CO", hint: "Front Range + Sawatch + Tenmile", lat: 39.118, lng: -106.446 },
  { label: "PNW day hikes", query: "Cascades · WA", hint: "Mailbox, Mt Si, Colchuck", lat: 47.478, lng: -121.741 },
  { label: "White Mtns", query: "White Mtns", hint: "New Hampshire", lat: 44.271, lng: -71.303 },
  { label: "The Alps", query: "Alps", hint: "France · Italy · Germany", lat: 45.833, lng: 6.865 },
  { label: "UK peaks", query: "England", hint: "Snowdon · Scafell · Helvellyn", lat: 54.454, lng: -3.089 },
  { label: "Nepal treks", query: "Nepal", hint: "Everest · Annapurna · Langtang", lat: 27.988, lng: 86.925 },
  { label: "India Himalaya", query: "India", hint: "Roopkund · Valley of Flowers", lat: 30.383, lng: 79.482 },
  { label: "Africa", query: "Kenya", hint: "Kilimanjaro · Meru · Mt Kenya", lat: -3.075, lng: 37.353 },
  { label: "Patagonia", query: "Patagonia", hint: "Torres del Paine · Fitz Roy", lat: -50.937, lng: -73.407 },
  { label: "NZ great walks", query: "New Zealand", hint: "Tongariro · Milford · Mueller", lat: -39.298, lng: 175.632 },
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Given a user's search query, return coords + label for the best-matching
 * destination — used by the itinerary planner to fetch weather. Null if
 * the query doesn't confidently match a known place.
 */
export function coordsForQuery(query: string): {
  lat: number;
  lng: number;
  label: string;
} | null {
  const nq = normalize(query);
  if (!nq) return null;
  // Prefer exact/substring match on the query field. Longest match wins so
  // 'Rainier NP' beats 'PNW' when the user types 'Rainier'.
  const candidates = POPULAR_DESTINATIONS.filter(
    (d) =>
      d.lat != null &&
      d.lng != null &&
      (nq.includes(normalize(d.query)) || normalize(d.query).includes(nq)),
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.query.length - a.query.length);
  const best = candidates[0];
  return { lat: best.lat!, lng: best.lng!, label: best.label };
}
