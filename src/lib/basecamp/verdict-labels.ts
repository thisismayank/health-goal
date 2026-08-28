/**
 * Verdict + dimension label maps.
 *
 * Leaf module — no DB imports, no server-only code. Safe to import
 * from client components (the cold-start flow's verdict card lives
 * on the public /start page and must ship to the browser).
 *
 * trail-assessment.ts pulls in postgres/drizzle at module load, so
 * importing runtime values from it into a "use client" component
 * drags the whole DB module into the client bundle. This file exists
 * so verdict/status label maps can be shared without that penalty.
 */

export type Verdict =
  | "comfortable"
  | "achievable"
  | "hard"
  | "do_not_attempt";

export type DimensionStatus =
  | "ready"
  | "closable"
  | "stretch"
  | "not_in_timeframe"
  | "concern"
  | "unknown"
  | "not_applicable";

// Verdict ladder — deliberately monotonic and plain-language so users
// can tell which is easier at a glance:
//   Ready > Ready with prep > Hard — stretch objective > Not without prep or a guide
export const VERDICT_LABEL: Record<Verdict, string> = {
  comfortable: "Ready",
  achievable: "Ready with prep",
  hard: "Hard — stretch objective",
  do_not_attempt: "Not without prep or a guide",
};

export const VERDICT_COLOR: Record<Verdict, string> = {
  comfortable: "text-accent",
  achievable: "text-blue-300",
  hard: "text-warn",
  do_not_attempt: "text-danger",
};

export const VERDICT_HEADLINE: Record<Verdict, string> = {
  comfortable: "You're ready.",
  achievable: "Ready with focused prep.",
  hard: "Stretch objective — real effort needed.",
  do_not_attempt: "Not without more prep or a guide.",
};

export const VERDICT_SUBHEAD: Record<Verdict, string> = {
  comfortable:
    "Your current fitness comfortably meets this trail's demands.",
  achievable:
    "Within reach at your current fitness with a short training block. Expect real effort but you'll finish.",
  hard: "Well above your current fitness. Go slower than the guide time, take breaks, expect to feel it the next day.",
  do_not_attempt:
    "Significant gap between your current fitness/experience and this objective. Attempting at current level risks injury or having to turn back — hire a guide or extend the timeline.",
};

export const STATUS_COLOR: Record<DimensionStatus, string> = {
  ready: "text-accent",
  closable: "text-blue-300",
  stretch: "text-warn",
  concern: "text-warn",
  not_in_timeframe: "text-danger",
  unknown: "text-muted",
  not_applicable: "text-muted",
};

export const STATUS_LABEL: Record<DimensionStatus, string> = {
  ready: "READY",
  closable: "CLOSABLE",
  stretch: "STRETCH",
  concern: "CONCERN",
  not_in_timeframe: "GAP",
  unknown: "UNKNOWN",
  not_applicable: "N/A",
};
