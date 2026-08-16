import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { trail } from "@/db/schema";
import { getCurrentUser } from "@/lib/data";
import { todayInTimeZone } from "@/lib/date";
import { findTrailBySlug } from "@/lib/basecamp/trail-library";
import { presetToVirtualTrail } from "@/lib/basecamp/preset-trail";
import {
  assessTrail,
  STATUS_COLOR,
  STATUS_LABEL,
  VERDICT_COLOR,
  VERDICT_LABEL,
  type DimensionAnalysis,
  type Verdict,
} from "@/lib/basecamp/trail-assessment";
import { SavePresetButton } from "@/components/trails/save-preset-button";

export const dynamic = "force-dynamic";

const VERDICT_HEADLINE: Record<Verdict, string> = {
  comfortable: "You're ready.",
  achievable: "You can do this.",
  hard: "This will be a challenge.",
  do_not_attempt: "Not yet — build up first.",
};

const VERDICT_SUBHEAD: Record<Verdict, string> = {
  comfortable:
    "Your current fitness comfortably meets this trail's demands.",
  achievable:
    "Within reach at your current fitness — expect real effort, but you'll finish.",
  hard: "Doable, but at the edge of your current fitness. Real preparation recommended.",
  do_not_attempt:
    "Significant fitness gap. Attempting this at current level risks injury or turning back.",
};

export default async function PresetDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const preset = findTrailBySlug(slug);
  if (!preset) notFound();

  const user = await getCurrentUser();
  if (!user) return <p className="text-muted">No user found.</p>;

  const today = todayInTimeZone(user.timezone);
  const virtual = presetToVirtualTrail(preset, user.id);
  const assessment = await assessTrail(user.id, virtual, today);

  // Already saved?
  const [existing] = await db
    .select()
    .from(trail)
    .where(and(eq(trail.userId, user.id), eq(trail.presetSlug, slug)))
    .limit(1);

  const verdictColor = VERDICT_COLOR[assessment.verdict];

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/trails"
          className="text-xs text-muted hover:text-foreground"
        >
          ← Trail library
        </Link>
        <h1 className="text-2xl font-semibold mt-2 leading-tight">
          {preset.name}
        </h1>
        <div className="text-sm text-muted mt-0.5">{preset.region}</div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        <MetricPill label="Distance" value={`${preset.distanceKm}`} unit="km" />
        <MetricPill
          label="Vertical"
          value={`+${preset.elevationGainFt.toLocaleString()}`}
          unit="ft"
        />
        <MetricPill
          label="Max alt"
          value={`${preset.maxAltitudeFt.toLocaleString()}`}
          unit="ft"
        />
        <MetricPill
          label="Typical"
          value={`~${preset.typicalHours}`}
          unit="h"
        />
        {preset.packWeightLb > 0 && (
          <MetricPill
            label="Pack"
            value={`${preset.packWeightLb}`}
            unit="lb"
          />
        )}
        <MetricPill label="Terrain" value={preset.terrainGrade} />
      </div>

      {/* For You card */}
      <section
        className={`rounded-lg border p-5 space-y-3 ${
          assessment.verdict === "comfortable"
            ? "border-accent/50 bg-accent-strong/5 shadow-lg shadow-accent/10"
            : assessment.verdict === "achievable"
              ? "border-blue-500/40 bg-blue-950/10 shadow-lg shadow-blue-500/10"
              : assessment.verdict === "hard"
                ? "border-warn/40 bg-warn/5"
                : "border-danger/40 bg-danger/5"
        }`}
      >
        <div className="text-xs font-mono uppercase tracking-widest text-blue-400">
          [FOR YOU]
        </div>
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className={`text-3xl font-mono font-semibold ${verdictColor}`}>
            {VERDICT_LABEL[assessment.verdict]}
          </div>
          <div className="text-xs text-muted">
            based on last 60 days of your training
          </div>
        </div>
        <div>
          <div className="text-lg font-medium">
            {VERDICT_HEADLINE[assessment.verdict]}
          </div>
          <p className="text-sm text-foreground/80 mt-1 leading-relaxed">
            {VERDICT_SUBHEAD[assessment.verdict]}
          </p>
        </div>

        {assessment.suggestedAdjustments.length > 0 && (
          <div className="pt-2 border-t border-panel-border">
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
      </section>

      {/* Dimensions compact grid */}
      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-muted">
          Dimensions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {assessment.dimensions.map((d) => (
            <DimensionCompact key={d.key} d={d} />
          ))}
        </div>
      </section>

      {/* Save section or already-saved link */}
      {existing ? (
        <section className="rounded-md border border-blue-500/40 bg-blue-950/10 p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Already in your trails.</div>
            <div className="text-xs text-muted mt-0.5">
              {existing.targetDate
                ? `Target: ${existing.targetDate}`
                : "No target date set."}
            </div>
          </div>
          <Link
            href={`/trails/${existing.id}`}
            className="text-sm text-blue-300 hover:text-blue-200 whitespace-nowrap"
          >
            Open →
          </Link>
        </section>
      ) : (
        <section className="rounded-md border border-panel-border bg-panel p-4 space-y-3">
          <div>
            <div className="text-sm font-medium">Add to your trails</div>
            <div className="text-xs text-muted mt-0.5">
              Track progress toward this trail, get a prep plan, and see it in
              your goals.
            </div>
          </div>
          <SavePresetButton slug={preset.slug} />
        </section>
      )}

      {/* Trail info */}
      {preset.notes && (
        <section className="rounded-md border border-panel-border bg-panel/60 p-4">
          <div className="text-xs uppercase tracking-widest text-muted mb-1">
            About this trail
          </div>
          <p className="text-sm text-muted leading-relaxed">{preset.notes}</p>
        </section>
      )}

      <section className="text-xs text-muted italic">
        Trail data:{" "}
        {preset.sources.map((s, i) => (
          <span key={i}>
            {i > 0 && " · "}
            {s}
          </span>
        ))}
        . Numbers approximate — verify current conditions before attempting.
      </section>
    </div>
  );
}

function MetricPill({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </span>
      <span className="text-sm font-mono font-medium tabular-nums">{value}</span>
      {unit && <span className="text-[10px] text-muted">{unit}</span>}
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
