import type { CharacterSheet, StatKey } from "./stats";

export type Rank = "E" | "D" | "C" | "B" | "A" | "S";

export const RANKS: Rank[] = ["E", "D", "C", "B", "A", "S"];

export const RANK_LABELS: Record<Rank, string> = {
  E: "Rebuilding",
  D: "Base Fit",
  C: "Weekend Warrior",
  B: "Alpine-Ready",
  A: "Rainier-Ready",
  S: "Expedition-Ready",
};

export const RANK_DESCRIPTIONS: Record<Rank, string> = {
  E: "Starting or returning. Building consistency.",
  D: "Comfortable with a 60-min continuous effort and a sub-30 5K.",
  C: "Handles 2+ hour hikes with a 20 lb pack, ~2000 ft vertical. End-of-Month-3 Rainier prep target.",
  B: "Handles 3–4 hour sessions with 25–30 lb, ~3000 ft vertical.",
  A: "Rainier-ready: 5–7 hour sessions with 40–45 lb pack, ~4000–5000 ft vertical.",
  S: "Expedition-ready: Denali / Aconcagua tolerance. Back-to-back long days.",
};

type Requirement = {
  label: string;
  target: string;
  currentValue: number | string;
  met: boolean;
};

// Requirements are AND-ed: all must be met to reach the rank.
// Thresholds are calibrated so that a returning athlete on-plan hits D in
// ~4-6 weeks, C in ~3 months, B in ~5 months, A in ~9 months (Rainier peak).
// S is not achievable on the Rainier plan alone — requires expedition-level
// deliberate loading.
type RankGate = {
  rank: Rank;
  requirements: (sheet: CharacterSheet) => Requirement[];
};

function req(
  label: string,
  target: string,
  currentValue: number | string,
  met: boolean,
): Requirement {
  return { label, target, currentValue, met };
}

const GATES: RankGate[] = [
  {
    rank: "D",
    requirements: (s) => [
      req(
        "Strength score",
        "≥ 25",
        s.stats.STR.value,
        s.stats.STR.value >= 25,
      ),
      req(
        "Endurance score",
        "≥ 25",
        s.stats.END.value,
        s.stats.END.value >= 25,
      ),
      req(
        "Discipline score",
        "≥ 40",
        s.stats.WILL.value,
        s.stats.WILL.value >= 40,
      ),
    ],
  },
  {
    rank: "C",
    requirements: (s) => [
      req("Strength score", "≥ 40", s.stats.STR.value, s.stats.STR.value >= 40),
      req("Endurance score", "≥ 40", s.stats.END.value, s.stats.END.value >= 40),
      req(
        "Power score (vertical + pack)",
        "≥ 25",
        s.stats.POW.value,
        s.stats.POW.value >= 25,
      ),
      req(
        "Discipline score",
        "≥ 55",
        s.stats.WILL.value,
        s.stats.WILL.value >= 55,
      ),
    ],
  },
  {
    rank: "B",
    requirements: (s) => [
      req("Strength score", "≥ 55", s.stats.STR.value, s.stats.STR.value >= 55),
      req("Endurance score", "≥ 55", s.stats.END.value, s.stats.END.value >= 55),
      req("Power score", "≥ 45", s.stats.POW.value, s.stats.POW.value >= 45),
      req(
        "Discipline score",
        "≥ 60",
        s.stats.WILL.value,
        s.stats.WILL.value >= 60,
      ),
    ],
  },
  {
    rank: "A",
    requirements: (s) => [
      req("Strength score", "≥ 70", s.stats.STR.value, s.stats.STR.value >= 70),
      req("Endurance score", "≥ 70", s.stats.END.value, s.stats.END.value >= 70),
      req("Power score", "≥ 65", s.stats.POW.value, s.stats.POW.value >= 65),
      req(
        "Recovery score",
        "≥ 55",
        s.stats.REC.value,
        s.stats.REC.value >= 55,
      ),
      req(
        "Discipline score",
        "≥ 65",
        s.stats.WILL.value,
        s.stats.WILL.value >= 65,
      ),
    ],
  },
  {
    rank: "S",
    requirements: (s) => [
      req("Strength score", "≥ 85", s.stats.STR.value, s.stats.STR.value >= 85),
      req("Endurance score", "≥ 85", s.stats.END.value, s.stats.END.value >= 85),
      req("Power score", "≥ 80", s.stats.POW.value, s.stats.POW.value >= 80),
      req(
        "Recovery score",
        "≥ 65",
        s.stats.REC.value,
        s.stats.REC.value >= 65,
      ),
      req(
        "Discipline score",
        "≥ 75",
        s.stats.WILL.value,
        s.stats.WILL.value >= 75,
      ),
    ],
  },
];

export type RankResult = {
  current: Rank;
  currentLabel: string;
  currentDescription: string;
  nextRank: Rank | null;
  nextLabel: string | null;
  progressPct: number; // 0-100 progress toward next rank
  requirementsForNext: Requirement[];
  requirementsMetCount: number;
};

export function computeRank(sheet: CharacterSheet): RankResult {
  let current: Rank = "E";
  let nextIdx = 0;
  for (let i = 0; i < GATES.length; i++) {
    const gate = GATES[i];
    const reqs = gate.requirements(sheet);
    const allMet = reqs.every((r) => r.met);
    if (allMet) {
      current = gate.rank;
      nextIdx = i + 1;
    } else {
      break;
    }
  }

  const nextGate = GATES[nextIdx] ?? null;
  const nextReqs = nextGate ? nextGate.requirements(sheet) : [];
  const metCount = nextReqs.filter((r) => r.met).length;
  const progressPct =
    nextReqs.length === 0 ? 100 : Math.round((metCount / nextReqs.length) * 100);

  return {
    current,
    currentLabel: RANK_LABELS[current],
    currentDescription: RANK_DESCRIPTIONS[current],
    nextRank: nextGate ? nextGate.rank : null,
    nextLabel: nextGate ? RANK_LABELS[nextGate.rank] : null,
    progressPct,
    requirementsForNext: nextReqs,
    requirementsMetCount: metCount,
  };
}
