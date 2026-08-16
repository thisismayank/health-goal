import { addDays, formatISO, startOfWeek } from "date-fns";
import { and, eq, gte } from "drizzle-orm";
import { db } from "./client";
import {
  plannedSession,
  trainingPlan,
  userProfile,
  type SessionCategory,
} from "./schema";
import {
  EASY_RUN_MINUTES_BY_WEEK,
  LONG_SESSION_BY_WEEK,
  TOTAL_SEEDED_WEEKS,
} from "../lib/plan";

const ymd = (d: Date) => formatISO(d, { representation: "date" });

const parseYmd = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

type DayTemplate = {
  category: SessionCategory;
  title: string;
  targetDurationMinutes: number | null;
  targetRpeMin: number | null;
  targetRpeMax: number | null;
  instructions: string;
  strengthPrescription?: string;
};

const WEEKLY_TEMPLATE: DayTemplate[] = [
  {
    category: "UPPER_STRENGTH",
    title: "Upper Body",
    targetDurationMinutes: 60,
    targetRpeMin: 6,
    targetRpeMax: 7,
    instructions:
      "Moderate intensity, mostly 1–3 reps in reserve. Focus on quality sets.",
    strengthPrescription: JSON.stringify([
      { name: "Lat pulldown or pull-ups", sets: 3, reps: "8-10" },
      { name: "Seated/cable row", sets: 3, reps: "8-12" },
      { name: "Dumbbell shoulder press", sets: 3, reps: "8-10" },
      { name: "Lateral raises", sets: 3, reps: "12-15" },
      { name: "Rear-delt fly / face pulls", sets: 3, reps: "12-15" },
      { name: "Biceps curls", sets: 3, reps: "10-12" },
      { name: "Triceps extensions", sets: 3, reps: "10-12" },
    ]),
  },
  {
    category: "EASY_RUN",
    title: "Easy Run",
    targetDurationMinutes: 40,
    targetRpeMin: 3,
    targetRpeMax: 4,
    instructions:
      "5–7 min warm-up, 30–35 min easy conversational run, 5 min cool-down. Do not optimize for 5K speed.",
  },
  {
    category: "LOWER_STRENGTH",
    title: "Primary Hard Strength Day",
    targetDurationMinutes: 60,
    targetRpeMin: 7,
    targetRpeMax: 8,
    instructions:
      "Hardest gym session of the week. Optional 5–8 min incline treadmill at end.",
    strengthPrescription: JSON.stringify([
      { name: "Barbell squat", sets: 3, reps: "6-8" },
      { name: "Romanian deadlift", sets: 3, reps: "8" },
      { name: "Bulgarian split squat", sets: 3, reps: "8/leg" },
      { name: "Step-ups", sets: 2, reps: "10/leg" },
      { name: "Standing calf raise", sets: 3, reps: "12-15" },
    ]),
  },
  {
    category: "UPPER_STRENGTH",
    title: "Upper Body + Core",
    targetDurationMinutes: 60,
    targetRpeMin: 6,
    targetRpeMax: 7,
    instructions:
      "Core work at end: plank, dead bug, Pallof press. 1–3 RIR on main lifts.",
    strengthPrescription: JSON.stringify([
      { name: "Incline dumbbell press", sets: 3, reps: "8-10" },
      { name: "Chest-supported row", sets: 3, reps: "8-12" },
      { name: "Lat pulldown", sets: 3, reps: "10" },
      { name: "Lateral raises", sets: 3, reps: "12-15" },
      { name: "Rear delts / face pulls", sets: 3, reps: "12-15" },
      { name: "Biceps", sets: 2, reps: "10-12" },
      { name: "Triceps", sets: 2, reps: "10-12" },
      { name: "Plank + dead bug + Pallof press", sets: 3, reps: "core" },
    ]),
  },
  {
    category: "MOUNTAIN_LEGS",
    title: "Mountain Legs + Stairs",
    targetDurationMinutes: 60,
    targetRpeMin: 6,
    targetRpeMax: 7,
    instructions:
      "Then StairMaster 15–20 min moderate effort, no pack initially.",
    strengthPrescription: JSON.stringify([
      { name: "Walking lunges", sets: 3, reps: "12/leg" },
      { name: "Step-ups", sets: 3, reps: "12/leg" },
      { name: "Leg press", sets: 3, reps: "12" },
      { name: "Single-leg RDL", sets: 2, reps: "10/leg" },
      { name: "Calf raises", sets: 3, reps: "15" },
    ]),
  },
  {
    category: "LONG_MOUNTAIN_SESSION",
    title: "Long Mountain Session",
    targetDurationMinutes: 60,
    targetRpeMin: 4,
    targetRpeMax: 5,
    instructions:
      "Continuous uphill-oriented aerobic work. Mix incline treadmill, StairMaster, stairs, or outdoor hiking as you like — switching machines is fine.",
  },
  {
    category: "ACTIVE_RECOVERY",
    title: "Active Recovery",
    targetDurationMinutes: 60,
    targetRpeMin: 1,
    targetRpeMax: 2,
    instructions:
      "45–75 min easy movement — walking, mobility, gentle stretching. Can be one continuous session OR distributed across the day (walks between meetings, errands, subway transfers all count). Goal: total time on feet in Zone 1.",
  },
];

type PlannedRow = {
  category: SessionCategory;
  title: string;
  targetDurationMinutes: number | null;
  targetRpeMin: number | null;
  targetRpeMax: number | null;
  instructions: string;
  strengthPrescription?: string;
  packLb: number;
  elevationFt: number;
};

function buildLongSessionInstructions(
  base: string,
  packLb: number,
  elevationFt: number,
): string {
  const bits = [base];
  if (packLb > 0) bits.push(`Target pack: ${packLb} lb.`);
  if (elevationFt > 0) bits.push(`Target vertical: ~${elevationFt.toLocaleString()} ft.`);
  return bits.join(" ");
}

function planForWeek(week: number, tpl: DayTemplate): PlannedRow {
  if (tpl.category === "LONG_MOUNTAIN_SESSION") {
    const p = LONG_SESSION_BY_WEEK[week];
    return {
      ...tpl,
      targetDurationMinutes: p.durationMinutes,
      instructions: buildLongSessionInstructions(tpl.instructions, p.packLb, p.elevationFt),
      packLb: p.packLb,
      elevationFt: p.elevationFt,
    };
  }
  if (tpl.category === "EASY_RUN") {
    return {
      ...tpl,
      targetDurationMinutes: EASY_RUN_MINUTES_BY_WEEK[week],
      packLb: 0,
      elevationFt: 0,
    };
  }
  return { ...tpl, packLb: 0, elevationFt: 0 };
}

async function main() {
  console.log("Seeding Rainier Companion…");

  const seedEmail = "mayank.uiet7@gmail.com";
  const existingUsers = await db.select().from(userProfile).limit(1);
  let userId: number;
  if (existingUsers.length > 0) {
    userId = existingUsers[0].id;
    console.log(`  user exists: id=${userId}`);
    // Backfill email for pre-auth seed users so magic-link sign-in works.
    if (!existingUsers[0].email) {
      await db
        .update(userProfile)
        .set({ email: seedEmail, createdVia: "seed" })
        .where(eq(userProfile.id, userId));
      console.log(`  backfilled email → ${seedEmail}`);
    }
  } else {
    const [u] = await db
      .insert(userProfile)
      .values({
        email: seedEmail,
        name: "Mayank",
        createdVia: "seed",
        sex: "M",
        heightCm: 183,
        currentWeightKg: 85,
        timezone: "America/New_York",
        homeLocation: "Manhattan, NY",
        summitGoal: "Guided Mount Rainier summit",
        summitDate: "2027-06-15",
        dietaryPreference: "mostly vegetarian",
      })
      .returning();
    userId = u.id;
    console.log(`  created user: id=${userId} (${u.name})`);
  }

  const existingPlans = await db
    .select()
    .from(trainingPlan)
    .where(eq(trainingPlan.userId, userId));

  let planId: number;
  if (existingPlans.length > 0) {
    planId = existingPlans[0].id;
    console.log(`  plan exists: id=${planId}`);
  } else {
    const today = new Date();
    const startDate = startOfWeek(today, { weekStartsOn: 1 });
    const eventDate = addDays(startDate, 7 * 40);
    const [p] = await db
      .insert(trainingPlan)
      .values({
        userId,
        name: "Rainier 10-Month Prep",
        goalEvent: "Mount Rainier summit",
        startDate: ymd(startDate),
        eventDate: ymd(eventDate),
        currentPhase: 1,
        status: "active",
      })
      .returning();
    planId = p.id;
    console.log(`  created plan: id=${planId} start=${p.startDate} event=${p.eventDate}`);
  }

  const plan = (
    await db.select().from(trainingPlan).where(eq(trainingPlan.id, planId))
  )[0];
  const start = parseYmd(plan.startDate);
  const todayStr = ymd(new Date());

  // Preserve history: only clear future rows that are still just "planned".
  // Completed/skipped/moved sessions and past sessions are left untouched.
  const cleared = await db
    .delete(plannedSession)
    .where(
      and(
        eq(plannedSession.planId, planId),
        gte(plannedSession.date, todayStr),
        eq(plannedSession.status, "planned"),
      ),
    )
    .returning({ id: plannedSession.id });
  console.log(`  cleared ${cleared.length} future planned sessions`);

  const rows = [];
  for (let week = 1; week <= TOTAL_SEEDED_WEEKS; week++) {
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const date = addDays(start, (week - 1) * 7 + dayOfWeek);
      const dateStr = ymd(date);
      if (dateStr < todayStr) continue;

      const tpl = planForWeek(week, WEEKLY_TEMPLATE[dayOfWeek]);
      rows.push({
        planId,
        date: dateStr,
        sessionCategory: tpl.category,
        title: `W${week} · ${tpl.title}`,
        targetDurationMinutes: tpl.targetDurationMinutes,
        targetPackWeightLb: tpl.packLb > 0 ? tpl.packLb : null,
        targetElevationGainFt: tpl.elevationFt > 0 ? tpl.elevationFt : null,
        targetRpeMin: tpl.targetRpeMin,
        targetRpeMax: tpl.targetRpeMax,
        instructions: tpl.instructions,
        strengthPrescription: tpl.strengthPrescription ?? null,
        status: "planned" as const,
      });
    }
  }

  if (rows.length > 0) {
    // Skip dates where a session already exists (survivors of the delete:
    // completed/skipped/moved). Preserves user history.
    await db
      .insert(plannedSession)
      .values(rows)
      .onConflictDoNothing({
        target: [plannedSession.planId, plannedSession.date],
      });
  }

  console.log(
    `  seeded ${rows.length} upcoming planned sessions across ${TOTAL_SEEDED_WEEKS} weeks (Phase 1 + Phase 2)`,
  );
  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
