/**
 * Central icon map for session categories, terrain grades, and other
 * repeated concepts. One source of truth so we can restyle globally
 * (stroke width, size, tone) without hunting for icons across pages.
 *
 * Restraint rule: one icon per element, never a row of icons. Icons
 * complement text — they don't replace it.
 */

import {
  Activity,
  Dumbbell,
  Footprints,
  Heart,
  Mountain,
  MoveUp,
  Sunrise,
  TrendingUp,
  Waves,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { SessionCategory } from "@/db/schema";

// --- Session category ---

const SESSION_ICON: Record<SessionCategory, LucideIcon> = {
  EASY_RUN: Footprints,
  QUALITY_RUN: TrendingUp,
  ZONE2_CARDIO: Heart,
  UPPER_STRENGTH: Dumbbell,
  LOWER_STRENGTH: Dumbbell,
  FULL_BODY_STRENGTH: Dumbbell,
  MOUNTAIN_LEGS: MoveUp,
  STAIRMASTER: MoveUp,
  INCLINE_TREADMILL: MoveUp,
  OUTDOOR_HIKE: Mountain,
  LOADED_HIKE: Mountain,
  LONG_MOUNTAIN_SESSION: Mountain,
  ACTIVE_RECOVERY: Wind,
  MOBILITY: Wind,
  CROSS_TRAINING: Activity,
  REST: Sunrise,
  UNKNOWN: Activity,
};

export function SessionIcon({
  category,
  className,
  size = 16,
}: {
  category: SessionCategory;
  className?: string;
  size?: number;
}) {
  const Icon = SESSION_ICON[category] ?? Activity;
  return <Icon size={size} className={className} aria-hidden strokeWidth={1.75} />;
}

// --- Trail / terrain ---

/**
 * Simple trail glyph — used on featured trail cards, upcoming trails,
 * anywhere we want to say "this is a hike" at a glance.
 */
export function TrailIcon({
  className,
  size = 16,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <Mountain
      size={size}
      className={className}
      aria-hidden
      strokeWidth={1.75}
    />
  );
}

// --- Recovery / vitals ---

export function RecoveryIcon({
  className,
  size = 16,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <Waves size={size} className={className} aria-hidden strokeWidth={1.75} />
  );
}
