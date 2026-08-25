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
  },
  "breakneck-ridge": {
    routeShape: "loop",
    bestMonths: ["Apr", "May", "Jun", "Sep", "Oct", "Nov"],
    waterOnRoute: "None — carry 2 L.",
    permitRequired: false,
    permitNotes: "No fee. Metro-North Cold Spring / Beacon.",
    cellReception: "reliable",
    parkingNotes: "Roadside on Rt-9D fills fast; train station is better.",
    steepestGradePct: 50,
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
  };
}
