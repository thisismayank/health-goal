import Link from "next/link";
import { PLAN_GOAL_TYPES } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/data";
import { GOAL_LABEL } from "@/lib/plan/goal-labels";
import { UploadPlanForm } from "./upload-form";
import { PlanSubNav } from "@/components/shell/plan-sub-nav";

export const dynamic = "force-dynamic";

const EXAMPLE_JSON = JSON.stringify(
  {
    name: "My uploaded plan",
    goalType: "race_5k",
    goalEvent: "Local 5k Oct 15",
    sessions: [
      {
        date: "2026-08-18",
        category: "EASY_RUN",
        title: "Easy Run",
        durationMinutes: 30,
        rpeMin: 3,
        rpeMax: 4,
        instructions: "Conversational pace.",
      },
      {
        date: "2026-08-20",
        category: "QUALITY_RUN",
        title: "Intervals",
        durationMinutes: 35,
        rpeMin: 7,
        rpeMax: 8,
        instructions: "5 × 400m at 5k pace, 2 min jog.",
      },
      {
        date: "2026-08-22",
        category: "EASY_RUN",
        title: "Long Easy",
        durationMinutes: 45,
      },
    ],
  },
  null,
  2,
);

export default async function UploadPlanPage() {
  await requireOnboardedUser();
  return (
    <div className="space-y-6">
      <PlanSubNav />
      <section>
        <h1 className="text-2xl font-semibold">Upload a plan</h1>
        <p className="text-sm text-muted mt-1">
          Paste plan JSON — from a coach, a workout builder, or a script.
          We&apos;ll validate every session before saving. This replaces
          your current active plan; history stays logged.
        </p>
      </section>

      <UploadPlanForm
        goalOptions={PLAN_GOAL_TYPES.map((g) => ({
          value: g,
          label: GOAL_LABEL[g],
        }))}
        exampleJson={EXAMPLE_JSON}
      />

      <section className="rounded-md border border-panel-border bg-panel/60 p-4 space-y-2 text-xs text-muted">
        <div className="text-[10px] font-mono uppercase tracking-widest">
          [FORMAT]
        </div>
        <p>
          <span className="text-foreground">name</span> · plan title.{" "}
          <span className="text-foreground">goalType</span> · one of:{" "}
          {PLAN_GOAL_TYPES.join(", ")}.{" "}
          <span className="text-foreground">sessions</span> · array of
          entries with{" "}
          <code className="text-blue-300">date</code>,{" "}
          <code className="text-blue-300">category</code>,{" "}
          <code className="text-blue-300">title</code>,{" "}
          <code className="text-blue-300">durationMinutes</code>. Optional:{" "}
          <code>rpeMin</code>, <code>rpeMax</code>, <code>instructions</code>,{" "}
          <code>strengthPrescription</code>.
        </p>
        <p className="italic pt-1">
          LLM coach feedback on uploaded plans is coming next — the
          coach will review your plan for gaps or overreach and
          suggest tweaks. For now upload persists as-is.
        </p>
      </section>
    </div>
  );
}
