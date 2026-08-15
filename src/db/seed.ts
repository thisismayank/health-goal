import { addDays, formatISO, startOfWeek } from "date-fns";
import { eq } from "drizzle-orm";
import { db } from "./client";
import {
  plannedSession,
  trainingPlan,
  userProfile,
  type SessionCategory,
} from "./schema";

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
      "45–75 min easy walking + mobility. No hard running, no heavy legs, no hard StairMaster.",
  },
];

function scaleForWeek(week: number, tpl: DayTemplate): DayTemplate {
  if (tpl.category === "LONG_MOUNTAIN_SESSION") {
    return { ...tpl, targetDurationMinutes: Math.min(60 + (week - 1) * 10, 120) };
  }
  if (tpl.category === "EASY_RUN") {
    return { ...tpl, targetDurationMinutes: Math.min(30 + (week - 1) * 2, 45) };
  }
  return tpl;
}

async function main() {
  console.log("Seeding Rainier Companion…");

  const existingUsers = await db.select().from(userProfile).limit(1);
  let userId: number;
  if (existingUsers.length > 0) {
    userId = existingUsers[0].id;
    console.log(`  user exists: id=${userId}`);
  } else {
    const [u] = await db
      .insert(userProfile)
      .values({
        name: "Mayank",
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
    console.log(`  plan exists: id=${planId} — wiping planned sessions and re-seeding`);
    await db.delete(plannedSession).where(eq(plannedSession.planId, planId));
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

  const rows = [];
  for (let week = 1; week <= 8; week++) {
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const date = addDays(start, (week - 1) * 7 + dayOfWeek);
      const tpl = scaleForWeek(week, WEEKLY_TEMPLATE[dayOfWeek]);
      rows.push({
        planId,
        date: ymd(date),
        sessionCategory: tpl.category,
        title: `W${week} · ${tpl.title}`,
        targetDurationMinutes: tpl.targetDurationMinutes,
        targetRpeMin: tpl.targetRpeMin,
        targetRpeMax: tpl.targetRpeMax,
        instructions: tpl.instructions,
        strengthPrescription: tpl.strengthPrescription ?? null,
        status: "planned" as const,
      });
    }
  }
  await db.insert(plannedSession).values(rows);
  console.log(`  seeded ${rows.length} planned sessions across 8 weeks`);
  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
