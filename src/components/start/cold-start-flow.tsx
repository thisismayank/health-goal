"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { assessColdStart, startFromColdStart } from "@/app/start/[slug]/actions";
import type { ColdStartAnswers } from "@/lib/basecamp/synthetic-snapshot";
import type {
  DimensionAnalysis,
  TrailAssessment,
  Verdict,
} from "@/lib/basecamp/trail-assessment";

/**
 * Three-question form → verdict card, on one page.
 *
 * Devin r3 cold-start: the whole acquisition wedge is "pick a hike →
 * answer 3 things → get a verdict." No account, no plan-gen delay,
 * no navigation between steps. The verdict card is the same shape
 * authed users see on /trails/preset/[slug] — same monotonic ladder,
 * same dimension breakdown, same reasoning.
 */
export function ColdStartFlow({
  slug,
  presetName,
}: {
  slug: string;
  presetName: string;
}) {
  const [answers, setAnswers] = useState<Partial<ColdStartAnswers>>({});
  const [assessment, setAssessment] = useState<TrailAssessment | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allAnswered =
    answers.longestHikeBucket != null &&
    answers.weeklyHoursBucket != null &&
    answers.priorAltBucket != null;

  const submit = () => {
    if (!allAnswered) return;
    setError(null);
    startTransition(async () => {
      const res = await assessColdStart({
        slug,
        answers: answers as ColdStartAnswers,
      });
      if (res.ok) {
        setAssessment(res.assessment);
      } else {
        setError(res.error);
      }
    });
  };

  const start = () => {
    if (!allAnswered) return;
    startTransition(async () => {
      await startFromColdStart({
        slug,
        answers: answers as ColdStartAnswers,
      });
    });
  };

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-panel-border bg-panel p-4 space-y-4">
        <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
          [ 3 QUESTIONS ]
        </div>

        <Question
          label="What's your longest hike in the past year?"
          value={answers.longestHikeBucket}
          onChange={(v) => setAnswers((a) => ({ ...a, longestHikeBucket: v }))}
          options={[
            ["never", "Never / rarely hike"],
            ["under_3", "Under 3 hours"],
            ["3_to_6", "3–6 hours"],
            ["6_to_10", "6–10 hours"],
            ["over_10", "10+ hours"],
          ]}
        />

        <Question
          label="How much training do you do in a typical week?"
          value={answers.weeklyHoursBucket}
          onChange={(v) => setAnswers((a) => ({ ...a, weeklyHoursBucket: v }))}
          options={[
            ["zero", "Not much"],
            ["1_to_3", "1–3 hours"],
            ["3_to_6", "3–6 hours"],
            ["over_6", "6+ hours"],
          ]}
        />

        <Question
          label="Highest altitude you've been to in the past year?"
          value={answers.priorAltBucket}
          onChange={(v) => setAnswers((a) => ({ ...a, priorAltBucket: v }))}
          options={[
            ["never_above_6k", "Never above 6,000 ft"],
            ["to_8_10k", "8–10,000 ft"],
            ["to_12_14k", "12–14,000 ft"],
            ["above_14k", "Above 14,000 ft"],
          ]}
        />

        {!assessment && (
          <button
            type="button"
            onClick={submit}
            disabled={!allAnswered || pending}
            className="w-full rounded-md bg-accent-strong hover:bg-accent text-background font-medium text-sm py-2.5 disabled:opacity-50"
          >
            {pending ? "Scoring…" : "See my verdict →"}
          </button>
        )}
        {error && (
          <p className="text-xs text-danger" role="alert">
            {error}
          </p>
        )}
      </div>

      {assessment && (
        <VerdictCard
          assessment={assessment}
          presetName={presetName}
          onStart={start}
          startPending={pending}
        />
      )}

      <p className="text-[11px] text-muted">
        We don&apos;t save anything until you sign up. The verdict runs on
        your device from your answers alone — no tracking.
      </p>
    </section>
  );
}

// -------- pieces --------

const VERDICT_HEADLINE: Record<Verdict, string> = {
  comfortable: "You're ready.",
  achievable: "Ready with focused prep.",
  hard: "Stretch objective — real effort needed.",
  do_not_attempt: "Not without more prep or a guide.",
};

const VERDICT_COLOR: Record<Verdict, string> = {
  comfortable: "text-accent",
  achievable: "text-blue-300",
  hard: "text-warn",
  do_not_attempt: "text-danger",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  comfortable: "Ready",
  achievable: "Ready with prep",
  hard: "Hard — stretch objective",
  do_not_attempt: "Not without prep or a guide",
};

const STATUS_LABEL: Record<DimensionAnalysis["status"], string> = {
  ready: "READY",
  closable: "CLOSABLE",
  stretch: "STRETCH",
  concern: "CONCERN",
  not_in_timeframe: "GAP",
  unknown: "UNKNOWN",
  not_applicable: "N/A",
};

const STATUS_COLOR: Record<DimensionAnalysis["status"], string> = {
  ready: "text-accent",
  closable: "text-blue-300",
  stretch: "text-warn",
  concern: "text-warn",
  not_in_timeframe: "text-danger",
  unknown: "text-muted",
  not_applicable: "text-muted",
};

function VerdictCard({
  assessment,
  presetName,
  onStart,
  startPending,
}: {
  assessment: TrailAssessment;
  presetName: string;
  onStart: () => void;
  startPending: boolean;
}) {
  const border =
    assessment.verdict === "comfortable"
      ? "border-accent/50 bg-accent-strong/5 shadow-lg shadow-accent/10"
      : assessment.verdict === "achievable"
        ? "border-blue-500/40 bg-blue-950/10 shadow-lg shadow-blue-500/10"
        : assessment.verdict === "hard"
          ? "border-warn/40 bg-warn/5"
          : "border-danger/40 bg-danger/5";
  return (
    <div className={`rounded-lg border p-5 space-y-4 ${border}`}>
      <div className="text-xs font-mono uppercase tracking-widest text-blue-400">
        [ FOR YOU ]
      </div>
      <div>
        <div
          className={`text-3xl font-mono font-semibold ${VERDICT_COLOR[assessment.verdict]}`}
        >
          {VERDICT_LABEL[assessment.verdict]}
        </div>
        <div className="text-base font-medium mt-2">
          {VERDICT_HEADLINE[assessment.verdict]}
        </div>
        {assessment.weeksToReady != null && (
          <p className="text-sm text-blue-300/90 mt-2">
            About {assessment.weeksToReady} week
            {assessment.weeksToReady === 1 ? "" : "s"} of focused training
            closes the biggest gap.
          </p>
        )}
      </div>

      <div className="space-y-1.5 pt-2 border-t border-panel-border/60">
        {assessment.dimensions
          .filter((d) => d.status !== "not_applicable")
          .map((d) => (
            <div
              key={d.key}
              className="flex items-baseline justify-between gap-3 text-xs"
            >
              <div className="text-foreground/90 capitalize">{d.label}</div>
              <div
                className={`font-mono uppercase tracking-wider ${STATUS_COLOR[d.status]}`}
              >
                {STATUS_LABEL[d.status]}
              </div>
            </div>
          ))}
      </div>

      <div className="pt-3 border-t border-panel-border/60 space-y-2">
        <button
          type="button"
          onClick={onStart}
          disabled={startPending}
          className="w-full rounded-md bg-accent-strong hover:bg-accent text-background font-medium text-sm py-2.5 disabled:opacity-50"
        >
          {startPending
            ? "Starting…"
            : `Get the training plan for ${short(presetName)} →`}
        </button>
        <div className="text-[11px] text-muted text-center">
          Signup with email · no password · answers carry over
        </div>
        <Link
          href="/start"
          className="block text-center text-[11px] text-muted hover:text-foreground pt-1"
        >
          ← Pick a different hike
        </Link>
      </div>
    </div>
  );
}

function Question<V extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: V | undefined;
  onChange: (v: V) => void;
  options: [V, string][];
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm text-foreground/90">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([val, text]) => (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              value === val
                ? "border-blue-500/60 bg-blue-500/15 text-blue-200"
                : "border-panel-border bg-panel text-muted hover:text-foreground hover:border-blue-500/40"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function short(name: string): string {
  // "Mount Rainier — Disappointment Cleaver" → "Mount Rainier"
  return name.split(/[—–-]/)[0].trim();
}
