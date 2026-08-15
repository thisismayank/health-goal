import type { WeeklyRollup } from "./rollups";

export type ProgressionDecision = "PROGRESS" | "HOLD" | "DELOAD" | "MANUAL_REVIEW";

export type ProgressionResult = {
  decision: ProgressionDecision;
  reasons: string[]; // deterministic reason codes
  hints: {
    // small suggested diffs — the LLM will humanize these
    change: string[];
    unchanged: string[];
  };
};

// Rule table roughly per spec §14. Conservative: DELOAD wins over HOLD wins
// over PROGRESS. Anything unusual falls to MANUAL_REVIEW.
export function decideProgression(week: WeeklyRollup): ProgressionResult {
  const reasons: string[] = [];

  const compliance = week.compliance.percent;
  const passed = week.compliance.passed;
  const compliantEnough = passed === 0 || compliance >= 80;

  const rpeHigh = week.actual.averageRpe != null && week.actual.averageRpe >= 8.5;
  const fatigueHigh = week.averageFatigue != null && week.averageFatigue >= 7;
  const longSessionMissing = week.flags.includes("long_session_missing");
  const strengthUndershoot = week.flags.includes("strength_undershoot");
  const manyExtras = week.flags.includes("many_extras");
  const lowCompliance = week.flags.includes("low_compliance");

  // DELOAD triggers — worrying signals
  const deloadSignals: string[] = [];
  if (rpeHigh) deloadSignals.push("avg_rpe_high");
  if (fatigueHigh) deloadSignals.push("fatigue_high");
  if (lowCompliance && (rpeHigh || fatigueHigh)) deloadSignals.push("compliance_and_recovery_bad");
  if (deloadSignals.length >= 2) {
    return {
      decision: "DELOAD",
      reasons: deloadSignals,
      hints: {
        change: [
          "reduce_long_session_duration_10-20pct",
          "hold_pack_weight",
          "keep_easy_runs_short",
          "extra_recovery_day_if_needed",
        ],
        unchanged: ["session_frequency"],
      },
    };
  }

  // MANUAL_REVIEW — mixed signals we don't want to guess about
  if (longSessionMissing && !compliantEnough) {
    reasons.push("long_session_missing", "low_compliance");
    return {
      decision: "MANUAL_REVIEW",
      reasons,
      hints: {
        change: ["reschedule_long_session_next_week"],
        unchanged: ["strength_progression", "pack_weight"],
      },
    };
  }

  // HOLD — completed the work but signals of moderate strain
  if (!compliantEnough || rpeHigh || fatigueHigh || strengthUndershoot) {
    if (!compliantEnough) reasons.push("compliance_below_80");
    if (rpeHigh) reasons.push("avg_rpe_high");
    if (fatigueHigh) reasons.push("fatigue_elevated");
    if (strengthUndershoot) reasons.push("strength_sessions_missed");
    return {
      decision: "HOLD",
      reasons,
      hints: {
        change: [
          "repeat_current_targets",
          "hold_pack_weight",
          "hold_long_session_duration",
        ],
        unchanged: ["strength_progression"],
      },
    };
  }

  // PROGRESS — everything reasonable
  reasons.push("compliance_ok", "recovery_ok");
  if (manyExtras) reasons.push("bonus_activity_present");
  return {
    decision: "PROGRESS",
    reasons,
    hints: {
      change: [
        "increase_long_session_5-10_min",
        // Pack progression only after two consistent weeks; deterministic
        // rule below the LLM will not attempt to advise on it yet.
      ],
      unchanged: ["strength_progression", "pack_weight"],
    },
  };
}
