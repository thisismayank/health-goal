/**
 * Approximate trailhead coordinates keyed by preset slug. Layered
 * over TRAIL_LIBRARY so we can add matcher coverage without editing
 * every entry inline — accessed via presetWithCoords() below.
 *
 * Coords are trailhead / start-point WGS84 lat/lng. Precision ~50m
 * is plenty for the historical matcher (5 km radius). Source:
 * NPS.gov trailhead lookups + widely-cited guidebook coords.
 */

import { TRAIL_LIBRARY, type TrailPreset } from "./trail-library";

export const TRAIL_COORDS: Record<string, { lat: number; lng: number }> = {
  // Rocky Mountain NP
  "longs-keyhole": { lat: 40.2717, lng: -105.5567 },
  "sky-pond": { lat: 40.3105, lng: -105.6403 },
  "chasm-lake": { lat: 40.2717, lng: -105.5567 },

  // Zion NP
  "angels-landing": { lat: 37.2589, lng: -112.9500 },
  "observation-point-zion": { lat: 37.2664, lng: -112.9358 },
  "zion-narrows-bottomup": { lat: 37.2841, lng: -112.9469 },

  // Grand Canyon NP
  "gc-bright-angel-plateau": { lat: 36.0576, lng: -112.1436 },
  "gc-south-kaibab-ooh-aah": { lat: 36.0533, lng: -112.0847 },
  "gc-rim-to-rim": { lat: 36.0533, lng: -112.0847 },

  // Glacier NP
  "highline-glacier": { lat: 48.6961, lng: -113.7175 },
  "grinnell-glacier": { lat: 48.7975, lng: -113.6708 },
  "iceberg-lake": { lat: 48.7972, lng: -113.6714 },

  // Acadia NP
  "precipice-trail": { lat: 44.3506, lng: -68.1867 },
  "beehive-loop": { lat: 44.3311, lng: -68.1806 },

  // Great Smoky Mountains NP
  "alum-cave-leconte": { lat: 35.6289, lng: -83.4514 },

  // Rainier NP (existing, in case Mayank's Skyline hike triggers)
  "skyline-paradise": { lat: 46.7856, lng: -121.7367 },
  "rainier-dc": { lat: 46.7856, lng: -121.7367 },
  "rainier-emmons": { lat: 46.8547, lng: -121.6408 },
};

/**
 * Extra presets for parks in the user's history that aren't in the
 * main TRAIL_LIBRARY yet. Same shape as TrailPreset. Concatenated
 * into the effective library by getFullTrailLibrary() below.
 */
export const EXTRA_TRAIL_PRESETS: TrailPreset[] = [
  // ────── Yellowstone NP ──────
  {
    slug: "yellowstone-fairy-falls",
    name: "Fairy Falls + Grand Prismatic Overlook",
    region: "Yellowstone NP · WY",
    country: "US",
    distanceKm: 8.4,
    elevationGainFt: 200,
    maxAltitudeFt: 7500,
    typicalHours: 2.5,
    packWeightLb: 5,
    terrainGrade: "easy",
    notes:
      "Flat, wide trail to the overlook + waterfall. Very popular; go early. Optional side-trip to Imperial Geyser adds ~2 miles.",
    sources: ["NPS.gov", "AllTrails consensus"],
    startLat: 44.5216,
    startLng: -110.8322,
  },
  {
    slug: "yellowstone-mount-washburn",
    name: "Mount Washburn (Dunraven Pass)",
    region: "Yellowstone NP · WY",
    country: "US",
    distanceKm: 10.4,
    elevationGainFt: 1400,
    maxAltitudeFt: 10243,
    typicalHours: 4,
    packWeightLb: 8,
    terrainGrade: "moderate",
    notes:
      "Old service road ascent to a fire lookout with panoramic caldera views. Watch for bighorn sheep. Exposed above treeline — check afternoon weather.",
    sources: ["NPS.gov"],
    startLat: 44.7900,
    startLng: -110.4372,
  },
  {
    slug: "yellowstone-elephant-back",
    name: "Elephant Back Loop",
    region: "Yellowstone NP · WY",
    country: "US",
    distanceKm: 5.6,
    elevationGainFt: 800,
    maxAltitudeFt: 8600,
    typicalHours: 2.5,
    packWeightLb: 5,
    terrainGrade: "moderate",
    notes:
      "Quick uphill grunt to a panoramic overlook of Yellowstone Lake. Bear country — carry spray.",
    sources: ["NPS.gov"],
    startLat: 44.5636,
    startLng: -110.4083,
  },

  // ────── Sedona · Coconino NF ──────
  {
    slug: "sedona-devils-bridge",
    name: "Devil's Bridge",
    region: "Sedona · Coconino NF · AZ",
    country: "US",
    distanceKm: 6.4,
    elevationGainFt: 500,
    maxAltitudeFt: 4900,
    typicalHours: 2,
    packWeightLb: 5,
    terrainGrade: "moderate",
    notes:
      "Iconic natural sandstone arch. Final scramble is exposed but short. Crowded — go at sunrise. Access via Dry Creek Rd (high-clearance from Chuckwagon TH).",
    sources: ["USFS", "AllTrails consensus"],
    startLat: 34.9019,
    startLng: -111.8125,
  },
  {
    slug: "sedona-cathedral-rock",
    name: "Cathedral Rock",
    region: "Sedona · Coconino NF · AZ",
    country: "US",
    distanceKm: 2.1,
    elevationGainFt: 750,
    maxAltitudeFt: 4967,
    typicalHours: 1.5,
    packWeightLb: 3,
    terrainGrade: "moderate",
    notes:
      "Short but steep sandstone scramble to a saddle between spires. Class 2-3 moves on slickrock — dry conditions only.",
    sources: ["USFS"],
    startLat: 34.8231,
    startLng: -111.7778,
  },
  {
    slug: "sedona-west-fork",
    name: "West Fork of Oak Creek",
    region: "Sedona · Coconino NF · AZ",
    country: "US",
    distanceKm: 11.3,
    elevationGainFt: 300,
    maxAltitudeFt: 5400,
    typicalHours: 4,
    packWeightLb: 5,
    terrainGrade: "easy",
    notes:
      "Flat canyon walk with 13 stream crossings — waterproof footwear or wading shoes. Fall foliage October-early November. Fee area.",
    sources: ["USFS"],
    startLat: 34.9906,
    startLng: -111.7444,
  },
  {
    slug: "sedona-bell-rock",
    name: "Bell Rock Pathway",
    region: "Sedona · Coconino NF · AZ",
    country: "US",
    distanceKm: 6.1,
    elevationGainFt: 200,
    maxAltitudeFt: 4700,
    typicalHours: 2,
    packWeightLb: 3,
    terrainGrade: "easy",
    notes:
      "Wide, mostly-flat path around Bell Rock. Optional scrambles onto the rock itself add difficulty and vertical.",
    sources: ["USFS"],
    startLat: 34.8069,
    startLng: -111.7669,
  },

  // ────── Bryce Canyon NP ──────
  {
    slug: "bryce-navajo-queens",
    name: "Navajo Loop + Queen's Garden (Figure 8)",
    region: "Bryce NP · UT",
    country: "US",
    distanceKm: 4.8,
    elevationGainFt: 600,
    maxAltitudeFt: 8000,
    typicalHours: 2.5,
    packWeightLb: 5,
    terrainGrade: "moderate",
    notes:
      "The classic Bryce sampler. Down Wall Street (Navajo), across the amphitheater, up Queen's Garden back to Sunrise Point. Descend first, climb out at end.",
    sources: ["NPS.gov"],
    startLat: 37.6247,
    startLng: -112.1636,
  },
  {
    slug: "bryce-peekaboo-loop",
    name: "Peekaboo Loop",
    region: "Bryce NP · UT",
    country: "US",
    distanceKm: 8.2,
    elevationGainFt: 1500,
    maxAltitudeFt: 8300,
    typicalHours: 3.5,
    packWeightLb: 6,
    terrainGrade: "moderate",
    notes:
      "Deeper into the hoodoos than Navajo. Shared with horses on some sections. Elevation makes the return climb feel like more work than the mileage suggests.",
    sources: ["NPS.gov"],
    startLat: 37.6053,
    startLng: -112.1500,
  },
  {
    slug: "bryce-fairyland-loop",
    name: "Fairyland Loop",
    region: "Bryce NP · UT",
    country: "US",
    distanceKm: 12.9,
    elevationGainFt: 1700,
    maxAltitudeFt: 8100,
    typicalHours: 5,
    packWeightLb: 8,
    terrainGrade: "hard",
    notes:
      "The best long day at Bryce — less crowded than the amphitheater loops. Big elevation change; carry water, no shade.",
    sources: ["NPS.gov"],
    startLat: 37.6444,
    startLng: -112.1478,
  },

  // ────── Petrified Forest NP ──────
  {
    slug: "petrified-blue-mesa",
    name: "Blue Mesa Trail",
    region: "Petrified Forest NP · AZ",
    country: "US",
    distanceKm: 1.6,
    elevationGainFt: 100,
    maxAltitudeFt: 5700,
    typicalHours: 1,
    packWeightLb: 3,
    terrainGrade: "easy",
    notes:
      "Short paved loop through blue-and-purple badlands with petrified wood scattered along the trail. Very photogenic.",
    sources: ["NPS.gov"],
    startLat: 34.9450,
    startLng: -109.7822,
  },
  {
    slug: "petrified-crystal-forest",
    name: "Crystal Forest Trail",
    region: "Petrified Forest NP · AZ",
    country: "US",
    distanceKm: 1.2,
    elevationGainFt: 30,
    maxAltitudeFt: 5500,
    typicalHours: 0.75,
    packWeightLb: 3,
    terrainGrade: "easy",
    notes:
      "Flat loop showcasing the densest concentration of crystalline petrified logs. Wheelchair-accessible for the first section.",
    sources: ["NPS.gov"],
    startLat: 34.8125,
    startLng: -109.8756,
  },

  // ────── Hudson Highlands / Catskills / Shawangunks (NY) ──────
  // Added for the "near me" feed — the library was heavy on
  // expedition targets and thin on East Coast day-trip options,
  // which meant users in NYC / New England saw nothing under
  // /trails/discover's Near Me section. Trailhead coords sourced
  // from NY State Parks trailhead lookups + guidebook consensus.
  {
    slug: "bear-mountain-loop",
    name: "Bear Mountain Loop (Perkins Tower)",
    region: "Bear Mtn SP · NY",
    country: "US",
    distanceKm: 6.4,
    elevationGainFt: 1100,
    maxAltitudeFt: 1284,
    typicalHours: 3,
    packWeightLb: 6,
    terrainGrade: "moderate",
    notes:
      "Classic loop up the Major Welch, down the AT. Views of the Hudson from Perkins Tower. Popular — go early on weekends.",
    sources: ["NY State Parks", "AllTrails"],
    startLat: 41.3126,
    startLng: -73.9887,
  },
  {
    slug: "breakneck-ridge",
    name: "Breakneck Ridge",
    region: "Hudson Highlands · NY",
    country: "US",
    distanceKm: 5.6,
    elevationGainFt: 1250,
    maxAltitudeFt: 1260,
    typicalHours: 3,
    packWeightLb: 6,
    terrainGrade: "hard",
    notes:
      "Legendary scramble above the Hudson. Real Class 3 sections early — hand-over-hand near the ridge. Not for wet weather.",
    sources: ["NY State Parks", "Metro-North trailhead"],
    startLat: 41.4459,
    startLng: -73.9764,
  },
  {
    slug: "kaaterskill-high-peak",
    name: "Kaaterskill High Peak",
    region: "Catskills · NY",
    country: "US",
    distanceKm: 12.9,
    elevationGainFt: 1900,
    maxAltitudeFt: 3655,
    typicalHours: 6,
    packWeightLb: 8,
    terrainGrade: "hard",
    notes:
      "Long loop with a real summit and a plane-wreck detour. Trail is unmaintained in stretches — bring a map.",
    sources: ["NY DEC", "Catskill 3500 Club"],
    startLat: 42.1936,
    startLng: -74.0567,
  },
  {
    slug: "slide-mountain",
    name: "Slide Mountain (highest Catskill peak)",
    region: "Catskills · NY",
    country: "US",
    distanceKm: 11.3,
    elevationGainFt: 1800,
    maxAltitudeFt: 4180,
    typicalHours: 5.5,
    packWeightLb: 7,
    terrainGrade: "moderate",
    notes:
      "Highest peak in the Catskills, but a steady climb rather than a scramble. Good all-day workout close to NYC.",
    sources: ["NY DEC", "Catskill 3500 Club"],
    startLat: 41.9944,
    startLng: -74.4283,
  },
  {
    slug: "mount-tammany",
    name: "Mount Tammany (Kittatinny Ridge)",
    region: "Delaware Water Gap · NJ",
    country: "US",
    distanceKm: 5.5,
    elevationGainFt: 1250,
    maxAltitudeFt: 1526,
    typicalHours: 3,
    packWeightLb: 6,
    terrainGrade: "moderate",
    notes:
      "Steep first mile up the red-dot trail; ridge views over the Water Gap. Common overhanging rocks near the top.",
    sources: ["NPS.gov", "NY-NJ Trail Conf"],
    startLat: 40.9714,
    startLng: -75.1250,
  },
  {
    slug: "gertrudes-nose",
    name: "Gertrude's Nose Loop (Minnewaska)",
    region: "Shawangunks · NY",
    country: "US",
    distanceKm: 12.2,
    elevationGainFt: 1100,
    maxAltitudeFt: 2280,
    typicalHours: 4.5,
    packWeightLb: 6,
    terrainGrade: "moderate",
    notes:
      "Exposed cliff-edge loop with Catskills views. Sections along the rim have serious drops — no barriers.",
    sources: ["NY State Parks"],
    startLat: 41.7325,
    startLng: -74.2400,
  },
  {
    slug: "mount-marcy",
    name: "Mount Marcy (NY's high point)",
    region: "Adirondacks · NY",
    country: "US",
    distanceKm: 24.1,
    elevationGainFt: 3300,
    maxAltitudeFt: 5344,
    typicalHours: 10,
    packWeightLb: 12,
    terrainGrade: "hard",
    notes:
      "Long approach from Adirondak Loj via Van Hoevenberg. Exposed summit — weather changes fast above treeline.",
    sources: ["DEC", "ADK Guidebook"],
    startLat: 44.1830,
    startLng: -73.9647,
  },
  {
    slug: "cascade-mountain-adk",
    name: "Cascade Mountain (High Peaks starter)",
    region: "Adirondacks · NY",
    country: "US",
    distanceKm: 7.4,
    elevationGainFt: 1940,
    maxAltitudeFt: 4098,
    typicalHours: 4,
    packWeightLb: 6,
    terrainGrade: "moderate",
    notes:
      "Most accessible ADK 46er. Short, steep, bald summit with 360° views. Popular — parking fills by 7am on weekends.",
    sources: ["DEC", "ADK 46er Club"],
    startLat: 44.2211,
    startLng: -73.8617,
  },
];

/**
 * Trail library augmented with coords + extra presets. Prefer this
 * over the raw TRAIL_LIBRARY for anything that cares about matching
 * or completeness.
 */
export function getFullTrailLibrary(): TrailPreset[] {
  const withCoords = TRAIL_LIBRARY.map((t) => {
    if (t.startLat != null && t.startLng != null) return t;
    const overlay = TRAIL_COORDS[t.slug];
    return overlay ? { ...t, startLat: overlay.lat, startLng: overlay.lng } : t;
  });
  return [...withCoords, ...EXTRA_TRAIL_PRESETS];
}
