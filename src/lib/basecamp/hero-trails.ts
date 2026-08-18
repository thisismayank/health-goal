/**
 * Curated hero-trails for the public /start page.
 *
 * The cold-start job is to hand a stranger a verdict on a hike THEY
 * already care about before they've told us anything. That means the
 * grid can't be "here's 200 trails" — it has to be six-to-eight
 * aspirational names people recognize from the outside (Rainier,
 * Denali, Whitney, Kili, EBC) mixed with two more approachable
 * anchors so the ladder doesn't feel like it's only for expedition
 * climbers.
 *
 * Slugs must exist in the full library (trail-library.ts base or
 * trail-coords.ts EXTRA_TRAIL_PRESETS). Order is display order.
 */

export type HeroTrail = {
  slug: string;
  hook: string; // one-line teaser under the name, ≤ ~60 chars
};

export const HERO_TRAILS: HeroTrail[] = [
  {
    slug: "rainier-dc",
    hook: "The classic Cascade summit push.",
  },
  {
    slug: "denali-west-buttress",
    hook: "North America's high point. Expedition.",
  },
  {
    slug: "whitney-dayhike",
    hook: "22 mi, one day, lower 48's rooftop.",
  },
  {
    slug: "kilimanjaro-machame",
    hook: "Africa's highest, guided, ~7 days.",
  },
  {
    slug: "ebc-trek",
    hook: "12 days to the base of Everest.",
  },
  {
    slug: "wonderland-trail",
    hook: "93 mi loop around Rainier.",
  },
  {
    slug: "angels-landing",
    hook: "Half a day, chains + exposure.",
  },
  {
    slug: "bear-mountain-loop",
    hook: "3 hours of Hudson-highlands views.",
  },
];
