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
  // Approximate trailhead coordinates (WGS84). Used by the historical
  // hike matcher to find candidate presets within ~5 km of a GPS
  // activity start point. Optional — trails without coords just aren't
  // eligible for GPS-based matching (name fallback still works).
  startLat?: number;
  startLng?: number;
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
    packWeightLb: 5,
    terrainGrade: "moderate",
    notes:
      "Classic Paradise-area loop with sweeping Rainier views. Panorama Point is the high point. Snow patches often linger into July. Day-pack: water + snacks + layers.",
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
    packWeightLb: 10,
    terrainGrade: "hard",
    notes:
      "From Sunrise trailhead. Exposed alpine terrain with dramatic Rainier north-face views. Wind and weather can flip quickly. Extra layers for exposure.",
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
    packWeightLb: 7,
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
    packWeightLb: 10,
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
    packWeightLb: 15,
    terrainGrade: "hard",
    notes:
      "Highest point in the contiguous US done as a very long day. Permit lottery. Real altitude at the top; sea-level residents struggle. Water + food is the pack weight (~14 hrs).",
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
    packWeightLb: 10,
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
    packWeightLb: 8,
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
    packWeightLb: 10,
    terrainGrade: "hard",
    notes:
      "One of the largest single-day vertical gains in the US. Palm Springs desert floor to alpine summit. Extreme heat + water logistics matter (water alone is heavy).",
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
    packWeightLb: 10,
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
    packWeightLb: 7,
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
    packWeightLb: 6,
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
    packWeightLb: 8,
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
    packWeightLb: 12,
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
    packWeightLb: 8,
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
    packWeightLb: 8,
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

  // ────── Zion NP ──────
  {
    slug: "angels-landing",
    name: "Angel's Landing",
    region: "Zion NP · UT",
    country: "US",
    distanceKm: 8.7,
    elevationGainFt: 1500,
    maxAltitudeFt: 5790,
    typicalHours: 4,
    packWeightLb: 5,
    terrainGrade: "technical",
    notes:
      "Final half-mile is chains-only along an exposed narrow spine. Permit required (lottery). Not for those uncomfortable with heights.",
    sources: ["NPS.gov Zion"],
  },
  {
    slug: "observation-point-zion",
    name: "Observation Point (East Mesa)",
    region: "Zion NP · UT",
    country: "US",
    distanceKm: 12.9,
    elevationGainFt: 700,
    maxAltitudeFt: 6508,
    typicalHours: 5,
    packWeightLb: 5,
    terrainGrade: "moderate",
    notes:
      "Alternate approach (main trail closed indefinitely). Overlooks Angel's Landing from 1000 ft above. Sun-exposed — carry water.",
    sources: ["NPS.gov Zion"],
  },
  {
    slug: "zion-narrows-bottomup",
    name: "The Narrows (bottom-up)",
    region: "Zion NP · UT",
    country: "US",
    distanceKm: 15,
    elevationGainFt: 300,
    maxAltitudeFt: 4600,
    typicalHours: 8,
    packWeightLb: 8,
    terrainGrade: "moderate",
    notes:
      "Wading through the Virgin River. Distance depends on turnaround (Big Spring is common). Cold water; drysuit rental in shoulder seasons. Flash flood danger.",
    sources: ["NPS.gov Zion"],
  },

  // ────── Yosemite NP additions ──────
  {
    slug: "yosemite-mist-trail",
    name: "Mist Trail to Vernal Fall",
    region: "Yosemite NP · CA",
    country: "US",
    distanceKm: 4.8,
    elevationGainFt: 1000,
    maxAltitudeFt: 5044,
    typicalHours: 3,
    packWeightLb: 5,
    terrainGrade: "easy",
    notes:
      "Iconic stone-staircase climb next to Vernal Fall. Very wet in spring — waterproof jacket recommended. Extend to Nevada Fall (8 mi, +900 ft) for a fuller day.",
    sources: ["NPS.gov Yosemite"],
  },
  {
    slug: "yosemite-upper-falls",
    name: "Upper Yosemite Falls",
    region: "Yosemite NP · CA",
    country: "US",
    distanceKm: 11.6,
    elevationGainFt: 2700,
    maxAltitudeFt: 6700,
    typicalHours: 7,
    packWeightLb: 8,
    terrainGrade: "moderate",
    notes:
      "Steady switchbacks to the top of North America's tallest waterfall. Sun-exposed; start early. Waterfall best in spring/early summer.",
    sources: ["NPS.gov Yosemite"],
  },
  {
    slug: "cathedral-lakes",
    name: "Cathedral Lakes",
    region: "Yosemite NP · CA",
    country: "US",
    distanceKm: 15.3,
    elevationGainFt: 1000,
    maxAltitudeFt: 9500,
    typicalHours: 6,
    packWeightLb: 8,
    terrainGrade: "easy",
    notes:
      "High-country Tuolumne classic on the JMT. Two lakes below Cathedral Peak. Snow lingers into June.",
    sources: ["NPS.gov Yosemite"],
  },

  // ────── Grand Canyon NP ──────
  {
    slug: "gc-bright-angel-plateau",
    name: "Bright Angel to Plateau Point",
    region: "Grand Canyon NP · AZ",
    country: "US",
    distanceKm: 19.3,
    elevationGainFt: 3080,
    maxAltitudeFt: 6800,
    typicalHours: 8,
    packWeightLb: 10,
    terrainGrade: "moderate",
    notes:
      "Down-first hike — the return climb in afternoon heat is the crux. Not recommended in summer. Refill water at Havasupai Gardens.",
    sources: ["NPS.gov Grand Canyon"],
  },
  {
    slug: "gc-south-kaibab-ooh-aah",
    name: "South Kaibab to Ooh Aah Point",
    region: "Grand Canyon NP · AZ",
    country: "US",
    distanceKm: 2.9,
    elevationGainFt: 600,
    maxAltitudeFt: 7260,
    typicalHours: 2,
    packWeightLb: 3,
    terrainGrade: "easy",
    notes:
      "Short, punchy taste of the canyon with dramatic views. Great for time-limited visitors.",
    sources: ["NPS.gov Grand Canyon"],
  },
  {
    slug: "gc-rim-to-rim",
    name: "Rim to Rim (North → South)",
    region: "Grand Canyon NP · AZ",
    country: "US",
    distanceKm: 33.8,
    elevationGainFt: 6000,
    maxAltitudeFt: 8241,
    typicalHours: 12,
    packWeightLb: 12,
    terrainGrade: "technical",
    notes:
      "Serious endurance day: 6000 ft up, 5800 ft down. Requires shuttle logistics. Attempted May/Sep/Oct — summer heat can be lethal. Overnight variant recommended for most.",
    sources: ["NPS.gov Grand Canyon"],
  },

  // ────── Rocky Mountain NP ──────
  {
    slug: "sky-pond",
    name: "Sky Pond",
    region: "Rocky Mtn NP · CO",
    country: "US",
    distanceKm: 14.5,
    elevationGainFt: 1780,
    maxAltitudeFt: 10900,
    typicalHours: 7,
    packWeightLb: 8,
    terrainGrade: "moderate",
    notes:
      "Alpine lake beneath the Sharkstooth. Timed entry may apply. Includes a short scramble at Timberline Falls.",
    sources: ["NPS.gov RMNP"],
  },
  {
    slug: "chasm-lake",
    name: "Chasm Lake (Longs Peak base)",
    region: "Rocky Mtn NP · CO",
    country: "US",
    distanceKm: 13.5,
    elevationGainFt: 2500,
    maxAltitudeFt: 11800,
    typicalHours: 6,
    packWeightLb: 8,
    terrainGrade: "moderate",
    notes:
      "Great non-technical day beneath the Diamond of Longs Peak. Alpine environment — layers required.",
    sources: ["NPS.gov RMNP"],
  },

  // ────── Glacier NP ──────
  {
    slug: "highline-glacier",
    name: "Highline Trail (Logan Pass → The Loop)",
    region: "Glacier NP · MT",
    country: "US",
    distanceKm: 19,
    elevationGainFt: 800,
    maxAltitudeFt: 7280,
    typicalHours: 6,
    packWeightLb: 8,
    terrainGrade: "moderate",
    notes:
      "One-way traverse under the Garden Wall. Requires shuttle back. Exposed cliff hand-cable section near the start — brief but memorable.",
    sources: ["NPS.gov Glacier"],
  },
  {
    slug: "grinnell-glacier",
    name: "Grinnell Glacier",
    region: "Glacier NP · MT",
    country: "US",
    distanceKm: 17,
    elevationGainFt: 1600,
    maxAltitudeFt: 6500,
    typicalHours: 7,
    packWeightLb: 8,
    terrainGrade: "moderate",
    notes:
      "One of the last remaining glaciers in the park (rapidly retreating). Boat shuttle option shortens to ~11 km.",
    sources: ["NPS.gov Glacier"],
  },
  {
    slug: "iceberg-lake",
    name: "Iceberg Lake",
    region: "Glacier NP · MT",
    country: "US",
    distanceKm: 15.6,
    elevationGainFt: 1275,
    maxAltitudeFt: 6100,
    typicalHours: 5,
    packWeightLb: 6,
    terrainGrade: "moderate",
    notes:
      "Icebergs float in the lake into August. Grizzly country — carry bear spray, hike in groups.",
    sources: ["NPS.gov Glacier"],
  },

  // ────── Acadia NP ──────
  {
    slug: "precipice-trail",
    name: "Precipice Trail",
    region: "Acadia NP · ME",
    country: "US",
    distanceKm: 3.4,
    elevationGainFt: 1000,
    maxAltitudeFt: 1058,
    typicalHours: 3,
    packWeightLb: 3,
    terrainGrade: "technical",
    notes:
      "Iron rungs and cliff ladders up the east face of Champlain Mountain. Not for fear of heights. Closes seasonally for peregrine falcon nesting.",
    sources: ["NPS.gov Acadia"],
  },
  {
    slug: "beehive-loop",
    name: "Beehive Loop",
    region: "Acadia NP · ME",
    country: "US",
    distanceKm: 2.3,
    elevationGainFt: 500,
    maxAltitudeFt: 520,
    typicalHours: 2,
    packWeightLb: 3,
    terrainGrade: "technical",
    notes:
      "Short but memorable — iron rungs and narrow ledges above Sand Beach. Descend via Bowl Trail for the loop.",
    sources: ["NPS.gov Acadia"],
  },

  // ────── Utah non-Zion ──────
  {
    slug: "delicate-arch",
    name: "Delicate Arch",
    region: "Arches NP · UT",
    country: "US",
    distanceKm: 4.8,
    elevationGainFt: 480,
    maxAltitudeFt: 4830,
    typicalHours: 2,
    packWeightLb: 3,
    terrainGrade: "easy",
    notes:
      "Iconic Utah symbol. Slickrock traverse, little shade. Sunset is stunning but crowded.",
    sources: ["NPS.gov Arches"],
  },
  {
    slug: "devils-garden-loop",
    name: "Devils Garden Primitive Loop",
    region: "Arches NP · UT",
    country: "US",
    distanceKm: 12.7,
    elevationGainFt: 1085,
    maxAltitudeFt: 5200,
    typicalHours: 5,
    packWeightLb: 6,
    terrainGrade: "moderate",
    notes:
      "Eight named arches on one loop. Primitive section requires route-finding on slickrock. Carry 3+ L water.",
    sources: ["NPS.gov Arches"],
  },
  {
    slug: "chesler-park-loop",
    name: "Chesler Park & Joint Trail Loop",
    region: "Canyonlands NP · UT",
    country: "US",
    distanceKm: 17.7,
    elevationGainFt: 1500,
    maxAltitudeFt: 6300,
    typicalHours: 7,
    packWeightLb: 8,
    terrainGrade: "moderate",
    notes:
      "Needles district classic — spires, slot canyon (Joint), remote feel. 4WD to trailhead. Carry all water.",
    sources: ["NPS.gov Canyonlands"],
  },

  // ────── East Coast icons ──────
  {
    slug: "old-rag",
    name: "Old Rag Mountain Loop",
    region: "Shenandoah NP · VA",
    country: "US",
    distanceKm: 14.6,
    elevationGainFt: 2400,
    maxAltitudeFt: 3268,
    typicalHours: 6,
    packWeightLb: 6,
    terrainGrade: "technical",
    notes:
      "Rock scramble section requires using hands — small crevices and squeezes. Day-use ticket required.",
    sources: ["NPS.gov Shenandoah"],
  },
  {
    slug: "alum-cave-leconte",
    name: "Alum Cave to Mt. LeConte",
    region: "Great Smoky Mtns · TN",
    country: "US",
    distanceKm: 17.7,
    elevationGainFt: 3000,
    maxAltitudeFt: 6593,
    typicalHours: 7,
    packWeightLb: 8,
    terrainGrade: "moderate",
    notes:
      "Steepest route to LeConte Lodge (third-highest peak in Great Smokies). Cables on wet rock sections.",
    sources: ["NPS.gov Great Smoky"],
  },
  {
    slug: "franconia-ridge",
    name: "Franconia Ridge Loop",
    region: "White Mtns · NH",
    country: "US",
    distanceKm: 14.3,
    elevationGainFt: 3900,
    maxAltitudeFt: 5260,
    typicalHours: 8,
    packWeightLb: 8,
    terrainGrade: "technical",
    notes:
      "Above-treeline traverse of three 4000-footers. Fully exposed for ~2 miles — turn back if weather changes.",
    sources: ["Wikipedia", "AMC guidebook"],
  },
  {
    slug: "mt-washington-tuckerman",
    name: "Mt. Washington via Tuckerman Ravine",
    region: "White Mtns · NH",
    country: "US",
    distanceKm: 13.5,
    elevationGainFt: 4250,
    maxAltitudeFt: 6288,
    typicalHours: 7,
    packWeightLb: 8,
    terrainGrade: "technical",
    notes:
      "Home of the world's worst weather. Above-treeline hypothermia in summer possible. Check summit forecast; turn back for wind >40 mph.",
    sources: ["Wikipedia", "Mt Washington Observatory"],
  },
  {
    slug: "katahdin-knife-edge",
    name: "Katahdin via Knife Edge",
    region: "Baxter SP · ME",
    country: "US",
    distanceKm: 19,
    elevationGainFt: 4200,
    maxAltitudeFt: 5267,
    typicalHours: 10,
    packWeightLb: 8,
    terrainGrade: "technical",
    notes:
      "One-mile knife-edge ridge with 1000 ft drops both sides. Northern terminus of the AT. Weather-gated — rangers close it for wind/lightning.",
    sources: ["Baxter State Park", "Wikipedia"],
  },

  // ────── PNW day-hikes ──────
  {
    slug: "mailbox-peak-new",
    name: "Mailbox Peak (New Trail)",
    region: "Cascades · WA",
    country: "US",
    distanceKm: 15.1,
    elevationGainFt: 4000,
    maxAltitudeFt: 4822,
    typicalHours: 6,
    packWeightLb: 8,
    terrainGrade: "moderate",
    notes:
      "Rainier training staple. New trail is longer/gentler; the old trail (5.4 mi, same gain) is a leg-crusher classic.",
    sources: ["WA DNR", "Washington Trails Association"],
  },
  {
    slug: "mt-si",
    name: "Mount Si",
    region: "Cascades · WA",
    country: "US",
    distanceKm: 12.9,
    elevationGainFt: 3150,
    maxAltitudeFt: 3900,
    typicalHours: 5,
    packWeightLb: 6,
    terrainGrade: "moderate",
    notes:
      "Seattle-area training standard. Class 3 scramble to Haystack summit optional. Very popular — parking fills early.",
    sources: ["WA DNR"],
  },
  {
    slug: "mt-pilchuck",
    name: "Mount Pilchuck",
    region: "Cascades · WA",
    country: "US",
    distanceKm: 8.7,
    elevationGainFt: 2300,
    maxAltitudeFt: 5341,
    typicalHours: 4,
    packWeightLb: 6,
    terrainGrade: "moderate",
    notes:
      "Fire lookout summit with 360° Cascades views. Rocky boulder scramble near the top.",
    sources: ["Washington Trails Association"],
  },
  {
    slug: "colchuck-lake",
    name: "Colchuck Lake",
    region: "Enchantments · WA",
    country: "US",
    distanceKm: 12.9,
    elevationGainFt: 2280,
    maxAltitudeFt: 5570,
    typicalHours: 5,
    packWeightLb: 8,
    terrainGrade: "moderate",
    notes:
      "Turquoise lake below Dragontail Peak. Extension to Aasgard Pass (+2000 ft, Class 3) is a serious upgrade. Permit for camping.",
    sources: ["USFS", "Washington Trails Association"],
  },

  // ────── Colorado 14ers (accessible) ──────
  {
    slug: "grays-torreys",
    name: "Grays & Torreys Peaks",
    region: "Front Range · CO",
    country: "US",
    distanceKm: 13.3,
    elevationGainFt: 3600,
    maxAltitudeFt: 14278,
    typicalHours: 7,
    packWeightLb: 8,
    terrainGrade: "moderate",
    notes:
      "Two 14ers in one day, Class 1-2. Rough road to trailhead (2WD marginal). Start before dawn; afternoon thunderstorms common in summer.",
    sources: ["Colorado Fourteeners Initiative"],
  },
  {
    slug: "quandary-peak-east",
    name: "Quandary Peak (East Ridge)",
    region: "Tenmile · CO",
    country: "US",
    distanceKm: 10.9,
    elevationGainFt: 3450,
    maxAltitudeFt: 14265,
    typicalHours: 6,
    packWeightLb: 8,
    terrainGrade: "moderate",
    notes:
      "Most popular Colorado 14er. Class 1 straightforward ridge. Timed shuttle for parking. Mountain goats near summit.",
    sources: ["Colorado Fourteeners Initiative"],
  },
  {
    slug: "mount-sherman",
    name: "Mount Sherman",
    region: "Mosquito Range · CO",
    country: "US",
    distanceKm: 8.4,
    elevationGainFt: 2100,
    maxAltitudeFt: 14036,
    typicalHours: 5,
    packWeightLb: 6,
    terrainGrade: "moderate",
    notes:
      "Easiest 14er by distance/gain. Historic mining ruins along the route. Talus scramble in the upper section.",
    sources: ["Colorado Fourteeners Initiative"],
  },

  // ────── Europe day/multi-day ──────
  {
    slug: "ben-nevis",
    name: "Ben Nevis (Mountain Track)",
    region: "Highlands · Scotland",
    country: "GB",
    distanceKm: 17,
    elevationGainFt: 4400,
    maxAltitudeFt: 4413,
    typicalHours: 8,
    packWeightLb: 8,
    terrainGrade: "moderate",
    notes:
      "UK's highest peak. Weather can turn instantly — carry map/compass; summit plateau has fatal cornices in winter. GPS not reliable at top.",
    sources: ["Wikipedia", "John Muir Trust"],
  },
  {
    slug: "snowdon-miners",
    name: "Snowdon (Miners' Track)",
    region: "Eryri · Wales",
    country: "GB",
    distanceKm: 12.9,
    elevationGainFt: 2400,
    maxAltitudeFt: 3560,
    typicalHours: 6,
    packWeightLb: 6,
    terrainGrade: "easy",
    notes:
      "Gentlest of Snowdon's routes. Combine with the Pyg Track for a loop. Snowdon Ranger and Watkin paths are quieter alternatives.",
    sources: ["Wikipedia", "Eryri National Park"],
  },
  {
    slug: "scafell-pike-corridor",
    name: "Scafell Pike (Corridor Route)",
    region: "Lake District · England",
    country: "GB",
    distanceKm: 15,
    elevationGainFt: 3200,
    maxAltitudeFt: 3209,
    typicalHours: 7,
    packWeightLb: 6,
    terrainGrade: "moderate",
    notes:
      "England's highest. Corridor from Seathwaite is more scenic than the tourist route from Wasdale. Bad in cloud — carry map/compass.",
    sources: ["Wikipedia", "Lake District NP"],
  },
  {
    slug: "helvellyn-striding-edge",
    name: "Helvellyn via Striding Edge",
    region: "Lake District · England",
    country: "GB",
    distanceKm: 13,
    elevationGainFt: 2500,
    maxAltitudeFt: 3117,
    typicalHours: 6,
    packWeightLb: 6,
    terrainGrade: "technical",
    notes:
      "Classic UK ridge scramble. Not for beginners or those uncomfortable with exposure. Winter conditions are alpine — ice axe/crampons needed.",
    sources: ["Wikipedia"],
  },
  {
    slug: "zugspitze-hoellental",
    name: "Zugspitze via Höllental",
    region: "Bavarian Alps · Germany",
    country: "DE",
    distanceKm: 22,
    elevationGainFt: 7500,
    maxAltitudeFt: 9718,
    typicalHours: 12,
    packWeightLb: 15,
    terrainGrade: "technical",
    notes:
      "Germany's highest. Via ferrata sections and a glacier crossing. Usually done as 2-day with Höllentalanger Hütte. Cable-car descent option.",
    sources: ["Wikipedia", "DAV"],
  },
  {
    slug: "triglav-krma",
    name: "Triglav via Krma Valley",
    region: "Julian Alps · Slovenia",
    country: "SI",
    distanceKm: 22,
    elevationGainFt: 6900,
    maxAltitudeFt: 9396,
    typicalHours: 12,
    packWeightLb: 12,
    terrainGrade: "technical",
    notes:
      "Slovenia's highest. Via ferrata (steel cables) on the summit ridge — helmet, harness, via ferrata set recommended. Typically 2 days with a hut stay.",
    sources: ["Wikipedia"],
  },

  // ────── Himalaya (Nepal + India) ──────
  {
    slug: "annapurna-base-camp",
    name: "Annapurna Base Camp Trek",
    region: "Annapurna · Nepal",
    country: "NP",
    distanceKm: 115,
    elevationGainFt: 30000,
    maxAltitudeFt: 13550,
    typicalHours: 7,
    packWeightLb: 15,
    terrainGrade: "moderate",
    notes:
      "7-12 day trek. Longest single day 6-8h. Teahouse trekking (no camping needed). Porter/guide common. Altitude sickness possible above 3000 m.",
    sources: ["Wikipedia", "Nepal Tourism Board"],
  },
  {
    slug: "annapurna-circuit",
    name: "Annapurna Circuit (Thorong La)",
    region: "Annapurna · Nepal",
    country: "NP",
    distanceKm: 160,
    elevationGainFt: 45000,
    maxAltitudeFt: 17769,
    typicalHours: 10,
    packWeightLb: 15,
    terrainGrade: "technical",
    notes:
      "15-20 day trek. Thorong La (5416 m) is the crux — 10h summit day. Serious altitude — plan 2+ rest/acclimatization days. Best Oct-Nov.",
    sources: ["Wikipedia", "Nepal Tourism Board"],
  },
  {
    slug: "poon-hill",
    name: "Ghorepani-Poon Hill Trek",
    region: "Annapurna · Nepal",
    country: "NP",
    distanceKm: 32,
    elevationGainFt: 6500,
    maxAltitudeFt: 10531,
    typicalHours: 5,
    packWeightLb: 10,
    terrainGrade: "easy",
    notes:
      "3-4 day trek. Introduction to Himalayan trekking with Annapurna sunrise views. Suitable for first-timers. No permits beyond TIMS/ACAP.",
    sources: ["Wikipedia"],
  },
  {
    slug: "langtang-valley",
    name: "Langtang Valley Trek",
    region: "Langtang · Nepal",
    country: "NP",
    distanceKm: 65,
    elevationGainFt: 15000,
    maxAltitudeFt: 12700,
    typicalHours: 6,
    packWeightLb: 15,
    terrainGrade: "moderate",
    notes:
      "7-day multi-day trek. Optional Kyanjin Ri (4773 m) day hike from Kyanjin Gompa. Rebuilding since 2015 earthquake — support local teahouses.",
    sources: ["Wikipedia", "Nepal Tourism Board"],
  },
  {
    slug: "roopkund",
    name: "Roopkund Trek",
    region: "Uttarakhand · India",
    country: "IN",
    distanceKm: 55,
    elevationGainFt: 12000,
    maxAltitudeFt: 16000,
    typicalHours: 7,
    packWeightLb: 15,
    terrainGrade: "technical",
    notes:
      "8-day multi-day trek. The mystery lake with skeletons. Summit day is technical snow slope — trekking has been restricted at times. Best May-Jun and Sep-Oct.",
    sources: ["Wikipedia"],
  },
  {
    slug: "kedarkantha",
    name: "Kedarkantha Trek",
    region: "Uttarakhand · India",
    country: "IN",
    distanceKm: 22,
    elevationGainFt: 4000,
    maxAltitudeFt: 12500,
    typicalHours: 5,
    packWeightLb: 12,
    terrainGrade: "easy",
    notes:
      "4-5 day multi-day trek. Popular beginner winter Himalayan trek — deep snow Dec-Mar. Base at Sankri village. Summit push starts pre-dawn.",
    sources: ["Wikipedia"],
  },
  {
    slug: "valley-of-flowers",
    name: "Valley of Flowers",
    region: "Uttarakhand · India",
    country: "IN",
    distanceKm: 22,
    elevationGainFt: 2500,
    maxAltitudeFt: 12000,
    typicalHours: 5,
    packWeightLb: 10,
    terrainGrade: "easy",
    notes:
      "5-6 day multi-day trek including Hemkund Sahib. UNESCO site — wildflower bloom Jul-Aug. Steady walk, no technical sections.",
    sources: ["Wikipedia", "UNESCO"],
  },
  {
    slug: "chandrashila",
    name: "Chandrashila (Tungnath)",
    region: "Uttarakhand · India",
    country: "IN",
    distanceKm: 8,
    elevationGainFt: 2400,
    maxAltitudeFt: 13000,
    typicalHours: 5,
    packWeightLb: 5,
    terrainGrade: "moderate",
    notes:
      "Short but high day hike. Tungnath temple at 3680 m. Snow in winter — micro-spikes helpful. Chopta base makes it a weekend outing.",
    sources: ["Wikipedia"],
  },

  // ────── Africa ──────
  {
    slug: "mt-kenya-lenana",
    name: "Mt. Kenya (Point Lenana)",
    region: "Mt Kenya NP · Kenya",
    country: "KE",
    distanceKm: 45,
    elevationGainFt: 12000,
    maxAltitudeFt: 16355,
    typicalHours: 8,
    packWeightLb: 15,
    terrainGrade: "moderate",
    notes:
      "4-5 day multi-day trek. Trekking peak (not technical) — the technical summits (Batian, Nelion) require alpine climbing. Sirimon route is most popular.",
    sources: ["Wikipedia", "Kenya Wildlife Service"],
  },
  {
    slug: "mt-meru",
    name: "Mt. Meru",
    region: "Arusha NP · Tanzania",
    country: "TZ",
    distanceKm: 45,
    elevationGainFt: 12000,
    maxAltitudeFt: 14980,
    typicalHours: 8,
    packWeightLb: 15,
    terrainGrade: "moderate",
    notes:
      "3-4 day multi-day trek. Excellent Kilimanjaro acclimatization warmup. Armed ranger required (wildlife). Summit day ~14h.",
    sources: ["Wikipedia", "TANAPA"],
  },
  {
    slug: "toubkal-summer",
    name: "Toubkal (Summer)",
    region: "Atlas Mtns · Morocco",
    country: "MA",
    distanceKm: 25,
    elevationGainFt: 8000,
    maxAltitudeFt: 13671,
    typicalHours: 8,
    packWeightLb: 12,
    terrainGrade: "moderate",
    notes:
      "2-day multi-day trek. N. Africa's highest peak. Refuge stay at 3200 m breaks the ascent. Winter route requires crampons/ice axe.",
    sources: ["Wikipedia"],
  },
  {
    slug: "table-mtn-platteklip",
    name: "Table Mountain (Platteklip Gorge)",
    region: "Cape Town · South Africa",
    country: "ZA",
    distanceKm: 6,
    elevationGainFt: 2300,
    maxAltitudeFt: 3560,
    typicalHours: 3,
    packWeightLb: 4,
    terrainGrade: "moderate",
    notes:
      "Direct steep route to Table Mountain summit. Sun-exposed; start early or late. Cable-car descent is a bailout option.",
    sources: ["Wikipedia", "SANParks"],
  },

  // ────── South America ──────
  {
    slug: "tdp-w-circuit",
    name: "Torres del Paine — W Circuit",
    region: "Patagonia · Chile",
    country: "CL",
    distanceKm: 80,
    elevationGainFt: 15000,
    maxAltitudeFt: 3800,
    typicalHours: 6,
    packWeightLb: 25,
    terrainGrade: "moderate",
    notes:
      "4-5 day multi-day trek. Refugio + camping stops. Weather is the main challenge — Patagonian wind is legitimate. Book refugios months ahead.",
    sources: ["Wikipedia", "CONAF"],
  },
  {
    slug: "tdp-base-towers",
    name: "Torres del Paine — Base of Towers",
    region: "Patagonia · Chile",
    country: "CL",
    distanceKm: 22,
    elevationGainFt: 3000,
    maxAltitudeFt: 3050,
    typicalHours: 9,
    packWeightLb: 8,
    terrainGrade: "moderate",
    notes:
      "The iconic day hike from Hotel Las Torres. Final moraine to the towers is steep boulder. Weather rules the day.",
    sources: ["Wikipedia", "CONAF"],
  },
  {
    slug: "fitz-roy-laguna",
    name: "Fitz Roy — Laguna de los Tres",
    region: "Patagonia · Argentina",
    country: "AR",
    distanceKm: 20,
    elevationGainFt: 2900,
    maxAltitudeFt: 3970,
    typicalHours: 8,
    packWeightLb: 8,
    terrainGrade: "moderate",
    notes:
      "Iconic day hike from El Chaltén. Last km is steep 400 m gain to the laguna. Clear-weather views are worth the trip.",
    sources: ["Wikipedia"],
  },
  {
    slug: "inca-trail",
    name: "Inca Trail to Machu Picchu",
    region: "Cusco · Peru",
    country: "PE",
    distanceKm: 43,
    elevationGainFt: 12000,
    maxAltitudeFt: 13780,
    typicalHours: 7,
    packWeightLb: 15,
    terrainGrade: "moderate",
    notes:
      "4-day multi-day trek. Permit-limited (500/day, book months ahead). Dead Woman's Pass (day 2) is the crux. Porters carry group gear.",
    sources: ["Wikipedia", "Peru Ministry of Culture"],
  },
  {
    slug: "cotopaxi-normal",
    name: "Cotopaxi (Normal Route)",
    region: "Andes · Ecuador",
    country: "EC",
    distanceKm: 12,
    elevationGainFt: 2000,
    maxAltitudeFt: 19347,
    typicalHours: 8,
    packWeightLb: 20,
    terrainGrade: "mountaineering",
    notes:
      "Summit day from refuge at 15,800 ft. Glacier travel — rope, crampons, ice axe required. Volcanic activity has closed it periodically.",
    sources: ["Wikipedia"],
  },

  // ────── NZ / Australia ──────
  {
    slug: "tongariro-crossing",
    name: "Tongariro Alpine Crossing",
    region: "Tongariro NP · New Zealand",
    country: "NZ",
    distanceKm: 19.4,
    elevationGainFt: 2600,
    maxAltitudeFt: 6265,
    typicalHours: 7,
    packWeightLb: 8,
    terrainGrade: "moderate",
    notes:
      "One-way volcanic-terrain traverse. Emerald Lakes and Red Crater are the highlights. Shuttle required. Very exposed — weather can shut it down.",
    sources: ["Wikipedia", "DOC NZ"],
  },
  {
    slug: "mueller-hut",
    name: "Mueller Hut Route",
    region: "Aoraki/Mt Cook NP · NZ",
    country: "NZ",
    distanceKm: 10,
    elevationGainFt: 3400,
    maxAltitudeFt: 5942,
    typicalHours: 8,
    packWeightLb: 15,
    terrainGrade: "moderate",
    notes:
      "Steep ascent to alpine hut with views of Aoraki. Often done overnight. Snowfield above Sealy Tarns can require ice axe/crampons out of summer.",
    sources: ["DOC NZ"],
  },
  {
    slug: "milford-track",
    name: "Milford Track",
    region: "Fiordland NP · NZ",
    country: "NZ",
    distanceKm: 53.5,
    elevationGainFt: 5200,
    maxAltitudeFt: 3800,
    typicalHours: 6,
    packWeightLb: 25,
    terrainGrade: "moderate",
    notes:
      "4-day multi-day trek. NZ's most famous Great Walk. Fiord terrain — rain often. Bookings open 6 months ahead and sell out in minutes.",
    sources: ["Wikipedia", "DOC NZ"],
  },
  {
    slug: "overland-track",
    name: "Overland Track",
    region: "Cradle Mountain-Lake St Clair · Tasmania",
    country: "AU",
    distanceKm: 82,
    elevationGainFt: 8000,
    maxAltitudeFt: 3400,
    typicalHours: 7,
    packWeightLb: 30,
    terrainGrade: "moderate",
    notes:
      "6-day multi-day trek. Tasmania's premier hike. Full self-support required — food, stove, tent (huts fill fast). Weather can be brutal any season.",
    sources: ["Wikipedia", "Tasmania PWS"],
  },
];

// Dedupe on read — the seed data has a few accidental duplicate slugs
// (grays-torreys, katahdin-knife-edge, inca-trail appear twice with
// slightly different metadata). Keep the first occurrence so we have
// one entry per slug across the app. Merging the underlying array
// entries is a manual editorial pass; this ensures the UI never
// double-lists the same trail in the meantime.
const DEDUPED_LIBRARY: TrailPreset[] = (() => {
  const seen = new Set<string>();
  const out: TrailPreset[] = [];
  for (const t of TRAIL_LIBRARY) {
    if (seen.has(t.slug)) continue;
    seen.add(t.slug);
    out.push(t);
  }
  return out;
})();

export function searchTrails(query: string): TrailPreset[] {
  const q = query.trim().toLowerCase();
  if (!q) return DEDUPED_LIBRARY;
  const words = q.split(/\s+/).filter(Boolean);
  return DEDUPED_LIBRARY.filter((t) => {
    const haystack = `${t.name} ${t.region} ${t.country}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}

export function findTrailBySlug(slug: string): TrailPreset | undefined {
  return DEDUPED_LIBRARY.find((t) => t.slug === slug);
}

/** Deduped view for consumers that iterate the whole library. */
export function allTrails(): TrailPreset[] {
  return DEDUPED_LIBRARY;
}
