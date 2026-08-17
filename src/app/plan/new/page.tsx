import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { trainingPlan, userProfile, PLAN_GOAL_TYPES } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/data";
import { GOAL_DESCRIPTION, GOAL_LABEL } from "@/lib/plan/goal-labels";
import { defaultWeeksForGoal } from "@/lib/plan/templates";
import { RegenerateForm } from "./regenerate-form";

export const dynamic = "force-dynamic";

export default async function NewPlanPage() {
  const user = await requireOnboardedUser();

  const [profile] = await db
    .select({
      weeklyHours: userProfile.weeklyTrainingHours,
      startingFitness: userProfile.startingFitness,
    })
    .from(userProfile)
    .where(eq(userProfile.id, user.id))
    .limit(1);

  const [active] = await db
    .select({
      id: trainingPlan.id,
      name: trainingPlan.name,
      goalType: trainingPlan.goalType,
      source: trainingPlan.source,
      startDate: trainingPlan.startDate,
      eventDate: trainingPlan.eventDate,
    })
    .from(trainingPlan)
    .where(eq(trainingPlan.userId, user.id))
    .orderBy(trainingPlan.createdAt)
    .limit(1);

  return (
    <div className="space-y-6">
      <section>
        <Link
          href="/train"
          className="text-xs text-muted hover:text-foreground"
        >
          ← Train
        </Link>
        <h1 className="text-2xl font-semibold mt-2">A new plan</h1>
        <p className="text-sm text-muted mt-1">
          Pick your goal and constraints. We&apos;ll build a plan sized
          to it. Regenerating replaces your current plan going forward
          — already-completed sessions stay logged in your history.
        </p>
      </section>

      {active && (
        <section className="rounded-md border border-panel-border bg-panel/60 p-3 text-xs text-muted">
          Current plan:{" "}
          <span className="text-foreground font-medium">{active.name}</span>
          {active.goalType && (
            <span> · {GOAL_LABEL[active.goalType]}</span>
          )}
          <span> · {active.source}</span>
        </section>
      )}

      <RegenerateForm
        defaultWeeklyHours={
          (profile?.weeklyHours as 3 | 5 | 7 | 10 | null) ?? 5
        }
        defaultStartingFitness={
          (profile?.startingFitness as
            | "new"
            | "occasional"
            | "regular"
            | "active"
            | null) ?? "regular"
        }
        goalTypes={PLAN_GOAL_TYPES.map((g) => ({
          value: g,
          label: GOAL_LABEL[g],
          description: GOAL_DESCRIPTION[g],
          defaultWeeks: defaultWeeksForGoal(g),
        }))}
      />

      <section className="rounded-md border border-panel-border bg-panel/60 p-4 space-y-2 text-sm">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted">
          [BRING YOUR OWN PLAN]
        </div>
        <p className="text-muted leading-relaxed">
          Already have a plan from a coach or a book?{" "}
          <Link
            href="/plan/upload"
            className="text-blue-300 hover:underline"
          >
            Upload it →
          </Link>{" "}
          We&apos;ll import it as your active plan and log completions
          against it.
        </p>
      </section>
    </div>
  );
}
