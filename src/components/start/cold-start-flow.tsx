"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { assessColdStart, startFromColdStart } from "@/app/start/[slug]/actions";
import type { ColdStartAnswers } from "@/lib/basecamp/synthetic-snapshot";
import {
  STATUS_COLOR,
  STATUS_LABEL,
  VERDICT_COLOR,
  VERDICT_HEADLINE,
  VERDICT_LABEL,
  VERDICT_SUBHEAD,
} from "@/lib/basecamp/verdict-labels";
// Type-only import — erased at runtime, so importing from the
// server-only trail-assessment module doesn't pull DB code into
// the client bundle.
import type {
  DimensionAnalysis,
  TrailAssessment,
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
        We don&apos;t save anything until you sign up. The verdict comes
        from your three answers — nothing else.
      </p>
    </section>
  );
}

// -------- pieces --------

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
        <p className="text-sm text-foreground/80 mt-1 leading-relaxed">
          {VERDICT_SUBHEAD[assessment.verdict]}
        </p>
        {assessment.weeksToReady != null ? (
          <p className="text-sm text-blue-300/90 mt-2 leading-relaxed">
            At your current trajectory, closing the biggest gap takes about{" "}
            <span className="font-mono font-medium text-blue-200 tabular-nums">
              {assessment.weeksToReady} week
              {assessment.weeksToReady === 1 ? "" : "s"}
            </span>
            .
          </p>
        ) : assessment.verdict !== "comfortable" &&
          assessment.verdict !== "do_not_attempt" ? (
          <p className="text-sm text-muted mt-2 leading-relaxed">
            Not enough to estimate weeks-to-ready from three answers alone —
            the plan builds toward the peak and this number fills in as
            training accumulates.
          </p>
        ) : null}
      </div>

      {assessment.suggestedAdjustments.length > 0 && (
        <div className="pt-3 border-t border-panel-border/60">
          <div className="text-xs uppercase tracking-widest text-muted mb-1.5">
            How to close the gap
          </div>
          <ul className="text-sm space-y-1">
            {assessment.suggestedAdjustments.slice(0, 3).map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-blue-400">▸</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="pt-3 border-t border-panel-border/60 space-y-2">
        <div className="text-xs uppercase tracking-widest text-muted">
          Dimensions
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {assessment.dimensions
            .filter((d) => d.status !== "not_applicable")
            .map((d) => (
              <DimensionCompact key={d.key} d={d} />
            ))}
        </div>
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
          Free · magic-link email · your answers carry into signup
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

function DimensionCompact({ d }: { d: DimensionAnalysis }) {
  const barColor =
    d.status === "ready"
      ? "bg-accent"
      : d.status === "closable"
        ? "bg-blue-400"
        : d.status === "stretch" || d.status === "concern"
          ? "bg-warn"
          : d.status === "not_in_timeframe"
            ? "bg-danger"
            : d.status === "unknown"
              ? "bg-panel-border/60"
              : "bg-panel-border";
  return (
    <div className="rounded-md border border-panel-border bg-panel p-3 space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{d.label}</span>
        <span
          className={`text-[10px] font-mono uppercase tracking-wider ${STATUS_COLOR[d.status]}`}
        >
          [{STATUS_LABEL[d.status]}]
        </span>
      </div>
      <div className="h-1 bg-panel-border rounded overflow-hidden">
        <div
          className={`h-full transition-all ${barColor}`}
          style={{ width: `${Math.max(2, d.ratio * 100)}%` }}
        />
      </div>
      <div className="text-[11px] text-muted">
        {d.current} → target {d.required}
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
