/**
 * Curated preset library of famous hikes / peaks.
 *
 * Sources: Wikipedia (CC-BY-SA), NPS.gov (public domain), USGS
 * (public domain), and commonly-cited guidebook consensus. Numbers
 * are approximate — real conditions vary with season, snowpack, and
 * route choice. Users should verify current conditions before
 * attempting any objective.
 *
 * For multi-day objectives, `typicalHours` is the LONGEST single day
 * (usually the summit push) — that's what the readiness engine gates
 * on. The `notes` field flags multi-day commitment where relevant.
 */

import type { TrailTerrainGrade } from "@/db/schema";

export type TrailPreset = {
  slug: string;
  name: string;
  region: string;
  country: string; // ISO-3166 alpha-2
  distanceKm: number;
  elevationGainFt: number;
  maxAltitudeFt: number;
  typicalHours: number;
  packWeightLb: number;
  terrainGrade: TrailTerrainGrade;
  notes: string;
  sources: string[];
};

export const TRAIL_LIBRARY: TrailPreset[] = [
  // ────── Rainier National Park ──────
  {
    slug: "rainier-dc",
    name: "Mount Rainier — Disappointment Cleaver",
    region: "Rainier NP · Cascades",
    country: "US",
    distanceKm: 22,
    elevationGainFt: 9000,
    maxAltitudeFt: 14411,
    typicalHours: 14,
    packWeightLb: 35,
    terrainGrade: "mountaineering",
    notes:
      "2-day itinerary: Paradise → Camp Muir (10,188 ft) with ~40 lb pack, then summit push starting ~midnight. Requires prior mountaineering skills or a guide.",
    sources: ["NPS.gov", "American Alpine Institute"],
  },
  {
    slug: "rainier-emmons",
    name: "Mount Rainier — Emmons Glacier",
    region: "Rainier NP · Cascades",
    country: "US",
    distanceKm: 20,
    elevationGainFt: 10100,
    maxAltitudeFt: 14411,
    typicalHours: 15,
    packWeightLb: 40,
    terrainGrade: "mountaineering",
    notes:
      "Alternative route from White River / Sunrise side. Longer approach than DC but less crowded and technically easier in good conditions.",
    sources: ["NPS.gov", "Fred Beckey guide"],
  },
  {
    slug: "skyline-paradise",
    name: "Skyline Trail — Paradise Loop",
    region: "Rainier NP · Cascades",
    country: "US",
    distanceKm: 8.8,
    elevationGainFt: 1700,
    maxAltitudeFt: 6800,
    typicalHours: 3.5,
    packWeightLb: 12,
    terrainGrade: "moderate",
    notes:
      "Classic Paradise-area loop with sweeping Rainier views. Panorama Point is the high point. Snow patches often linger into July.",
    sources: ["NPS.gov"],
  },
  {
    slug: "burroughs-3rd",
    name: "3rd Burroughs Mountain (Sunrise)",
    region: "Rainier NP · Cascades",
    country: "US",
    distanceKm: 15,
    elevationGainFt: 2600,
    maxAltitudeFt: 7800,
    typicalHours: 6,
    packWeightLb: 15,
    terrainGrade: "hard",
    notes:
      "From Sunrise trailhead. Exposed alpine terrain with dramatic Rainier north-face views. Wind and weather can flip quickly.",
    sources: ["NPS.gov"],
  },
  {
    slug: "burroughs-1st",
    name: "1st Burroughs Mountain (Sunrise)",
    region: "Rainier NP · Cascades",
    country: "US",
    distanceKm: 9.7,
    elevationGainFt: 1700,
    maxAltitudeFt: 7200,
    typicalHours: 4,
    packWeightLb: 12,
    terrainGrade: "moderate",
    notes: "Shorter Burroughs variant if 3rd feels too ambitious.",
    sources: ["NPS.gov"],
  },
  {
    slug: "wonderland-trail",
    name: "Wonderland Trail — Circumnavigation",
    region: "Rainier NP · Cascades",
    country: "US",
    distanceKm: 150,
    elevationGainFt: 22000,
    maxAltitudeFt: 6750,
    typicalHours: 10, // longest day
    packWeightLb: 35,
    terrainGrade: "hard",
    notes:
      "9-12 day thru-hike circling Rainier. Permit-lottery required. Endurance gate: longest day ~10 hours, cumulative pack-load stress is the real challenge.",
    sources: ["NPS.gov"],
  },
  {
    slug: "camp-muir-dayhike",
    name: "Camp Muir Day Hike (Paradise → Muir)",
    region: "Rainier NP · Cascades",
    country: "US",
    distanceKm: 14.5,
    elevationGainFt: 4650,
    maxAltitudeFt: 10188,
    typicalHours: 7,
    packWeightLb: 15,
    terrainGrade: "hard",
    notes:
      "Excellent altitude + vertical training day. No glacier travel required — snow slope in summer, class-1 terrain. Ends at the summit-day base camp.",
    sources: ["NPS.gov"],
  },

  // ────── PNW Volcanoes ──────
  {
    slug: "baker-easton",
    name: "Mount Baker — Easton Glacier",
    region: "N. Cascades",
    country: "US",
    distanceKm: 22,
    elevationGainFt: 7100,
    maxAltitudeFt: 10781,
    typicalHours: 12,
    packWeightLb: 35,
    terrainGrade: "mountaineering",
    notes:
      "Popular Rainier prep peak. 2-day: approach to Sandy Camp, summit push. Similar skill set to Rainier at lower altitude.",
    sources: ["USFS Mount Baker Wilderness"],
  },
  {
    slug: "adams-south-spur",
    name: "Mount Adams — South Spur",
    region: "S. Cascades",
    country: "US",
    distanceKm: 19,
    elevationGainFt: 6700,
    maxAltitudeFt: 12281,
    typicalHours: 11,
    packWeightLb: 30,
    terrainGrade: "hard",
    notes:
      "Non-technical snow climb (crampons + ice axe). Great Rainier prep for altitude. Often done as long day OR overnight at Lunch Counter (~9,000 ft).",
    sources: ["USFS"],
  },
  {
    slug: "hood-south-side",
    name: "Mount Hood — South Side",
    region: "Cascades · OR",
    country: "US",
    distanceKm: 12,
    elevationGainFt: 5300,
    maxAltitudeFt: 11249,
    typicalHours: 8,
    packWeightLb: 25,
    terrainGrade: "mountaineering",
    notes:
      "Alpine start (~2am) from Timberline. Technical top pitch (Pearly Gates or Old Chute) requires rope/harness/crampons.",
    sources: ["Wikipedia"],
  },
  {
    slug: "st-helens-monitor",
    name: "Mount St. Helens — Monitor Ridge",
    region: "Cascades · WA",
    country: "US",
    distanceKm: 16,
    elevationGainFt: 4600,
    maxAltitudeFt: 8365,
    typicalHours: 8,
    packWeightLb: 15,
    terrainGrade: "hard",
    notes:
      "Non-technical scramble; boulders + ash slog. Permit-lottery required Apr-Oct. Good early-season fitness test.",
    sources: ["USFS"],
  },
  {
    slug: "shasta-avalanche-gulch",
    name: "Mount Shasta — Avalanche Gulch",
    region: "Cascades · CA",
    country: "US",
    distanceKm: 18,
    elevationGainFt: 7300,
    maxAltitudeFt: 14180,
    typicalHours: 12,
    packWeightLb: 35,
    terrainGrade: "mountaineering",
    notes:
      "Standard Shasta route. 2-day: Bunny Flat → Helen Lake camp → summit. Real altitude at the top; strong Rainier-analog.",
    sources: ["USFS Shasta-Trinity"],
  },

  // ────── Sierra Nevada ──────
  {
    slug: "whitney-dayhike",
    name: "Mount Whitney — Day Hike (Whitney Portal)",
    region: "Sierra Nevada · CA",
    country: "US",
    distanceKm: 35,
    elevationGainFt: 6100,
    maxAltitudeFt: 14505,
    typicalHours: 14,
    packWeightLb: 20,
    terrainGrade: "hard",
    notes:
      "Highest point in the contiguous US done as a very long day. Permit lottery. Real altitude at the top; sea-level residents struggle.",
    sources: ["USFS Inyo"],
  },
  {
    slug: "half-dome",
    name: "Half Dome (Yosemite)",
    region: "Sierra Nevada · CA",
    country: "US",
    distanceKm: 23,
    elevationGainFt: 4800,
    maxAltitudeFt: 8842,
    typicalHours: 10,
    packWeightLb: 15,
    terrainGrade: "hard",
    notes:
      "Cables section on the final 400 ft is exposed and can be crowded. Permit lottery. Approx moderate altitude; conditioning is the gate.",
    sources: ["NPS.gov"],
  },
  {
    slug: "clouds-rest",
    name: "Clouds Rest (Yosemite)",
    region: "Sierra Nevada · CA",
    country: "US",
    distanceKm: 22,
    elevationGainFt: 3300,
    maxAltitudeFt: 9926,
    typicalHours: 8,
    packWeightLb: 12,
    terrainGrade: "moderate",
    notes:
      "Excellent Yosemite alternative to Half Dome. Narrow ridge finish is exposed but non-technical.",
    sources: ["NPS.gov"],
  },
  {
    slug: "cactus-to-clouds",
    name: "Cactus to Clouds (San Jacinto)",
    region: "Southern CA",
    country: "US",
    distanceKm: 32,
    elevationGainFt: 10300,
    maxAltitudeFt: 10834,
    typicalHours: 14,
    packWeightLb: 15,
    terrainGrade: "hard",
    notes:
      "One of the largest single-day vertical gains in the US. Palm Springs desert floor to alpine summit. Extreme heat + water logistics matter.",
    sources: ["Wikipedia"],
  },

  // ────── Colorado 14ers ──────
  {
    slug: "longs-keyhole",
    name: "Longs Peak — Keyhole Route",
    region: "Rocky Mtn NP · CO",
    country: "US",
    distanceKm: 24,
    elevationGainFt: 4900,
    maxAltitudeFt: 14259,
    typicalHours: 13,
    packWeightLb: 15,
    terrainGrade: "technical",
    notes:
      "Class 3 scrambling above the Keyhole. Alpine start required to be off summit by noon (afternoon storms). Real fatality history.",
    sources: ["NPS.gov"],
  },
  {
    slug: "elbert",
    name: "Mount Elbert (Standard)",
    region: "Sawatch · CO",
    country: "US",
    distanceKm: 15,
    elevationGainFt: 4700,
    maxAltitudeFt: 14440,
    typicalHours: 8,
    packWeightLb: 12,
    terrainGrade: "moderate",
    notes:
      "Highest point in the Rockies. Non-technical Class 1 trail. Altitude is the primary challenge.",
    sources: ["USFS", "Wikipedia"],
  },
  {
    slug: "bierstadt",
    name: "Mount Bierstadt (Standard)",
    region: "Front Range · CO",
    country: "US",
    distanceKm: 11,
    elevationGainFt: 2900,
    maxAltitudeFt: 14065,
    typicalHours: 6,
    packWeightLb: 10,
    terrainGrade: "moderate",
    notes:
      "One of the most accessible 14ers. Class 2 talus. Popular first-14er.",
    sources: ["USFS"],
  },
  {
    slug: "grays-torreys",
    name: "Grays + Torreys (Combo)",
    region: "Front Range · CO",
    country: "US",
    distanceKm: 13,
    elevationGainFt: 3600,
    maxAltitudeFt: 14275,
    typicalHours: 7,
    packWeightLb: 12,
    terrainGrade: "moderate",
    notes: "Two 14ers on one outing. Class 2. Weather window matters.",
    sources: ["USFS"],
  },

  // ────── Grand Teton ──────
  {
    slug: "grand-teton-owen-spalding",
    name: "Grand Teton — Owen-Spalding",
    region: "Teton NP · WY",
    country: "US",
    distanceKm: 22,
    elevationGainFt: 7300,
    maxAltitudeFt: 13775,
    typicalHours: 15,
    packWeightLb: 25,
    terrainGrade: "technical",
    notes:
      "Class 5.4 climbing on the final pitches. 2-day: approach to Lower Saddle camp (11,600 ft), climb + descent day.",
    sources: ["NPS.gov"],
  },

  // ────── Northeast US ──────
  {
    slug: "presidential-traverse",
    name: "Presidential Traverse (White Mountains)",
    region: "White Mts · NH",
    country: "US",
    distanceKm: 32,
    elevationGainFt: 9000,
    maxAltitudeFt: 6288,
    typicalHours: 14,
    packWeightLb: 15,
    terrainGrade: "hard",
    notes:
      "Full Presi traverse (Madison → Washington). Notorious for sudden weather. Above treeline much of the day.",
    sources: ["AMC"],
  },
  {
    slug: "washington-tuckerman",
    name: "Mount Washington — Tuckerman Ravine",
    region: "White Mts · NH",
    country: "US",
    distanceKm: 13,
    elevationGainFt: 4200,
    maxAltitudeFt: 6288,
    typicalHours: 6,
    packWeightLb: 12,
    terrainGrade: "hard",
    notes:
      "Highest point in the Northeast. Weather is the story — 'worst weather in North America' claim. Wind + cold above treeline.",
    sources: ["AMC", "NWS"],
  },
  {
    slug: "katahdin-knife-edge",
    name: "Katahdin — Knife Edge",
    region: "Baxter · ME",
    country: "US",
    distanceKm: 15,
    elevationGainFt: 4200,
    maxAltitudeFt: 5267,
    typicalHours: 9,
    packWeightLb: 12,
    terrainGrade: "technical",
    notes:
      "Knife Edge is a narrow exposed ridge (Class 3). Do NOT attempt in wind or bad weather. Permit required.",
    sources: ["Baxter State Park"],
  },

  // ────── International Trekking ──────
  {
    slug: "kilimanjaro-machame",
    name: "Kilimanjaro — Machame Route",
    region: "Kilimanjaro · Tanzania",
    country: "TZ",
    distanceKm: 62,
    elevationGainFt: 15300,
    maxAltitudeFt: 19341,
    typicalHours: 14,
    packWeightLb: 15,
    terrainGrade: "hard",
    notes:
      "6-7 day trek. Porter-supported (day pack only). Summit night is longest single day (~14 hrs). Success rate improves dramatically with 7-day itinerary over 6-day.",
    sources: ["Wikipedia", "Kilimanjaro National Park"],
  },
  {
    slug: "kilimanjaro-lemosho",
    name: "Kilimanjaro — Lemosho Route",
    region: "Kilimanjaro · Tanzania",
    country: "TZ",
    distanceKm: 70,
    elevationGainFt: 15100,
    maxAltitudeFt: 19341,
    typicalHours: 14,
    packWeightLb: 15,
    terrainGrade: "hard",
    notes:
      "7-8 day trek, best acclimatization profile. Highest success rate of the standard routes.",
    sources: ["Wikipedia", "KINAPA"],
  },
  {
    slug: "ebc-trek",
    name: "Everest Base Camp Trek",
    region: "Khumbu · Nepal",
    country: "NP",
    distanceKm: 130,
    elevationGainFt: 17000,
    maxAltitudeFt: 18192,
    typicalHours: 8,
    packWeightLb: 15,
    terrainGrade: "moderate",
    notes:
      "12-14 day trek to base of Everest (Kala Patthar viewpoint at 18,192 ft). Teahouse-supported. Altitude is the primary challenge; distance is manageable in short daily stages.",
    sources: ["Wikipedia", "Nepal Tourism Board"],
  },
  {
    slug: "annapurna-abc",
    name: "Annapurna Base Camp Trek",
    region: "Annapurna · Nepal",
    country: "NP",
    distanceKm: 115,
    elevationGainFt: 12500,
    maxAltitudeFt: 13550,
    typicalHours: 7,
    packWeightLb: 12,
    terrainGrade: "moderate",
    notes:
      "7-10 day trek. Less extreme altitude than EBC; more forgiving for first Nepal trek.",
    sources: ["Wikipedia"],
  },
  {
    slug: "tour-du-mont-blanc",
    name: "Tour du Mont Blanc (TMB)",
    region: "Alps · FR/IT/CH",
    country: "FR",
    distanceKm: 170,
    elevationGainFt: 32000,
    maxAltitudeFt: 8743,
    typicalHours: 9,
    packWeightLb: 20,
    terrainGrade: "hard",
    notes:
      "11-day circumnavigation of Mont Blanc through France, Italy, Switzerland. Refuge-supported. Moderate altitude, but sustained daily vertical.",
    sources: ["Wikipedia"],
  },
  {
    slug: "inca-trail",
    name: "Inca Trail (Classic 4-day)",
    region: "Andes · Peru",
    country: "PE",
    distanceKm: 42,
    elevationGainFt: 6600,
    maxAltitudeFt: 13828,
    typicalHours: 8,
    packWeightLb: 12,
    terrainGrade: "moderate",
    notes:
      "4 day/3 night trek to Machu Picchu. Permit required 4+ months in advance. Dead Woman's Pass (13,828 ft) is the high point on day 2.",
    sources: ["Wikipedia", "Peruvian Ministry of Culture"],
  },

  // ────── International Mountaineering ──────
  {
    slug: "aconcagua-normal",
    name: "Aconcagua — Normal Route",
    region: "Andes · Argentina",
    country: "AR",
    distanceKm: 62,
    elevationGainFt: 13500,
    maxAltitudeFt: 22841,
    typicalHours: 12,
    packWeightLb: 40,
    terrainGrade: "mountaineering",
    notes:
      "18-21 day expedition. Highest peak in the Americas. Non-technical but extreme altitude — real risk of AMS/HAPE/HACE. Summit day is 10-14 hours.",
    sources: ["Wikipedia", "Aconcagua Provincial Park"],
  },
  {
    slug: "denali-west-buttress",
    name: "Denali — West Buttress",
    region: "Alaska Range · AK",
    country: "US",
    distanceKm: 32,
    elevationGainFt: 13000,
    maxAltitudeFt: 20310,
    typicalHours: 12,
    packWeightLb: 55,
    terrainGrade: "mountaineering",
    notes:
      "18-24 day expedition. Highest peak in North America. Extreme cold (-40°F possible), heavy loads (pack + sled), altitude. Only for experienced mountaineers.",
    sources: ["NPS.gov Denali", "American Alpine Institute"],
  },
  {
    slug: "elbrus-south",
    name: "Mt. Elbrus — South Side",
    region: "Caucasus · Russia",
    country: "RU",
    distanceKm: 20,
    elevationGainFt: 6900,
    maxAltitudeFt: 18510,
    typicalHours: 12,
    packWeightLb: 25,
    terrainGrade: "mountaineering",
    notes:
      "Highest peak in Europe. Cable-car access to Barrels Hut (~12,500 ft) shortens the approach. Snow slope + real altitude — non-technical but sustained.",
    sources: ["Wikipedia"],
  },
  {
    slug: "mont-blanc-gouter",
    name: "Mont Blanc — Goûter Route",
    region: "Alps · France",
    country: "FR",
    distanceKm: 20,
    elevationGainFt: 12100,
    maxAltitudeFt: 15774,
    typicalHours: 12,
    packWeightLb: 25,
    terrainGrade: "mountaineering",
    notes:
      "Standard Mont Blanc route. Grand Couloir crossing is objectively dangerous (rockfall). Refuge at 12,600 ft breaks the ascent.",
    sources: ["Wikipedia", "Chamonix Guides"],
  },
];

export function searchTrails(query: string): TrailPreset[] {
  const q = query.trim().toLowerCase();
  if (!q) return TRAIL_LIBRARY;
  const words = q.split(/\s+/).filter(Boolean);
  return TRAIL_LIBRARY.filter((t) => {
    const haystack = `${t.name} ${t.region} ${t.country}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}

export function findTrailBySlug(slug: string): TrailPreset | undefined {
  return TRAIL_LIBRARY.find((t) => t.slug === slug);
}
