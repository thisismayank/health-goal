/**
 * Session category glyphs — small monochrome line icons for session
 * cards on /train and the cold-start plan preview. Matches Basecamp's
 * terminal aesthetic (thin strokes, uses currentColor for tinting).
 *
 * Grouped into visual families rather than one-per-enum so the eye
 * groups similar work at a glance:
 *
 *   run     — EASY_RUN, QUALITY_RUN
 *   cardio  — ZONE2_CARDIO, CROSS_TRAINING
 *   strength — UPPER_STRENGTH, LOWER_STRENGTH, FULL_BODY_STRENGTH, MOUNTAIN_LEGS
 *   stairs  — STAIRMASTER, INCLINE_TREADMILL
 *   hike    — OUTDOOR_HIKE, LOADED_HIKE, LONG_MOUNTAIN_SESSION
 *   recover — ACTIVE_RECOVERY, MOBILITY
 *   rest    — REST
 *   default — UNKNOWN + fallback
 */

import type { SessionCategory } from "@/db/schema";

type Family =
  | "run"
  | "cardio"
  | "strength"
  | "stairs"
  | "hike"
  | "recover"
  | "rest"
  | "default";

function familyFor(category: SessionCategory): Family {
  switch (category) {
    case "EASY_RUN":
    case "QUALITY_RUN":
      return "run";
    case "ZONE2_CARDIO":
    case "CROSS_TRAINING":
      return "cardio";
    case "UPPER_STRENGTH":
    case "LOWER_STRENGTH":
    case "FULL_BODY_STRENGTH":
    case "MOUNTAIN_LEGS":
      return "strength";
    case "STAIRMASTER":
    case "INCLINE_TREADMILL":
      return "stairs";
    case "OUTDOOR_HIKE":
    case "LOADED_HIKE":
    case "LONG_MOUNTAIN_SESSION":
      return "hike";
    case "ACTIVE_RECOVERY":
    case "MOBILITY":
      return "recover";
    case "REST":
      return "rest";
    default:
      return "default";
  }
}

export function CategoryIcon({
  category,
  className,
}: {
  category: SessionCategory;
  className?: string;
}) {
  const family = familyFor(category);
  const props = {
    className: className ?? "w-4 h-4",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };
  switch (family) {
    case "run":
      // Runner silhouette — abstract, no anatomical detail.
      return (
        <svg {...props}>
          <circle cx="14" cy="5" r="1.6" />
          <path d="M8 21l3-5 4-1-2-5-3 2-4-1" />
          <path d="M14 15l3 3 4-1" />
        </svg>
      );
    case "cardio":
      // Heart + pulse line.
      return (
        <svg {...props}>
          <path d="M12 20s-6-4-8-8a4 4 0 018-2 4 4 0 018 2c-2 4-8 8-8 8z" />
        </svg>
      );
    case "strength":
      // Dumbbell.
      return (
        <svg {...props}>
          <path d="M4 8v8M8 6v12M16 6v12M20 8v8M8 12h8" />
        </svg>
      );
    case "stairs":
      // Ascending steps.
      return (
        <svg {...props}>
          <path d="M4 20h4v-4h4v-4h4V8h4V4" />
        </svg>
      );
    case "hike":
      // Mountain triangles.
      return (
        <svg {...props}>
          <path d="M3 20l6-11 4 7 3-4 5 8H3z" />
        </svg>
      );
    case "recover":
      // Wave — calm/rest energy.
      return (
        <svg {...props}>
          <path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
        </svg>
      );
    case "rest":
      // Crescent moon.
      return (
        <svg {...props}>
          <path d="M20 15A8 8 0 019 4a8 8 0 1011 11z" />
        </svg>
      );
    default:
      // Filled circle placeholder.
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
  }
}

export function categoryFamily(category: SessionCategory): Family {
  return familyFor(category);
}
