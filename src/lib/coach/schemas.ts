import { z } from "zod";

// Daily narrative: short "how the day went" card.
export const DailyNarrativeSchema = z.object({
  summary: z.string(),
  wins: z.array(z.string()).max(3),
  concerns: z.array(z.string()).max(3),
  next_hint: z.string(),
});
export type DailyNarrative = z.infer<typeof DailyNarrativeSchema>;

export const DAILY_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "1–3 sentences describing how today went relative to the planned session and the current phase.",
    },
    wins: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
      description: "0–3 short, concrete positives from the day.",
    },
    concerns: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
      description:
        "0–3 short concerns. If nothing concerning, return an empty array.",
    },
    next_hint: {
      type: "string",
      description: "One short sentence about what to focus on tomorrow.",
    },
  },
  required: ["summary", "wins", "concerns", "next_hint"],
};

// Weekly review: score + decision + suggested changes.
export const WeeklyReviewSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  wins: z.array(z.string()).max(3),
  concerns: z.array(z.string()).max(3),
  decision_explanation: z.string(),
  proposed_changes: z
    .array(
      z.object({
        variable: z.string(),
        from: z.union([z.string(), z.number()]),
        to: z.union([z.string(), z.number()]),
        reason: z.string(),
      }),
    )
    .max(5),
  unchanged: z.array(z.string()).max(5),
});
export type WeeklyReview = z.infer<typeof WeeklyReviewSchema>;

export const WEEKLY_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description: "One line — e.g. 'Solid base week, on track for Phase 2.'",
    },
    summary: {
      type: "string",
      description: "2–4 sentences summarizing the week vs the plan.",
    },
    wins: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
    },
    concerns: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
    },
    decision_explanation: {
      type: "string",
      description:
        "2–3 sentences explaining the deterministic decision (PROGRESS/HOLD/DELOAD/MANUAL_REVIEW).",
    },
    proposed_changes: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          variable: { type: "string", description: "Short slug for the thing changing." },
          from: { type: "string", description: "Current value as human-readable text." },
          to: { type: "string", description: "Proposed value as human-readable text." },
          reason: { type: "string", description: "One sentence explaining why." },
        },
        required: ["variable", "from", "to", "reason"],
      },
    },
    unchanged: {
      type: "array",
      items: { type: "string" },
      maxItems: 5,
    },
  },
  required: [
    "headline",
    "summary",
    "wins",
    "concerns",
    "decision_explanation",
    "proposed_changes",
    "unchanged",
  ],
};
