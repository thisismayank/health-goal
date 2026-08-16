/**
 * Completion delta — what a freshly-synced workout actually moved.
 *
 * We compute the delta on-the-fly by running the state computation twice:
 * once as-is (post-workout) and once with the workout (and the session
 * it completed) excluded (pre-workout). No schema, no dual-writes, no
 * snapshot table — always accurate to current compute logic.
 *
 * Cost: doubles the DB work for the RecapHero render window (3h after
 * sync). Acceptable for a personal-use app; can move to persisted
 * snapshots if this ever runs at scale.
 */

import { and, eq, gte, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { trail, type Trail } from "@/db/schema";
import {
  computeCharacterSheet,
  type StatKey,
} from "@/lib/basecamp/stats";
import { computeRank, type Rank, type RankResult } from "@/lib/basecamp/rank";
import {
  getActiveGoal,
  getCumulativeVertical,
  type ActiveGoal,
} from "@/lib/basecamp/summit";
import {
  assessTrail,
  type Verdict,
  VERDICT_LABEL,
} from "@/lib/basecamp/trail-assessment";

export type StatDelta = {
  key: StatKey;
  label: string;
  before: number;
  after: number;
  delta: number;
};

export type RankDelta = {
  before: Rank;
  after: Rank;
  beforeProgressPct: number;
  afterProgressPct: number;
  tiered: boolean; // true if the rank letter itself changed
  nextRank: RankResult["nextRank"];
};

export type SummitDelta = {
  goalLabel: string;
  beforeFt: number;
  afterFt: number;
  deltaFt: number;
  beforePct: number;
  afterPct: number;
};

export type TrailVerdictDelta = {
  trailId: number;
  trailName: string;
  isPrimary: boolean;
  before: Verdict;
  after: Verdict;
  beforeLabel: string;
  afterLabel: string;
  changed: boolean;
};

export type CompletionDelta = {
  workoutId: number;
  stats: StatDelta[]; // all 5, ordered STR/END/POW/REC/WILL
  rank: RankDelta;
  summit: SummitDelta;
  trails: TrailVerdictDelta[]; // only those with active target dates
};

const STAT_ORDER: StatKey[] = ["STR", "END", "POW", "REC", "WILL"];

async function fetchActiveTrails(
  userId: number,
  todayYmd: string,
): Promise<Trail[]> {
  return db
    .select()
    .from(trail)
    .where(
      and(
        eq(trail.userId, userId),
        isNotNull(trail.targetDate),
        gte(trail.targetDate, todayYmd),
      ),
    );
}

export async function computeCompletionDelta({
  userId,
  workoutId,
  plannedSessionId,
  todayYmd,
}: {
  userId: number;
  workoutId: number;
  plannedSessionId: number | null;
  todayYmd: string;
}): Promise<CompletionDelta | null> {
  const excludeIds = [workoutId];
  const excludePlannedIds =
    plannedSessionId != null ? [plannedSessionId] : [];

  const [goal, activeTrails] = await Promise.all([
    getActiveGoal(userId),
    fetchActiveTrails(userId, todayYmd),
  ]);

  // Run current + pre-workout compute passes in parallel.
  const [
    afterSheet,
    beforeSheet,
    afterVertical,
    beforeVertical,
    afterTrailAssessments,
    beforeTrailAssessments,
  ] = await Promise.all([
    computeCharacterSheet(userId),
    computeCharacterSheet(userId, {
      excludeWorkoutIds: excludeIds,
      excludeCompletedPlannedSessionIds: excludePlannedIds,
    }),
    getCumulativeVertical(userId),
    getCumulativeVertical(userId, { excludeWorkoutIds: excludeIds }),
    Promise.all(
      activeTrails.map((t) => assessTrail(userId, t, todayYmd)),
    ),
    Promise.all(
      activeTrails.map((t) =>
        assessTrail(userId, t, todayYmd, { excludeWorkoutIds: excludeIds }),
      ),
    ),
  ]);

  const afterRank = computeRank(afterSheet);
  const beforeRank = computeRank(beforeSheet);

  const stats: StatDelta[] = STAT_ORDER.map((k) => ({
    key: k,
    label: afterSheet.stats[k].label,
    before: beforeSheet.stats[k].value,
    after: afterSheet.stats[k].value,
    delta: afterSheet.stats[k].value - beforeSheet.stats[k].value,
  }));

  const rank: RankDelta = {
    before: beforeRank.current,
    after: afterRank.current,
    beforeProgressPct: beforeRank.progressPct,
    afterProgressPct: afterRank.progressPct,
    tiered: beforeRank.current !== afterRank.current,
    nextRank: afterRank.nextRank,
  };

  const goalLabel = goalDisplayName(goal);
  const summit: SummitDelta = {
    goalLabel,
    beforeFt: Math.round(beforeVertical.totalFt),
    afterFt: Math.round(afterVertical.totalFt),
    deltaFt: Math.round(afterVertical.totalFt - beforeVertical.totalFt),
    beforePct: Math.min(
      100,
      Math.round((beforeVertical.totalFt / Math.max(1, goal.summitFt)) * 100),
    ),
    afterPct: Math.min(
      100,
      Math.round((afterVertical.totalFt / Math.max(1, goal.summitFt)) * 100),
    ),
  };

  const trails: TrailVerdictDelta[] = activeTrails.map((t, i) => {
    const before = beforeTrailAssessments[i].verdict;
    const after = afterTrailAssessments[i].verdict;
    return {
      trailId: t.id,
      trailName: t.name,
      isPrimary: !!t.isPrimary,
      before,
      after,
      beforeLabel: VERDICT_LABEL[before],
      afterLabel: VERDICT_LABEL[after],
      changed: before !== after,
    };
  });

  return {
    workoutId,
    stats,
    rank,
    summit,
    trails,
  };
}

function goalDisplayName(goal: ActiveGoal): string {
  return goal.source === "default_rainier" ? "Rainier" : goal.name;
}

// Convenience: does this delta contain anything worth animating?
export function deltaHasMovement(delta: CompletionDelta): boolean {
  if (delta.stats.some((s) => s.delta !== 0)) return true;
  if (delta.rank.tiered) return true;
  if (delta.rank.afterProgressPct !== delta.rank.beforeProgressPct) return true;
  if (delta.summit.deltaFt > 0) return true;
  if (delta.trails.some((t) => t.changed)) return true;
  return false;
}

// Discussion helper used by the coach and copy: is any of the movement
// "big" enough to celebrate specifically (rank tier, trail unlock, PR)?
export function deltaHighlights(delta: CompletionDelta): string[] {
  const highlights: string[] = [];
  if (delta.rank.tiered) {
    highlights.push(`Rank ${delta.rank.before} → ${delta.rank.after}`);
  }
  for (const t of delta.trails) {
    if (t.changed) {
      highlights.push(`${t.trailName}: ${t.beforeLabel} → ${t.afterLabel}`);
    }
  }
  for (const s of delta.stats) {
    if (s.delta >= 3) {
      highlights.push(`${s.key} +${s.delta}`);
    }
  }
  return highlights;
}
