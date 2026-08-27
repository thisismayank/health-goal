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
  // Hero photo for the destination card on /trails/discover. Sourced
  // from Wikipedia Commons (CC BY-SA) — see the same content-pass
  // pattern used for trail photos in trail-details.ts. Missing →
  // TrailPhoto renders a topo fallback tinted by proximity to a
  // default terrain grade.
  photoUrl?: string;
  photoAttribution?: string;
};

const WIKI = "https://upload.wikimedia.org/wikipedia/commons/thumb";

export const POPULAR_DESTINATIONS: Destination[] = [
  {
    label: "Rainier NP",
    query: "Rainier NP",
    hint: "Cascades · WA",
    lat: 46.879,
    lng: -121.727,
    photoUrl: `${WIKI}/f/f9/Rainier20200906.jpg/500px-Rainier20200906.jpg`,
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  {
    label: "Zion NP",
    query: "Zion NP",
    hint: "Utah",
    lat: 37.298,
    lng: -113.026,
    photoUrl: `${WIKI}/1/10/Zion_angels_landing_view.jpg/500px-Zion_angels_landing_view.jpg`,
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  {
    label: "Yosemite NP",
    query: "Yosemite NP",
    hint: "Sierra Nevada · CA",
    lat: 37.865,
    lng: -119.538,
    photoUrl: `${WIKI}/e/ea/Half_Dome_with_Eastern_Yosemite_Valley_%2850MP%29.jpg/500px-Half_Dome_with_Eastern_Yosemite_Valley_%2850MP%29.jpg`,
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  {
    label: "Grand Canyon NP",
    query: "Grand Canyon NP",
    hint: "Arizona",
    lat: 36.107,
    lng: -112.113,
    photoUrl: `${WIKI}/a/aa/Dawn_on_the_S_rim_of_the_Grand_Canyon_%288645178272%29.jpg/500px-Dawn_on_the_S_rim_of_the_Grand_Canyon_%288645178272%29.jpg`,
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  {
    label: "Rocky Mtn NP",
    query: "Rocky Mtn NP",
    hint: "Colorado",
    lat: 40.343,
    lng: -105.688,
    photoUrl: `${WIKI}/3/3e/Rocky_Mountain_National_Park_in_September_2011_-_Glacier_Gorge_from_Bear_Lake.JPG/500px-Rocky_Mountain_National_Park_in_September_2011_-_Glacier_Gorge_from_Bear_Lake.JPG`,
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  {
    label: "Glacier NP",
    query: "Glacier NP",
    hint: "Montana",
    lat: 48.696,
    lng: -113.718,
    photoUrl: `${WIKI}/5/51/Mountain_Goat_at_Hidden_Lake.jpg/500px-Mountain_Goat_at_Hidden_Lake.jpg`,
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  {
    label: "Acadia NP",
    query: "Acadia NP",
    hint: "Maine",
    lat: 44.339,
    lng: -68.273,
    photoUrl: `${WIKI}/e/e9/Acadia_National_Park_02.JPG/500px-Acadia_National_Park_02.JPG`,
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  {
    label: "Colorado 14ers",
    query: "CO",
    hint: "Front Range + Sawatch + Tenmile",
    lat: 39.118,
    lng: -106.446,
    // Falls back to Rocky Mtn NP photo — no license-clean single
    // 14er photo verified yet, this is topically adjacent.
    photoUrl: `${WIKI}/3/3e/Rocky_Mountain_National_Park_in_September_2011_-_Glacier_Gorge_from_Bear_Lake.JPG/500px-Rocky_Mountain_National_Park_in_September_2011_-_Glacier_Gorge_from_Bear_Lake.JPG`,
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  {
    label: "PNW day hikes",
    query: "Cascades · WA",
    hint: "Mailbox, Mt Si, Colchuck",
    lat: 47.478,
    lng: -121.741,
    photoUrl: `${WIKI}/f/fa/Mount_Rainier_and_other_Cascades_mountains_poking_through_clouds.jpg/500px-Mount_Rainier_and_other_Cascades_mountains_poking_through_clouds.jpg`,
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  {
    label: "White Mtns",
    query: "White Mtns",
    hint: "New Hampshire",
    lat: 44.271,
    lng: -71.303,
    photoUrl: `${WIKI}/d/de/White_Mountains2010-08-20.JPG/500px-White_Mountains2010-08-20.JPG`,
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  {
    label: "The Alps",
    query: "Alps",
    hint: "France · Italy · Germany",
    lat: 45.833,
    lng: 6.865,
    photoUrl: `${WIKI}/b/ba/Alps_2007-03-13_10.10UTC_1px-250m.jpg/500px-Alps_2007-03-13_10.10UTC_1px-250m.jpg`,
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  {
    label: "UK peaks",
    query: "England",
    hint: "Snowdon · Scafell · Helvellyn",
    lat: 54.454,
    lng: -3.089,
    photoUrl: `${WIKI}/6/6c/Snowdon_massif.jpg/500px-Snowdon_massif.jpg`,
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  {
    label: "Nepal treks",
    query: "Nepal",
    hint: "Everest · Annapurna · Langtang",
    lat: 27.988,
    lng: 86.925,
    photoUrl: `${WIKI}/e/e4/Khumbutse.jpg/500px-Khumbutse.jpg`,
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  {
    label: "India Himalaya",
    query: "India",
    hint: "Roopkund · Valley of Flowers",
    lat: 30.383,
    lng: 79.482,
    photoUrl: `${WIKI}/d/d2/Mt._Nanda_Devi.jpg/500px-Mt._Nanda_Devi.jpg`,
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  {
    label: "Africa",
    query: "Kenya",
    hint: "Kilimanjaro · Meru · Mt Kenya",
    lat: -3.075,
    lng: 37.353,
    photoUrl: `${WIKI}/6/6c/Kilimanjaro_from_Amboseli.jpg/500px-Kilimanjaro_from_Amboseli.jpg`,
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  {
    label: "Patagonia",
    query: "Patagonia",
    hint: "Torres del Paine · Fitz Roy",
    lat: -50.937,
    lng: -73.407,
    photoUrl: `${WIKI}/c/ce/Torres_del_Paine_y_cuernos_del_Paine%2C_montaje.jpg/500px-Torres_del_Paine_y_cuernos_del_Paine%2C_montaje.jpg`,
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  {
    label: "NZ great walks",
    query: "New Zealand",
    hint: "Tongariro · Milford · Mueller",
    lat: -39.298,
    lng: 175.632,
    photoUrl: `${WIKI}/2/28/MilfordTrack02.jpg/500px-MilfordTrack02.jpg`,
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
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
