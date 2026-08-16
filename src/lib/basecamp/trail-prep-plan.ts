/**
 * Compressed prep-plan generator for a trail objective.
 *
 * Deterministic: takes the assessment + days available and produces a
 * weekly structure + progressive targets. LLM narrates it (see
 * trail-narrative.ts). This does NOT modify the user's active training
 * plan — it's display-only, side-by-side coaching advice.
 */

import type { Trail } from "@/db/schema";
import type { TrailAssessment, Verdict } from "./trail-assessment";

export type WeeklyStructure = {
  longSessions: number;
  aerobicSessions: number;
  strengthSessions: number;
  restDays: number;
};

export type PrepPlan =
  | {
      kind: "none";
      reason: string;
    }
  | {
      kind: "generated";
      focus: string;
      daysAvailable: number;
      weekly: WeeklyStructure;
      progressions: Array<{
        weekLabel: string;
        longSessionMin: number;
        packLb: number;
        verticalTargetFt: number;
        note: string;
      }>;
      taperDays: number;
      alternativeSuggestion: string | null;
    };

function pickFocus(assessment: TrailAssessment): string {
  const inNeed = assessment.dimensions.filter(
    (d) =>
      d.status === "stretch" ||
      d.status === "closable" ||
      d.status === "not_in_timeframe",
  );
  if (inNeed.length === 0) return "maintenance";
  // Prioritize by dimension weight: endurance > vertical > pack > altitude
  const priority = ["endurance", "vertical", "pack", "altitude", "recovery"];
  const sorted = [...inNeed].sort(
    (a, b) => priority.indexOf(a.key) - priority.indexOf(b.key),
  );
  return sorted[0].key;
}

function weeklyStructureFor(focus: string): WeeklyStructure {
  switch (focus) {
    case "endurance":
      return {
        longSessions: 1,
        aerobicSessions: 3,
        strengthSessions: 1,
        restDays: 2,
      };
    case "vertical":
      return {
        longSessions: 1,
        aerobicSessions: 2,
        strengthSessions: 2,
        restDays: 2,
      };
    case "pack":
      return {
        longSessions: 1,
        aerobicSessions: 2,
        strengthSessions: 2,
        restDays: 2,
      };
    case "altitude":
      return {
        longSessions: 1,
        aerobicSessions: 3,
        strengthSessions: 1,
        restDays: 2,
      };
    case "maintenance":
    default:
      return {
        longSessions: 1,
        aerobicSessions: 2,
        strengthSessions: 2,
        restDays: 2,
      };
  }
}

function taperDaysFor(daysAvailable: number): number {
  if (daysAvailable >= 14) return 3;
  if (daysAvailable >= 7) return 2;
  return 1;
}

function alternativeFor(
  verdict: Verdict,
  trail: Trail,
): string | null {
  if (verdict !== "do_not_attempt" && verdict !== "hard") return null;
  const bits: string[] = [];
  if (trail.packWeightLb > 15) {
    bits.push(`drop pack weight to ${Math.round(trail.packWeightLb * 0.6)} lb`);
  }
  if (trail.elevationGainFt > 3000) {
    bits.push(
      `consider a shorter variant (~${Math.round(trail.elevationGainFt * 0.6).toLocaleString()} ft version)`,
    );
  }
  if (trail.typicalHours > 6) {
    bits.push(`or a shorter loop of ~${(trail.typicalHours * 0.6).toFixed(1)} h`);
  }
  if (bits.length === 0) return null;
  return `If reducing scope: ${bits.join(", ")}.`;
}

export function generatePrepPlan(
  assessment: TrailAssessment,
  trail: Trail,
): PrepPlan {
  const days = assessment.daysUntilTrail;

  // No target date? Just show general prep advice
  if (days == null) {
    return {
      kind: "none",
      reason:
        "No target date set. Add one and we'll generate a time-boxed prep plan.",
    };
  }

  // Trail is very soon — only taper advice makes sense
  if (days < 5) {
    return {
      kind: "none",
      reason: `Only ${days} day(s) — too late to build fitness. Focus on rest, hydration, and gear check.`,
    };
  }

  // Comfortable verdict — no prep needed
  if (assessment.verdict === "comfortable") {
    return {
      kind: "none",
      reason:
        "Verdict is Comfortable. Continue normal training; taper 2 days before.",
    };
  }

  // Do-not-attempt — plan won't help, LLM narrative will explain
  if (assessment.verdict === "do_not_attempt") {
    return {
      kind: "none",
      reason: `Verdict is Do-Not-Attempt in ${days} days. See narrative for alternatives.`,
    };
  }

  // Achievable or Hard — generate a plan
  const focus = pickFocus(assessment);
  const weekly = weeklyStructureFor(focus);
  const taperDays = taperDaysFor(days);
  const trainingDays = days - taperDays;
  const weeks = Math.max(1, Math.floor(trainingDays / 7));

  // Progressive targets — long-session grows toward trail duration,
  // pack grows toward trail pack weight (capped by realistic weekly rate).
  const targetLongMin = Math.round(trail.typicalHours * 60);
  const currentLongMin = assessment.fitnessSnapshot.longestRecentSessionMin;
  const currentPackLb = assessment.fitnessSnapshot.maxPackLb;
  const targetPackLb = trail.packWeightLb;

  const progressions: PrepPlan extends { kind: "generated" }
    ? never
    : Array<{
        weekLabel: string;
        longSessionMin: number;
        packLb: number;
        verticalTargetFt: number;
        note: string;
      }> = [];

  for (let i = 0; i < weeks; i++) {
    // Linear interpolation toward target (capped at target)
    const progressFrac = weeks === 1 ? 1 : (i + 1) / weeks;
    const longMin = Math.round(
      currentLongMin + (targetLongMin * 0.85 - currentLongMin) * progressFrac,
    );
    const packLb = Math.round(
      Math.min(
        targetPackLb,
        currentPackLb + Math.min(2, targetPackLb - currentPackLb) * (i + 1),
      ),
    );
    const vertTarget = Math.round(
      (trail.elevationGainFt * 0.5) * progressFrac,
    );

    const weekLabel =
      weeks === 1
        ? "This week"
        : i === 0
          ? "This week"
          : i === weeks - 1
            ? "Trail week (build)"
            : `Week ${i + 1}`;

    const note =
      i === weeks - 1
        ? "Peak week — one long session mid-week, then start taper."
        : i === 0
          ? "Base week — moderate long session, focus on quality."
          : "Progressive build — extend long session, add pack if applicable.";

    progressions.push({
      weekLabel,
      longSessionMin: Math.max(currentLongMin, longMin),
      packLb,
      verticalTargetFt: vertTarget,
      note,
    });
  }

  return {
    kind: "generated",
    focus,
    daysAvailable: days,
    weekly,
    progressions,
    taperDays,
    alternativeSuggestion: alternativeFor(assessment.verdict, trail),
  };
}
