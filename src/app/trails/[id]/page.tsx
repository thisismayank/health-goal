import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { trail } from "@/db/schema";
import { getCurrentUser } from "@/lib/data";
import { todayInTimeZone } from "@/lib/date";
import {
  assessTrail,
  STATUS_COLOR,
  STATUS_LABEL,
  VERDICT_COLOR,
  VERDICT_LABEL,
  type DimensionAnalysis,
  type TrailAssessment,
} from "@/lib/basecamp/trail-assessment";
import {
  generatePrepPlan,
  type PrepPlan,
} from "@/lib/basecamp/trail-prep-plan";
import { generateTrailNarrative } from "@/lib/coach/trail-narrative";
import { TrailDeleteButton } from "@/components/trail-actions";
import { CoachCardSkeleton } from "@/components/coach-cards";
import type { Trail as TrailRow } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function TrailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trailId = Number(id);
  if (!Number.isFinite(trailId)) notFound();

  const user = await getCurrentUser();
  if (!user) return <p className="text-muted">No user found.</p>;

  const [t] = await db
    .select()
    .from(trail)
    .where(and(eq(trail.id, trailId), eq(trail.userId, user.id)))
    .limit(1);
  if (!t) notFound();

  const today = todayInTimeZone(user.timezone);
  const assessment = await assessTrail(user.id, t, today);
  const prepPlan = generatePrepPlan(assessment, t);

  return (
    <div className="space-y-6">
      <section>
        <Link
          href="/trails"
          className="text-xs text-muted hover:text-foreground"
        >
          ← All trails
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{t.name}</h1>
        <div className="text-sm text-muted mt-1">
          {t.distanceKm} km · {t.elevationGainFt.toLocaleString()} ft gain ·
          max {t.maxAltitudeFt.toLocaleString()} ft · ~{t.typicalHours}h
          {t.packWeightLb > 0 && ` · ${t.packWeightLb} lb pack`} · {t.terrainGrade}
        </div>
        {t.targetDate && (
          <div className="text-sm mt-1">
            Target: <span className="text-blue-300">{t.targetDate}</span>
            {assessment.daysUntilTrail != null && (
              <span className="text-muted">
                {" "}· in {assessment.daysUntilTrail} day{assessment.daysUntilTrail === 1 ? "" : "s"}
              </span>
            )}
          </div>
        )}
        {t.url && (
          <a
            href={t.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-300 hover:underline mt-1 inline-block"
          >
            View route ↗
          </a>
        )}
      </section>

      <section className="rounded-md border border-blue-500/30 bg-blue-950/10 shadow-lg shadow-blue-500/10 p-5 space-y-3">
        <div className="text-xs font-mono uppercase tracking-widest text-blue-400">
          [READINESS ASSESSMENT]
        </div>
        <div className={`text-2xl font-medium ${VERDICT_COLOR[assessment.verdict]}`}>
          {VERDICT_LABEL[assessment.verdict]}
        </div>
        {assessment.weeksAvailable != null && (
          <div className="text-xs text-muted">
            Based on your current fitness with {assessment.weeksAvailable} weeks
            to prepare.
          </div>
        )}
        {assessment.weeksAvailable == null && (
          <div className="text-xs text-muted">
            No target date set — assessment reflects your current fitness only.
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-muted">
          Dimensions
        </h2>
        <div className="space-y-2">
          {assessment.dimensions.map((d) => (
            <DimensionCard key={d.key} d={d} />
          ))}
        </div>
      </section>

      {assessment.suggestedAdjustments.length > 0 && (
        <section className="rounded-md border border-panel-border bg-panel p-4 space-y-2">
          <h2 className="text-xs uppercase tracking-widest text-muted">
            Suggested adjustments
          </h2>
          <ul className="text-sm space-y-1 list-disc list-inside">
            {assessment.suggestedAdjustments.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      <Suspense fallback={<CoachCardSkeleton label="Coach · thinking" />}>
        <TrailCoachCard
          userId={user.id}
          trailRow={t}
          assessment={assessment}
          plan={prepPlan}
        />
      </Suspense>

      {prepPlan.kind === "generated" && <PrepPlanCard plan={prepPlan} />}

      {t.notes && (
        <section className="rounded-md border border-panel-border bg-panel/60 p-4">
          <div className="text-xs uppercase tracking-widest text-muted mb-1">
            Notes
          </div>
          <p className="text-sm text-muted italic">{t.notes}</p>
        </section>
      )}

      <section className="pt-4 border-t border-panel-border">
        <TrailDeleteButton trailId={t.id} />
      </section>
    </div>
  );
}

async function TrailCoachCard({
  userId,
  trailRow,
  assessment,
  plan,
}: {
  userId: number;
  trailRow: TrailRow;
  assessment: TrailAssessment;
  plan: PrepPlan;
}) {
  const narrative = await generateTrailNarrative(
    userId,
    trailRow,
    assessment,
    plan,
  );
  if (!narrative) return null;

  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-950/10 shadow-lg shadow-blue-500/10 p-5 space-y-4">
      <div className="text-xs font-mono uppercase tracking-widest text-blue-400">
        [COACH TAKE]
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-medium">{narrative.headline}</h3>
        <p className="text-sm leading-relaxed">{narrative.summary}</p>
      </div>

      {narrative.keyMoves.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-blue-300">
            Key moves before the day
          </div>
          <ul className="mt-1 space-y-0.5 text-sm">
            {narrative.keyMoves.map((m, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-blue-400">▸</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {narrative.onDay.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-blue-300">
            On the day
          </div>
          <ul className="mt-1 space-y-0.5 text-sm">
            {narrative.onDay.map((m, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-blue-400">▸</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {narrative.cutOffs.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-warn">
            Turn around if
          </div>
          <ul className="mt-1 space-y-0.5 text-sm">
            {narrative.cutOffs.map((m, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-warn">▸</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {narrative.planNarrative && (
        <p className="text-sm text-muted italic border-t border-blue-500/20 pt-3">
          {narrative.planNarrative}
        </p>
      )}
    </div>
  );
}

function PrepPlanCard({ plan }: { plan: Extract<PrepPlan, { kind: "generated" }> }) {
  return (
    <section className="rounded-md border border-panel-border bg-panel p-5 space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs uppercase tracking-widest text-muted">
          Prep plan · {plan.daysAvailable} days
        </h2>
        <span className="text-xs text-blue-300 uppercase tracking-wider">
          Focus: {plan.focus}
        </span>
      </div>

      <div className="text-xs text-muted">
        Weekly shape: {plan.weekly.longSessions} long · {plan.weekly.aerobicSessions} aerobic ·{" "}
        {plan.weekly.strengthSessions} strength · {plan.weekly.restDays} rest
      </div>

      <div className="space-y-2">
        {plan.progressions.map((p, i) => (
          <div
            key={i}
            className="rounded-md border border-panel-border bg-background/40 p-3 space-y-1"
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-sm font-medium">{p.weekLabel}</div>
              <div className="text-xs text-muted tabular-nums">
                {p.longSessionMin} min long
                {p.packLb > 0 && ` · ${p.packLb} lb pack`}
                {p.verticalTargetFt > 0 && ` · ~${p.verticalTargetFt.toLocaleString()} ft`}
              </div>
            </div>
            <div className="text-xs text-muted">{p.note}</div>
          </div>
        ))}
      </div>

      <div className="text-xs text-muted italic border-t border-panel-border pt-3">
        Then {plan.taperDays}-day taper: reduce volume by 40-50%, keep intensity
        light. This plan is display-only — it doesn't modify your active
        training plan.
      </div>

      {plan.alternativeSuggestion && (
        <div className="rounded-md border border-warn/30 bg-warn/5 p-3 text-sm text-warn">
          {plan.alternativeSuggestion}
        </div>
      )}
    </section>
  );
}

function DimensionCard({ d }: { d: DimensionAnalysis }) {
  return (
    <div className="rounded-md border border-panel-border bg-panel p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium">{d.label}</div>
        <span
          className={`text-[10px] font-mono uppercase tracking-wider ${STATUS_COLOR[d.status]}`}
        >
          [{STATUS_LABEL[d.status]}]
        </span>
      </div>
      <div className="text-xs text-muted flex gap-2 tabular-nums">
        <span>current: {d.current}</span>
        <span className="text-muted">→</span>
        <span>required: {d.required}</span>
      </div>
      <div className="h-1 bg-panel-border rounded overflow-hidden">
        <div
          className={`h-full transition-all ${
            d.status === "ready"
              ? "bg-accent"
              : d.status === "closable"
                ? "bg-blue-400"
                : d.status === "stretch" || d.status === "concern"
                  ? "bg-warn"
                  : d.status === "not_in_timeframe"
                    ? "bg-danger"
                    : "bg-panel-border"
          }`}
          style={{ width: `${Math.max(2, d.ratio * 100)}%` }}
        />
      </div>
      <p className="text-sm">{d.note}</p>
    </div>
  );
}
