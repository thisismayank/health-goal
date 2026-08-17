/**
 * Builds the coach's system prompt for a given user + turn. Pulls the
 * facts the coach needs to be useful (goal, this week's plan, recent
 * workouts, recovery signal) and stitches them into a compact block
 * that's cheap in tokens.
 *
 * Guardrails are baked into the prompt itself — hard rules the model
 * is told to never break. If the model ignores them anyway, the
 * output will still be filtered client-side (weeksToReady, etc. come
 * from deterministic code so we can cross-check).
 */

import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  plannedSession,
  trainingPlan,
  userProfile,
  workout,
  type UserProfile,
} from "@/db/schema";
import { getActiveGoal } from "@/lib/basecamp/summit";
import { computeCharacterSheet } from "@/lib/basecamp/stats";
import { computeRank } from "@/lib/basecamp/rank";
import { todayInTimeZone } from "@/lib/date";
import { getCoachSummary } from "@/lib/coach/summary";

export async function buildCoachSystem(user: UserProfile): Promise<string> {
  const [goal, sheet, activePlan, summary] = await Promise.all([
    getActiveGoal(user.id),
    computeCharacterSheet(user.id),
    db
      .select()
      .from(trainingPlan)
      .where(
        and(
          eq(trainingPlan.userId, user.id),
          eq(trainingPlan.status, "active"),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null),
    getCoachSummary(user.id),
  ]);

  const rank = computeRank(sheet);
  const today = todayInTimeZone(user.timezone);

  // This week's planned sessions.
  const sessionsThisWeek = activePlan
    ? await weekSessions(activePlan.id, today)
    : [];

  // Last 7 workouts for context.
  const recentWorkouts = await db
    .select()
    .from(workout)
    .where(
      and(
        eq(workout.userId, user.id),
        gte(workout.startTime, daysAgo(14)),
      ),
    )
    .orderBy(desc(workout.startTime))
    .limit(7);

  const parts: string[] = [];

  parts.push(COACH_PERSONA);
  parts.push(COACH_GUARDRAILS);

  if (summary?.content) {
    parts.push(`--- PRIOR CONVERSATION SUMMARY ---
${summary.content}
(Only conversation older than the last ~20 turns is summarized here — recent turns are attached verbatim below.)`);
  }

  parts.push(`--- USER ---
Name: ${user.name}
Timezone: ${user.timezone}
Today (local): ${today}
Class: ${rank.current} (${rank.currentLabel})${rank.nextRank ? ` — ${rank.progressPct}% to ${rank.nextRank}` : " — top of the ladder"}
Recovery signal: ${
    sheet.stats.REC.hasEnoughData
      ? `${sheet.stats.REC.value}/100 (${sheet.stats.REC.metric})`
      : "unavailable (missing sleep / HRV / RHR — don't push based on it)"
  }`);

  parts.push(`--- GOAL ---
${goal.name}${goal.source === "default_rainier" ? " (default; user hasn't picked a primary)" : ""}
Summit altitude: ${goal.summitFt} ft`);

  if (activePlan) {
    parts.push(`--- ACTIVE PLAN ---
${activePlan.name}${activePlan.goalEvent ? ` · ${activePlan.goalEvent}` : ""}
Source: ${activePlan.source}${activePlan.goalType ? ` · ${activePlan.goalType}` : ""}
Runs ${activePlan.startDate} → ${activePlan.eventDate ?? "?"}`);
  } else {
    parts.push(`--- ACTIVE PLAN ---
None. If the user asks about training, suggest generating one on /plan/new.`);
  }

  if (sessionsThisWeek.length > 0) {
    parts.push(`--- THIS WEEK'S SESSIONS ---
${sessionsThisWeek
  .map(
    (s) =>
      `${s.date} · ${s.title} · ${s.targetDurationMinutes ?? "?"}m · ${s.done ? "DONE" : s.date < today ? "MISSED" : "planned"}`,
  )
  .join("\n")}`);
  }

  if (recentWorkouts.length > 0) {
    parts.push(`--- RECENT WORKOUTS (last 14d) ---
${recentWorkouts
  .map((w) => {
    const min = w.durationSeconds ? Math.round(w.durationSeconds / 60) : "?";
    const km = w.distanceMeters
      ? (w.distanceMeters / 1000).toFixed(1) + "km"
      : "";
    const rpe = w.rpe ? `RPE${w.rpe}` : "";
    return `${w.startTime.toISOString().slice(0, 10)} · ${w.type} · ${min}m ${km} ${rpe}`.trim();
  })
  .join("\n")}`);
  }

  parts.push(COACH_CLOSING);
  return parts.join("\n\n");
}

// -------- helpers --------

async function weekSessions(planId: number, todayYmd: string) {
  // Fetch this week's Mon-Sun sessions and whether each is done.
  const monday = mondayOf(todayYmd);
  const sunday = addDays(monday, 6);
  const sessions = await db
    .select({
      id: plannedSession.id,
      date: plannedSession.date,
      title: plannedSession.title,
      targetDurationMinutes: plannedSession.targetDurationMinutes,
      sessionCategory: plannedSession.sessionCategory,
    })
    .from(plannedSession)
    .where(
      and(
        eq(plannedSession.planId, planId),
        gte(plannedSession.date, monday),
      ),
    );
  const inWeek = sessions.filter((s) => s.date <= sunday);
  const linkedRows = await db
    .select({ plannedSessionId: workout.plannedSessionId })
    .from(workout)
    .where(eq(workout.plannedSessionId, inWeek[0]?.id ?? -1));
  // Cheap "is done" — check for a workout linked to each session id.
  // (Batched query would be nicer; this is single-user chat, not hot.)
  const doneSet = new Set<number>();
  for (const s of inWeek) {
    const [w] = await db
      .select({ id: workout.id })
      .from(workout)
      .where(eq(workout.plannedSessionId, s.id))
      .limit(1);
    if (w) doneSet.add(s.id);
  }
  return inWeek.map((s) => ({ ...s, done: doneSet.has(s.id) }));
}

function mondayOf(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay(); // 0 = Sun
  const offset = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + offset);
  return dt.toISOString().slice(0, 10);
}

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400 * 1000);
}

// -------- persona + guardrails --------

const COACH_PERSONA = `You are the coach inside Basecamp — a hiking and mountaineering training app. You talk to one person at a time, on their phone, in the middle of their week. You are direct, kind, and specific. You use metric or imperial to match the user. You answer in 1-3 short paragraphs unless the user asks for detail; you avoid bullet-list soup.`;

const COACH_GUARDRAILS = `HARD RULES (never break):
1. Never contradict the user's readiness verdict for a trail. If the deterministic engine says a hike is "do_not_attempt" or "hard", you must reinforce that, not overturn it. You may explain WHY the engine says so or negotiate the shape (turn around at X, reduce pack, go with a group), but never say "you're ready" when the engine says you're not.
2. Never recommend an objective that exceeds the user's worst readiness dimension. Fitness is worst-dimension gated; a "closable" endurance dimension does not compensate for a "not_in_timeframe" altitude gap.
3. If today's recovery signal is "unavailable" or below 45, do not push. Prefer form + consistency over volume + intensity.
4. When you don't have enough data to answer specifically (missing recent workouts, no active plan), ask a question rather than guess.
5. You can suggest changes to the training plan — "swap Wednesday to Thursday", "cut the long session in half this week" — but note that in-app plan editing lands soon, and for now the user needs to adjust manually on /plan/new.
6. Never invent numbers. If the user asks "how much vertical did I do last week" and you don't see it in the context, say so.`;

const COACH_CLOSING = `--- STYLE ---
Answer as the coach. Concise. No emojis. No "I understand your concern" preambles. If the user says "I'm sore", ask where. If they ask "did I do enough this week", cite specific sessions from the context above. If they ask about a hike, name the verdict and the worst-dimension gap.`;
