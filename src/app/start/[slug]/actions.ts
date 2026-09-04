"use server";

import { redirect } from "next/navigation";
import { findTrailBySlug } from "@/lib/basecamp/trail-library";
import { getFullTrailLibrary } from "@/lib/basecamp/trail-coords";
import { presetToVirtualTrail } from "@/lib/basecamp/preset-trail";
import {
  assessTrail,
  type TrailAssessment,
} from "@/lib/basecamp/trail-assessment";
import { todayInTimeZone } from "@/lib/date";
import {
  synthSnapshot,
  type ColdStartAnswers,
} from "@/lib/basecamp/synthetic-snapshot";
import {
  inferGoalTypeFromPreset,
  mapAnswersToPlanConstraints,
} from "@/lib/basecamp/cold-start-baseline";
import { computeWeek1Preview, type PlanPreview } from "@/lib/plan/preview";
import { writeSeed } from "@/lib/cold-start/seed";
import { track } from "@/lib/analytics/track";

/**
 * Cold-start assessment. Pure — takes the stranger's answers +
 * a preset slug, returns a TrailAssessment. No DB reads, no auth,
 * no side effects. Runs the same worst-dim gating + terrain gate
 * as the authed preset detail page.
 */
export async function assessColdStart(input: {
  slug: string;
  answers: ColdStartAnswers;
}): Promise<
  | { ok: true; assessment: TrailAssessment; preview: PlanPreview }
  | { ok: false; error: string }
> {
  const preset =
    findTrailBySlug(input.slug) ??
    getFullTrailLibrary().find((p) => p.slug === input.slug);
  if (!preset) return { ok: false, error: "Trail not found" };

  const snap = synthSnapshot(input.answers);
  // Anon sentinel userId — assessTrail ignores userId when snapshot
  // + userClassIndex are provided (verified by tracing the analyzers;
  // no DB queries on this path).
  const virtual = presetToVirtualTrail(preset, -1);
  // Class comes from the same 3 answers, capped at C. Flagged
  // unverified so analyzeTerrain returns UNKNOWN (not READY) when
  // the class meets the trail's requirement — safety guardrail.
  const assessment = await assessTrail(-1, virtual, todayInTimeZone("UTC"), {
    snapshot: snap,
    userClassIndex: snap.classIndex,
    userClassVerified: snap.classVerified,
  });

  // Week-1 preview so the verdict card can show 3 session titles +
  // total hours right above the "Get the training plan" CTA — the
  // bridge between "here's your verdict" and "here's what you get."
  // Same generator logic /onboarding/seed will actually create.
  const { weeklyHours, startingFitness } = mapAnswersToPlanConstraints(
    input.answers,
  );
  const preview = computeWeek1Preview({
    goalType: inferGoalTypeFromPreset(preset),
    weeklyHours,
    startingFitness,
  });

  await track("verdict_shown", {
    properties: {
      slug: input.slug,
      verdict: assessment.verdict,
      weeksToReady: assessment.weeksToReady,
    },
  });
  return { ok: true, assessment, preview };
}

/**
 * "Get the training plan" CTA. Writes the seed cookie and redirects
 * into the magic-link flow with a post-login return path that
 * consumes the seed and creates the trail + starts /plan/new.
 */
export async function startFromColdStart(input: {
  slug: string;
  answers: ColdStartAnswers;
}): Promise<void> {
  await writeSeed({ slug: input.slug, answers: input.answers });
  await track("get_plan_clicked", { properties: { slug: input.slug } });
  // Login accepts a ?next= parameter; post-login redirects there.
  redirect("/login?next=/onboarding/seed");
}
