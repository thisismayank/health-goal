/**
 * Hand-curated Tier A trail details keyed by preset slug.
 *
 * The base TrailPreset (trail-library.ts) has the deterministic
 * metrics we score against — distance, elevation gain, max altitude,
 * terrain grade. This overlay adds the qualitative stuff that
 * matters to a person planning the trip: when to go, whether they
 * need a permit, water on the route, cell reception, parking. Sits
 * separate from the library so a content pass doesn't have to
 * bisect a 1500-line file.
 *
 * Applied by getFullTrailLibrary() — see trail-coords.ts, which
 * already does the same overlay pattern for lat/lng.
 *
 * Sources: NPS.gov permit pages, AllTrails recent reviews, guidebook
 * consensus. Fields are optional per trail — nothing shows when
 * nothing is set.
 */

import type { TrailPreset } from "./trail-library";

type DetailFields = Partial<
  Pick<
    TrailPreset,
    | "steepestGradePct"
    | "routeShape"
    | "bestMonths"
    | "waterOnRoute"
    | "permitRequired"
    | "permitNotes"
    | "cellReception"
    | "parkingNotes"
    | "photoUrl"
    | "photoAttribution"
  >
>;

export const TRAIL_DETAILS: Record<string, DetailFields> = {
  // ────── Rainier area ──────
  "rainier-dc": {
    routeShape: "out_and_back",
    bestMonths: ["May", "Jun", "Jul", "Aug"],
    waterOnRoute: "Snowmelt at Camp Muir; carry all above.",
    permitRequired: true,
    permitNotes:
      "$60 climbing pass + NPS entrance. Guide-service permits (RMI/IMG/AAI) include this.",
    cellReception: "patchy",
    parkingNotes:
      "Paradise lot fills by 8am on weekends. Overflow at Longmire, shuttle mid-summer.",
    steepestGradePct: 40,
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Rainier20200906.jpg/500px-Rainier20200906.jpg",
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  "rainier-emmons": {
    routeShape: "out_and_back",
    bestMonths: ["Jun", "Jul", "Aug"],
    waterOnRoute: "Glacier melt at Camp Schurman; treat everything.",
    permitRequired: true,
    permitNotes:
      "$60 climbing pass + NPS entrance. Fewer guide services here than DC.",
    cellReception: "none",
    parkingNotes: "White River trailhead — road opens late-June.",
    steepestGradePct: 35,
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Mount_Rainier_6909h.JPG/500px-Mount_Rainier_6909h.JPG",
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  "skyline-paradise": {
    routeShape: "loop",
    bestMonths: ["Jul", "Aug", "Sep"],
    waterOnRoute: "Streams above Paradise Inn in summer; none in snow.",
    permitRequired: false,
    permitNotes: "$30 NPS 7-day entrance pass.",
    cellReception: "patchy",
    parkingNotes: "Paradise lot fills by 10am summer weekends.",
    steepestGradePct: 22,
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Mount_Rainier_National_Park_-_53024017635.jpg/500px-Mount_Rainier_National_Park_-_53024017635.jpg",
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  // ────── Rainier NP content-pass day/training hikes ──────
  "naches-peak-loop": {
    routeShape: "loop",
    bestMonths: ["Jul", "Aug", "Sep"],
    waterOnRoute: "Dewey Lake at midpoint (treat); no potable water.",
    permitRequired: false,
    permitNotes: "$30 NPS 7-day entrance pass.",
    cellReception: "patchy",
    parkingNotes: "Tipsoo Lake / Chinook Pass — small lot, arrive early.",
    steepestGradePct: 10,
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Naches_Peak_from_Highway_410_switchbacks.jpg/500px-Naches_Peak_from_Highway_410_switchbacks.jpg",
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  "tolmie-peak-lookout": {
    routeShape: "out_and_back",
    bestMonths: ["Jul", "Aug", "Sep"],
    waterOnRoute: "Eunice Lake (treat).",
    permitRequired: false,
    permitNotes: "$30 NPS pass; Mowich Rd is gravel — high-clearance helps.",
    cellReception: "none",
    parkingNotes: "Mowich Lake lot; road closes late-Oct until mid-July.",
    steepestGradePct: 18,
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Tolmie_Peak.jpg/500px-Tolmie_Peak.jpg",
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  "comet-falls": {
    routeShape: "out_and_back",
    bestMonths: ["Jul", "Aug", "Sep"],
    waterOnRoute: "Van Trump Creek near the falls (treat).",
    permitRequired: false,
    permitNotes: "$30 NPS pass.",
    cellReception: "none",
    parkingNotes: "Christine Falls TH, mile 4.4 on Paradise Rd — small lot.",
    steepestGradePct: 20,
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Comet_Falls_%2895ee215cf0334ec3ba1168be837570be%29.JPG/500px-Comet_Falls_%2895ee215cf0334ec3ba1168be837570be%29.JPG",
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  "burroughs-mountain-2nd": {
    routeShape: "out_and_back",
    bestMonths: ["Aug", "Sep"],
    waterOnRoute: "None — carry 2 L. Snowmelt cornices unreliable.",
    permitRequired: false,
    permitNotes: "$30 NPS pass; Sunrise Rd opens ~July 4 conditions permitting.",
    cellReception: "patchy",
    parkingNotes: "Sunrise Visitor Center; fills before 10am on clear weekends.",
    steepestGradePct: 25,
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Burroughs_Mountain_from_east.jpg/500px-Burroughs_Mountain_from_east.jpg",
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  "fremont-lookout": {
    routeShape: "out_and_back",
    bestMonths: ["Jul", "Aug", "Sep"],
    waterOnRoute: "None — carry 2 L.",
    permitRequired: false,
    permitNotes: "$30 NPS pass.",
    cellReception: "patchy",
    parkingNotes: "Same as Burroughs — Sunrise lot; overflow at White River.",
    steepestGradePct: 15,
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Mount_Fremont_in_Mount_Rainier_National_Park.jpg/500px-Mount_Fremont_in_Mount_Rainier_National_Park.jpg",
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  "rampart-ridge-loop": {
    routeShape: "loop",
    bestMonths: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
    waterOnRoute: "None — carry 1 L.",
    permitRequired: false,
    permitNotes: "$30 NPS pass.",
    cellReception: "patchy",
    parkingNotes: "Longmire lot — reliable parking most days.",
    steepestGradePct: 18,
  },
  "camp-muir-dayhike": {
    routeShape: "out_and_back",
    bestMonths: ["Jun", "Jul", "Aug"],
    waterOnRoute: "Snowmelt from ~Pebble Creek up; treat everything.",
    permitRequired: false,
    permitNotes:
      "$30 NPS pass. If continuing to summit, $60 climbing pass + register at ranger station.",
    cellReception: "patchy",
    parkingNotes: "Paradise lot; fills by 8am on clear summer weekends.",
    steepestGradePct: 35,
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/RMI_buildings_on_the_west_side_of_Camp_Muir_%286_October_2024%29.jpg/500px-RMI_buildings_on_the_west_side_of_Camp_Muir_%286_October_2024%29.jpg",
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  "pinnacle-peak-saddle": {
    routeShape: "out_and_back",
    bestMonths: ["Jul", "Aug", "Sep"],
    waterOnRoute: "None — carry 1 L.",
    permitRequired: false,
    permitNotes: "$30 NPS pass.",
    cellReception: "patchy",
    parkingNotes: "Reflection Lake pullout — very limited, share the road.",
    steepestGradePct: 30,
  },
  summerland: {
    routeShape: "out_and_back",
    bestMonths: ["Jul", "Aug", "Sep"],
    waterOnRoute: "Fryingpan Creek along most of the ascent (treat).",
    permitRequired: false,
    permitNotes: "$30 NPS pass; overnight requires wilderness permit.",
    cellReception: "none",
    parkingNotes: "Fryingpan Creek TH on Rt 410; small roadside lot.",
    steepestGradePct: 18,
  },
  "silver-falls-loop": {
    routeShape: "loop",
    bestMonths: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"],
    waterOnRoute: "Ohanapecosh River adjacent (treat).",
    permitRequired: false,
    permitNotes: "$30 NPS pass.",
    cellReception: "none",
    parkingNotes: "Ohanapecosh campground / visitor center — plenty of space.",
    steepestGradePct: 8,
  },

  // ────── Expedition ──────
  "denali-west-buttress": {
    routeShape: "out_and_back",
    bestMonths: ["May", "Jun"],
    waterOnRoute: "Melt snow at every camp; carry stove.",
    permitRequired: true,
    permitNotes:
      "$390 NPS mountaineering fee + register 60 days out. Guided ~$10k.",
    cellReception: "none",
    parkingNotes: "Fly-in from Talkeetna — no drive access.",
    steepestGradePct: 55,
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Wonder_Lake_and_Denali.jpg/500px-Wonder_Lake_and_Denali.jpg",
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  "kilimanjaro-machame": {
    routeShape: "point_to_point",
    bestMonths: ["Jan", "Feb", "Jun", "Jul", "Aug", "Sep"],
    waterOnRoute: "Porters carry / provide throughout; treat side streams.",
    permitRequired: true,
    permitNotes:
      "Only via TANAPA-licensed operator; ~$2-4k all-in for 7 days.",
    cellReception: "patchy",
    parkingNotes: "Machame Gate — operator handles transfer.",
    steepestGradePct: 30,
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Kilimanjaro_from_Amboseli.jpg/500px-Kilimanjaro_from_Amboseli.jpg",
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  "ebc-trek": {
    routeShape: "out_and_back",
    bestMonths: ["Mar", "Apr", "May", "Oct", "Nov"],
    waterOnRoute: "Teahouses every 1-2h; boiled/bottled available.",
    permitRequired: true,
    permitNotes:
      "Sagarmatha NP permit (~$30) + Khumbu rural municipality fee (~$20). No TIMS since 2023.",
    cellReception: "patchy",
    parkingNotes: "Fly Lukla — book 2-3 months out for peak season.",
    steepestGradePct: 25,
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Khumbutse.jpg/500px-Khumbutse.jpg",
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  "wonderland-trail": {
    routeShape: "loop",
    bestMonths: ["Jul", "Aug", "Sep"],
    waterOnRoute: "Reliable creeks every few miles; treat everything.",
    permitRequired: true,
    permitNotes:
      "Wilderness permit lottery in March; walk-ups possible mid-week off-season.",
    cellReception: "none",
    parkingNotes:
      "Longmire, White River, or Mowich Lake — depends on itinerary direction.",
    steepestGradePct: 30,
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/CowlitzDivide.JPG/500px-CowlitzDivide.JPG",
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },

  // ────── Day / weekend ──────
  "angels-landing": {
    routeShape: "out_and_back",
    bestMonths: ["Mar", "Apr", "May", "Sep", "Oct", "Nov"],
    waterOnRoute: "None — carry 2+ L.",
    permitRequired: true,
    permitNotes:
      "Angels Landing hike permit required since 2022 — lottery via recreation.gov.",
    cellReception: "patchy",
    parkingNotes: "Zion shuttle only — no private car in-canyon.",
    steepestGradePct: 45,
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Angels_Landing_-_Zion_Canyon.jpg/500px-Angels_Landing_-_Zion_Canyon.jpg",
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  "whitney-dayhike": {
    routeShape: "out_and_back",
    bestMonths: ["Jul", "Aug", "Sep"],
    waterOnRoute: "Streams to Trail Camp (~12,000 ft); carry above.",
    permitRequired: true,
    permitNotes:
      "Day-hike permit via recreation.gov lottery in February. Overnight is separate + harder.",
    cellReception: "none",
    parkingNotes: "Whitney Portal — arrive night before to acclimate.",
    steepestGradePct: 25,
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Mount_Whitney_2003-03-25.jpg/500px-Mount_Whitney_2003-03-25.jpg",
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  "bear-mountain-loop": {
    routeShape: "loop",
    bestMonths: ["Apr", "May", "Jun", "Sep", "Oct", "Nov"],
    waterOnRoute: "None — carry 2 L in summer.",
    permitRequired: false,
    permitNotes: "$10 state park entrance.",
    cellReception: "reliable",
    parkingNotes: "Bear Mtn Inn lot fills by 10am weekends; go early.",
    steepestGradePct: 30,
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/View_from_Bear_Mountain_overlooking_Hudson_River.jpg/500px-View_from_Bear_Mountain_overlooking_Hudson_River.jpg",
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },
  // breakneck-ridge photo added just below
  "breakneck-ridge": {
    routeShape: "loop",
    bestMonths: ["Apr", "May", "Jun", "Sep", "Oct", "Nov"],
    waterOnRoute: "None — carry 2 L.",
    permitRequired: false,
    permitNotes: "No fee. Metro-North Cold Spring / Beacon.",
    cellReception: "reliable",
    parkingNotes: "Roadside on Rt-9D fills fast; train station is better.",
    steepestGradePct: 50,
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Breakneck_Ridge.jpg/500px-Breakneck_Ridge.jpg",
    photoAttribution: "Wikimedia Commons · CC BY-SA",
  },

  // ────── NYC-area content-pass Tier A overlays ──────
  "anthonys-nose": {
    routeShape: "out_and_back",
    bestMonths: ["Apr", "May", "Jun", "Sep", "Oct", "Nov"],
    waterOnRoute: "None — carry 1 L.",
    permitRequired: false,
    permitNotes: "No fee. Park at Bear Mtn Bridge on Rt 6/202.",
    cellReception: "reliable",
    parkingNotes: "Small roadside lot at the AT crossing; fills by 9am weekends.",
    steepestGradePct: 25,
  },
  "popolopen-torne": {
    routeShape: "loop",
    bestMonths: ["Apr", "May", "Jun", "Sep", "Oct", "Nov"],
    waterOnRoute: "Popolopen Creek along the gorge return; treat.",
    permitRequired: false,
    cellReception: "reliable",
    parkingNotes: "Roadside on Mine Rd or the Fort Montgomery lot.",
    steepestGradePct: 30,
  },
  "mount-beacon": {
    routeShape: "out_and_back",
    bestMonths: ["Apr", "May", "Jun", "Sep", "Oct", "Nov"],
    waterOnRoute: "None — carry 2 L.",
    permitRequired: false,
    cellReception: "reliable",
    parkingNotes: "Casino Trail lot; Metro-North Beacon station is 1 mi away.",
    steepestGradePct: 35,
  },
  "storm-king": {
    routeShape: "loop",
    bestMonths: ["Apr", "May", "Jun", "Sep", "Oct", "Nov"],
    waterOnRoute: "None — carry 1 L.",
    permitRequired: false,
    cellReception: "reliable",
    parkingNotes: "Rt 9W pullouts; multiple trailheads.",
    steepestGradePct: 25,
  },
  "the-timp-harriman": {
    routeShape: "loop",
    bestMonths: ["Apr", "May", "Jun", "Sep", "Oct", "Nov"],
    waterOnRoute: "Seasonal streams; treat everything.",
    permitRequired: false,
    cellReception: "patchy",
    parkingNotes: "Anthony Wayne Rec Area lot on Palisades Parkway.",
    steepestGradePct: 22,
  },
  "almost-perpendicular-harriman": {
    routeShape: "loop",
    bestMonths: ["Apr", "May", "Jun", "Sep", "Oct", "Nov"],
    waterOnRoute: "Lake Skannatati at trailhead (treat).",
    permitRequired: false,
    cellReception: "patchy",
    parkingNotes: "Lake Skannatati lot off Seven Lakes Dr.",
    steepestGradePct: 18,
  },

  "overlook-mountain": {
    routeShape: "out_and_back",
    bestMonths: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
    waterOnRoute: "None — carry 2 L.",
    permitRequired: false,
    permitNotes: "Free. Wide gravel road, no wilderness permit needed.",
    cellReception: "patchy",
    parkingNotes: "Meads Mountain Rd lot; fills by 10am summer weekends.",
    steepestGradePct: 15,
  },
  "devils-path": {
    routeShape: "point_to_point",
    bestMonths: ["May", "Jun", "Sep", "Oct"],
    waterOnRoute: "Springs at cols — inconsistent. Carry 3+ L.",
    permitRequired: false,
    permitNotes:
      "No permit; overnight camping requires above 3500-ft restrictions.",
    cellReception: "none",
    parkingNotes:
      "Prediger Rd east / Spruceton west — car shuttle required for full thru.",
    steepestGradePct: 45,
  },
  "wittenberg-cornell-slide": {
    routeShape: "point_to_point",
    bestMonths: ["May", "Jun", "Sep", "Oct"],
    waterOnRoute: "Springs on Wittenberg + Cornell (treat).",
    permitRequired: false,
    cellReception: "none",
    parkingNotes: "Woodland Valley east / Slide Mountain west — car shuttle.",
    steepestGradePct: 30,
  },
  "giant-ledge-panther": {
    routeShape: "out_and_back",
    bestMonths: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
    waterOnRoute: "Seasonal streams; treat.",
    permitRequired: false,
    cellReception: "patchy",
    parkingNotes: "Rt 47 (Slide Mtn) lot; small, fills fast.",
    steepestGradePct: 20,
  },
  "hunter-mountain-fire-tower": {
    routeShape: "out_and_back",
    bestMonths: ["May", "Jun", "Sep", "Oct"],
    waterOnRoute: "Springs on lower trail (treat).",
    permitRequired: false,
    cellReception: "patchy",
    parkingNotes: "Spruceton Rd trailhead lot.",
    steepestGradePct: 22,
  },
  "table-peekamoose": {
    routeShape: "point_to_point",
    bestMonths: ["May", "Jun", "Sep", "Oct"],
    waterOnRoute: "Very limited — carry 3 L.",
    permitRequired: false,
    cellReception: "none",
    parkingNotes: "Peekamoose Rd (east) or Denning Rd (west) — car shuttle.",
    steepestGradePct: 30,
  },
  "north-point-escarpment": {
    routeShape: "loop",
    bestMonths: ["Apr", "May", "Jun", "Sep", "Oct", "Nov"],
    waterOnRoute: "None reliable — carry 1 L.",
    permitRequired: false,
    cellReception: "patchy",
    parkingNotes: "North-South Lake Campground; day-use fee May-Oct.",
    steepestGradePct: 20,
  },
  "kaaterskill-falls": {
    routeShape: "out_and_back",
    bestMonths: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"],
    waterOnRoute: "Falls themselves; not for drinking.",
    permitRequired: false,
    cellReception: "patchy",
    parkingNotes: "Laurel House Rd (top) or roadside on Rt 23A (bottom).",
    steepestGradePct: 15,
  },

  "sams-point-ice-caves": {
    routeShape: "loop",
    bestMonths: ["Apr", "May", "Jun", "Sep", "Oct"],
    waterOnRoute: "Verkeerder Falls detour (treat).",
    permitRequired: false,
    permitNotes: "$10 vehicle fee at the gate.",
    cellReception: "patchy",
    parkingNotes: "Sam's Point Preserve lot; caps at ~100 cars.",
    steepestGradePct: 15,
  },
  "bonticou-crag": {
    routeShape: "loop",
    bestMonths: ["Apr", "May", "Jun", "Sep", "Oct"],
    waterOnRoute: "None — carry 1 L.",
    permitRequired: true,
    permitNotes: "Mohonk Preserve day pass required (~$15).",
    cellReception: "patchy",
    parkingNotes: "Spring Farm trailhead — reservation may be required peak season.",
    steepestGradePct: 60,
  },
  "millbrook-mountain": {
    routeShape: "loop",
    bestMonths: ["Apr", "May", "Jun", "Sep", "Oct"],
    waterOnRoute: "Coxing Kill early on the loop (treat).",
    permitRequired: true,
    permitNotes: "Mohonk Preserve day pass required.",
    cellReception: "patchy",
    parkingNotes: "Coxing / West Trapps trailhead.",
    steepestGradePct: 20,
  },

  "sunfish-pond-dwg": {
    routeShape: "out_and_back",
    bestMonths: ["Apr", "May", "Jun", "Sep", "Oct"],
    waterOnRoute: "Dunnfield Creek at start (treat).",
    permitRequired: false,
    cellReception: "patchy",
    parkingNotes: "Dunnfield Creek NRA lot off I-80.",
    steepestGradePct: 18,
  },
  "mount-minsi": {
    routeShape: "loop",
    bestMonths: ["Apr", "May", "Jun", "Sep", "Oct", "Nov"],
    waterOnRoute: "None — carry 1.5 L.",
    permitRequired: false,
    cellReception: "reliable",
    parkingNotes: "Mount Minsi Rd trailhead near Delaware Water Gap village.",
    steepestGradePct: 22,
  },
  "wyanokie-high-point": {
    routeShape: "loop",
    bestMonths: ["Apr", "May", "Jun", "Sep", "Oct", "Nov"],
    waterOnRoute: "Chikahoki Falls (treat).",
    permitRequired: false,
    cellReception: "patchy",
    parkingNotes: "Weis Ecology Center lot.",
    steepestGradePct: 25,
  },
  "pyramid-mountain": {
    routeShape: "loop",
    bestMonths: ["Mar", "Apr", "May", "Jun", "Sep", "Oct", "Nov"],
    waterOnRoute: "Small streams; treat.",
    permitRequired: false,
    cellReception: "reliable",
    parkingNotes: "Boonton Ave visitor center lot.",
    steepestGradePct: 12,
  },

  "sleeping-giant-tower-trail": {
    routeShape: "out_and_back",
    bestMonths: ["Mar", "Apr", "May", "Jun", "Sep", "Oct", "Nov"],
    waterOnRoute: "None — carry 1 L.",
    permitRequired: false,
    permitNotes: "State park entrance may charge in-state $9 / out-of-state $15.",
    cellReception: "reliable",
    parkingNotes: "Main lot off Mt Carmel Ave in Hamden.",
    steepestGradePct: 15,
  },
  "bear-mountain-ct": {
    routeShape: "loop",
    bestMonths: ["May", "Jun", "Sep", "Oct"],
    waterOnRoute: "Sages Ravine (treat).",
    permitRequired: false,
    cellReception: "patchy",
    parkingNotes: "Undermountain trailhead on Rt 41 north of Salisbury.",
    steepestGradePct: 25,
  },

  "algonquin-peak": {
    routeShape: "out_and_back",
    bestMonths: ["Jun", "Jul", "Aug", "Sep"],
    waterOnRoute: "MacIntyre Brook lower down (treat).",
    permitRequired: false,
    permitNotes:
      "Front-country parking at Adirondak Loj requires reservation May-Oct.",
    cellReception: "none",
    parkingNotes: "Adirondak Loj lot — reserve via ADK ~$20/day peak season.",
    steepestGradePct: 32,
  },
  "giant-mountain": {
    routeShape: "out_and_back",
    bestMonths: ["Jun", "Jul", "Aug", "Sep"],
    waterOnRoute: "Roaring Brook near TH (treat).",
    permitRequired: false,
    cellReception: "patchy",
    parkingNotes: "Roaring Brook trailhead on Rt 73.",
    steepestGradePct: 35,
  },
  "ampersand-mountain": {
    routeShape: "out_and_back",
    bestMonths: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
    waterOnRoute: "Ampersand Brook lower down (treat).",
    permitRequired: false,
    cellReception: "patchy",
    parkingNotes: "Rt 3 trailhead lot ~8 mi west of Saranac Lake.",
    steepestGradePct: 30,
  },
  "mount-jo-adk": {
    routeShape: "loop",
    bestMonths: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
    waterOnRoute: "Heart Lake (treat).",
    permitRequired: false,
    permitNotes: "Adirondak Loj parking reservation required.",
    cellReception: "none",
    parkingNotes: "Same as Algonquin — Adirondak Loj lot.",
    steepestGradePct: 25,
  },
};

/**
 * Merge details onto a preset. Called from getFullTrailLibrary()
 * alongside the coord overlay. Detail fields already set on the
 * preset take precedence over the overlay.
 */
export function withDetails(preset: TrailPreset): TrailPreset {
  const overlay = TRAIL_DETAILS[preset.slug];
  if (!overlay) return preset;
  return {
    ...preset,
    steepestGradePct: preset.steepestGradePct ?? overlay.steepestGradePct,
    routeShape: preset.routeShape ?? overlay.routeShape,
    bestMonths: preset.bestMonths ?? overlay.bestMonths,
    waterOnRoute: preset.waterOnRoute ?? overlay.waterOnRoute,
    permitRequired: preset.permitRequired ?? overlay.permitRequired,
    permitNotes: preset.permitNotes ?? overlay.permitNotes,
    cellReception: preset.cellReception ?? overlay.cellReception,
    parkingNotes: preset.parkingNotes ?? overlay.parkingNotes,
    photoUrl: preset.photoUrl ?? overlay.photoUrl,
    photoAttribution: preset.photoAttribution ?? overlay.photoAttribution,
  };
}
