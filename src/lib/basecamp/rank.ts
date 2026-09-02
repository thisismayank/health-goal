import type { CharacterSheet } from "./stats";

/**
 * Fitness Class ladder (formerly "Rank"). Concrete labels tied to what
 * kind of trail objectives an athlete is realistically capable of at
 * each tier — not abstract E/D/C/B/A/S badges without context.
 *
 * The single-letter code is kept for compact display (chips, headers)
 * and so existing storage/serialization stays stable. The label +
 * unlocks are what users actually see and reason about.
 */
export type Rank = "E" | "D" | "C" | "B" | "A" | "S";

export const RANKS: Rank[] = ["E", "D", "C", "B", "A", "S"];

export const RANK_LABELS: Record<Rank, string> = {
  E: "Casual Walker",
  D: "Weekend Hiker",
  C: "Regular Hiker",
  B: "Serious Hiker",
  A: "Mountain Athlete",
  S: "Alpinist",
};

export const RANK_DESCRIPTIONS: Record<Rank, string> = {
  E: "Starting or rebuilding. Building consistency and base fitness.",
  D: "Comfortable with short day hikes on easy terrain (2–4 hours, moderate elevation).",
  C: "Handles standard day hikes: 4–8 hours, up to 3,500 ft, moderate terrain.",
  B: "Ready for long day hikes, multi-day treks, and altitude up to 14,000 ft.",
  A: "Handles summit pushes and alpine terrain up to 18,000 ft — Rainier / Kili class objectives.",
  S: "Expedition-capable: Denali, Aconcagua, technical mountaineering. Back-to-back big days.",
};

/**
 * What kinds of trails a user at this class is realistically ready for.
 * These are DESCRIPTIVE not prescriptive — no trail is gated in the UI
 * yet. Used in the "unlocks" section on /progress so users see what
 * levelling up actually gets them.
 */
export const RANK_UNLOCKS: Record<Rank, string[]> = {
  E: [
    "Short day hikes (≤ 4 hours, ≤ 2,000 ft gain)",
    "Easy terrain — established trails, no scrambling",
  ],
  D: [
    "Longer day hikes (4–6 hours, up to 3,500 ft)",
    "Moderate terrain — occasional scrambling, well-maintained routes",
  ],
  C: [
    "Full day hikes with steep terrain (6–8 hours, up to 5,000 ft)",
    "Light backpacking (up to 20 lb pack, 1–2 nights)",
    "Popular Class 1–2 peaks (Colorado 14ers via easy routes)",
  ],
  B: [
    "Multi-day treks (Kilimanjaro, EBC, Annapurna Circuit)",
    "Long day hikes with real vertical (Whitney, Rim-to-Rim)",
    "Altitude up to 14,000 ft with proper acclimatization",
    "Technical scrambles (Class 3 with exposure)",
  ],
  A: [
    "Mountaineering objectives (Rainier, Mont Blanc, Elbrus)",
    "Summit pushes with glacier travel + ice axe + crampons",
    "Altitude up to 18,000 ft",
    "Sustained heavy-pack days (35–45 lb, multi-day)",
  ],
  S: [
    "Expedition mountaineering (Denali, Aconcagua)",
    "Technical alpine climbing",
    "Extended above 18,000 ft with cold + weight tolerance",
    "Consecutive summit-length days without recovery collapse",
  ],
};

type Requirement = {
  label: string;
  target: string;
  currentValue: number | string;
  met: boolean;
};

// Requirements are AND-ed: all must be met to reach the class.
// Thresholds are calibrated so a returning athlete on-plan hits D in
// ~4-6 weeks, C in ~3 months, B in ~5 months, A in ~9 months. S is not
// achievable without deliberate expedition-level loading.
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

// Gate helper for stats that carry a hasEnoughData flag (REC currently).
// Without this, an unmet-but-defaulted score (REC=60 when we have zero
// recovery signals) silently passed the '≥ 55' A-class check — Devin
// caught the leak: "REC=100 with a padlock on /body but somehow qualifies
// for Mountain Athlete." Treat "no data" as "not met" and surface the
// em-dash on the requirements list so it's obvious why they're blocked.
function gate(
  label: string,
  target: string,
  stat: { value: number; hasEnoughData: boolean },
  threshold: number,
): Requirement {
  const currentValue = stat.hasEnoughData ? stat.value : "—";
  const met = stat.hasEnoughData && stat.value >= threshold;
  return { label, target, currentValue, met };
}

const GATES: RankGate[] = [
  {
    rank: "D",
    requirements: (s) => [
      req("Strength score", "≥ 25", s.stats.STR.value, s.stats.STR.value >= 25),
      req("Endurance score", "≥ 25", s.stats.END.value, s.stats.END.value >= 25),
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
      gate("Recovery score", "≥ 55", s.stats.REC, 55),
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
      gate("Recovery score", "≥ 65", s.stats.REC, 65),
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
  currentUnlocks: string[];
  nextRank: Rank | null;
  nextLabel: string | null;
  nextUnlocks: string[];
  progressPct: number;
  requirementsForNext: Requirement[];
  requirementsMetCount: number;
};

export function computeRank(sheet: CharacterSheet): RankResult {
  let measured: Rank = "E";
  for (let i = 0; i < GATES.length; i++) {
    const gate = GATES[i];
    const reqs = gate.requirements(sheet);
    const allMet = reqs.every((r) => r.met);
    if (allMet) {
      measured = gate.rank;
    } else {
      break;
    }
  }

  // Cold-start floor. If the user's self-reported baseline puts them
  // at Class D or C, don't render "Casual Walker" on Home until real
  // training either confirms it (measured rank overtakes) or the
  // classification stays consistent. Prevents the Round-2 contradiction
  // where the verdict engine said Class C and the Home header said
  // Class E on the same screen for the same user.
  const measuredIdx = RANKS.indexOf(measured);
  const floorIdx = Math.max(0, sheet.minClassIndex ?? 0);
  const effectiveIdx = Math.max(measuredIdx, floorIdx);
  const current = RANKS[effectiveIdx];
  // Next-gate index. GATES starts at D (index 0 = rank D), so
  // GATES[i] === RANKS[i+1]. The next gate for current rank RANKS[k]
  // is GATES[k] — same index in GATES equals one step up in RANKS.
  // The previous +1 skipped a class (Devin r3: Class D showed
  // "next: B", Class C showed "next: A").
  const nextIdx = effectiveIdx;

  const nextGate = GATES[nextIdx] ?? null;
  const nextReqs = nextGate ? nextGate.requirements(sheet) : [];
  const metCount = nextReqs.filter((r) => r.met).length;
  const progressPct =
    nextReqs.length === 0 ? 100 : Math.round((metCount / nextReqs.length) * 100);

  return {
    current,
    currentLabel: RANK_LABELS[current],
    currentDescription: RANK_DESCRIPTIONS[current],
    currentUnlocks: RANK_UNLOCKS[current],
    nextRank: nextGate ? nextGate.rank : null,
    nextLabel: nextGate ? RANK_LABELS[nextGate.rank] : null,
    nextUnlocks: nextGate ? RANK_UNLOCKS[nextGate.rank] : [],
    progressPct,
    requirementsForNext: nextReqs,
    requirementsMetCount: metCount,
  };
}
