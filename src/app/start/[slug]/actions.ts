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
import { writeSeed } from "@/lib/cold-start/seed";

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
  | { ok: true; assessment: TrailAssessment }
  | { ok: false; error: string }
> {
  const preset =
    findTrailBySlug(input.slug) ??
    getFullTrailLibrary().find((p) => p.slug === input.slug);
  if (!preset) return { ok: false, error: "Trail not found" };

  const snap = synthSnapshot(input.answers);
  // Anon sentinel userId — assessTrail ignores userId when both
  // snapshot and userClassIndex are provided (verified by tracing
  // the analyzers; no DB queries on this path).
  const virtual = presetToVirtualTrail(preset, -1);
  // Class E baseline for cold-start. Terrain gate still catches
  // mountaineering / technical requirements independent of the
  // user's aerobic self-report — that's the safety net.
  const assessment = await assessTrail(-1, virtual, todayInTimeZone("UTC"), {
    snapshot: snap,
    userClassIndex: 0,
  });
  return { ok: true, assessment };
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
  // Login accepts a ?next= parameter; post-login redirects there.
  redirect("/login?next=/onboarding/seed");
}
