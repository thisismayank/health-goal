import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { trail, trailCompletion } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/data";
import { todayInTimeZone } from "@/lib/date";
import type { TrailPreset } from "@/lib/basecamp/trail-library";
import { getFullTrailLibrary } from "@/lib/basecamp/trail-coords";
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
import { TrailPhoto } from "@/components/trails/trail-photo";
import { getSquadCompletionsForPreset } from "@/lib/squad/queries";
import { computeCharacterSheet } from "@/lib/basecamp/stats";
import { computeRank } from "@/lib/basecamp/rank";
import {
  estimatePersonalHours,
  formatHoursCasual,
} from "@/lib/basecamp/personal-time";
import { formatFt, formatKm, formatPackLb, pickUnits, type Units } from "@/lib/units";

export const dynamic = "force-dynamic";

const VERDICT_HEADLINE: Record<Verdict, string> = {
  comfortable: "You're ready.",
  achievable: "Ready with focused prep.",
  hard: "Stretch objective — real effort needed.",
  do_not_attempt: "Not without more prep or a guide.",
};

const VERDICT_SUBHEAD: Record<Verdict, string> = {
  comfortable:
    "Your current fitness comfortably meets this trail's demands.",
  achievable:
    "Within reach at your current fitness with a short training block. Expect real effort but you'll finish.",
  hard: "Well above your current fitness. Go slower than the guide time, take breaks, expect to feel it the next day. Read the tips below.",
  do_not_attempt:
    "Significant gap between your current fitness/experience and this objective. Attempting at current level risks injury or having to turn back — hire a guide or extend the timeline.",
};

export default async function PresetDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Always resolve through getFullTrailLibrary so the Tier A detail
  // overlay (permits, best months, water, etc. from trail-details.ts)
  // gets applied. findTrailBySlug alone reads the raw library and
  // misses the overlay.
  const preset = getFullTrailLibrary().find((t) => t.slug === slug);
  if (!preset) notFound();

  const user = await requireOnboardedUser();

  const today = todayInTimeZone(user.timezone);
  const virtual = presetToVirtualTrail(preset, user.id);
  const assessment = await assessTrail(user.id, virtual, today);

  // Already saved?
  const [existing] = await db
    .select()
    .from(trail)
    .where(and(eq(trail.userId, user.id), eq(trail.presetSlug, slug)))
    .limit(1);

  // Any completions for this preset (via saved trail)?
  const completions = existing
    ? await db
        .select()
        .from(trailCompletion)
        .where(
          and(
            eq(trailCompletion.trailId, existing.id),
            eq(trailCompletion.userId, user.id),
          ),
        )
        .orderBy(desc(trailCompletion.completedAt))
    : [];

  const squadCompletions = await getSquadCompletionsForPreset(user.id, slug);
  const squadmatesOnly = squadCompletions.filter((c) => !c.isYou);

  const verdictColor = VERDICT_COLOR[assessment.verdict];

  const rank = computeRank(await computeCharacterSheet(user.id));
  const personalHours = estimatePersonalHours(preset.typicalHours, rank.current);
  const units = pickUnits(user);

  return (
    <div className="space-y-5">
      {/* Hero top-band. Photo when the trail has one; topo-line SVG
          fallback otherwise. Renders full-bleed under the shell padding
          via a negative-margin trick that respects the max-w container. */}
      <div className="relative -mx-4 sm:-mx-6 md:mx-0 md:rounded-lg overflow-hidden">
        <TrailPhoto preset={preset} aspect="wide" priority showAttribution />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 space-y-1">
          <Link
            href="/trails"
            className="inline-block text-[11px] text-white/70 hover:text-white bg-black/40 backdrop-blur px-2 py-0.5 rounded"
          >
            ← Trail library
          </Link>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-tight drop-shadow-lg">
            {preset.name}
          </h1>
          <div className="text-sm text-white/80 drop-shadow">
            {preset.region}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        <MetricPill label="Distance" value={formatKm(preset.distanceKm, units)} />
        <MetricPill
          label="Vertical"
          value={`+${formatFt(preset.elevationGainFt, units)}`}
        />
        <MetricPill
          label="Max alt"
          value={formatFt(preset.maxAltitudeFt, units)}
        />
        <MetricPill
          label="Typical"
          value={`~${preset.typicalHours}`}
          unit="h"
        />
        <MetricPill
          label="For you"
          value={`aim ~${formatHoursCasual(personalHours)}`}
          highlight
        />
        {preset.packWeightLb > 0 && (
          <MetricPill
            label="Pack"
            value={formatPackLb(preset.packWeightLb, units)}
          />
        )}
        <MetricPill label="Terrain" value={preset.terrainGrade} />
      </div>

      {completions.length > 0 && (
        <section className="rounded-md border border-accent/40 bg-accent-strong/5 px-4 py-3 flex items-baseline justify-between gap-3">
          <div className="text-sm">
            <span className="text-accent font-mono">✓</span>{" "}
            <span className="font-medium">You've done this </span>
            <span className="font-mono text-accent">{completions.length}</span>
            <span className="font-medium">
              {" "}
              time{completions.length === 1 ? "" : "s"}
            </span>
            <span className="text-muted"> · last {completions[0].completedAt}</span>
          </div>
          {existing && (
            <Link
              href={`/trails/${existing.id}`}
              className="text-xs text-blue-300 hover:underline whitespace-nowrap"
            >
              View history →
            </Link>
          )}
        </section>
      )}

      {squadmatesOnly.length > 0 && (
        <section className="rounded-md border border-blue-500/40 bg-blue-950/10 p-4 space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-blue-300">
            [YOUR SQUAD · DID THIS TRAIL]
          </div>
          <ul className="divide-y divide-panel-border">
            {squadmatesOnly.slice(0, 5).map((c, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between gap-3 py-1.5 text-sm"
              >
                <span className="font-medium truncate">{c.userName}</span>
                <span className="text-xs text-muted tabular-nums whitespace-nowrap">
                  {c.completedAt}
                  {c.timeMinutes != null && (
                    <span> · {formatMinutes(c.timeMinutes)}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {squadmatesOnly.length > 5 && (
            <div className="text-[10px] text-muted italic">
              + {squadmatesOnly.length - 5} more
            </div>
          )}
        </section>
      )}

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
          {assessment.weeksToReady != null && (
            <p className="text-sm text-blue-300/90 mt-2 leading-relaxed">
              At your current trajectory, closing the biggest gap takes about{" "}
              <span className="font-mono font-medium text-blue-200 tabular-nums">
                {assessment.weeksToReady} week
                {assessment.weeksToReady === 1 ? "" : "s"}
              </span>
              .
            </p>
          )}
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

      <TrailDetailsSection preset={preset} units={units} />

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

// Tier A trail details — renders only when the trail has any of the
// hand-curated fields set (see lib/basecamp/trail-details.ts). Missing
// fields degrade gracefully; nothing shows when nothing is set.
function TrailDetailsSection({
  preset,
  units,
}: {
  preset: TrailPreset;
  units: Units;
}) {
  const {
    steepestGradePct,
    routeShape,
    bestMonths,
    waterOnRoute,
    permitRequired,
    permitNotes,
    cellReception,
    parkingNotes,
  } = preset;
  const hasAny =
    steepestGradePct != null ||
    routeShape != null ||
    (bestMonths?.length ?? 0) > 0 ||
    waterOnRoute != null ||
    permitRequired != null ||
    cellReception != null ||
    parkingNotes != null;
  if (!hasAny) return null;

  // Compute avg grade from what we already have — no data-sourcing
  // needed. Rendered alongside steepest so the "steepest 45%" reads
  // in context (avg 12% + steepest 45% = one bad section, not the
  // whole trail).
  const distanceM = preset.distanceKm * 1000;
  const gainM = preset.elevationGainFt * 0.3048;
  const avgGradePct =
    distanceM > 0 ? Math.round((gainM / distanceM) * 100) : null;

  return (
    <section className="rounded-md border border-panel-border bg-panel/60 p-4 space-y-3">
      <div className="text-xs uppercase tracking-widest text-muted">
        Trail details
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
        {routeShape && (
          <DetailRow label="Route shape" value={ROUTE_SHAPE_LABEL[routeShape]} />
        )}
        {avgGradePct != null && (
          <DetailRow
            label="Grade"
            value={`avg ${avgGradePct}%${steepestGradePct != null ? ` · steepest ${steepestGradePct}%` : ""}`}
          />
        )}
        {bestMonths && bestMonths.length > 0 && (
          <DetailRow label="Best months" value={bestMonths.join(" · ")} />
        )}
        {waterOnRoute && <DetailRow label="Water" value={waterOnRoute} />}
        {cellReception && (
          <DetailRow
            label="Cell reception"
            value={CELL_LABEL[cellReception]}
          />
        )}
        {parkingNotes && <DetailRow label="Access" value={parkingNotes} />}
        {permitRequired != null && (
          <DetailRow
            label="Permit"
            value={
              permitRequired
                ? `Required${permitNotes ? " — " + permitNotes : ""}`
                : permitNotes ?? "None"
            }
            fullWidth={permitRequired && !!permitNotes}
          />
        )}
      </dl>
      {units === "metric" && steepestGradePct != null && null}
    </section>
  );
}

function DetailRow({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : ""}>
      <dt className="text-[10px] font-mono uppercase tracking-widest text-muted">
        {label}
      </dt>
      <dd className="text-foreground/90 mt-0.5 leading-snug">{value}</dd>
    </div>
  );
}

const ROUTE_SHAPE_LABEL: Record<
  NonNullable<TrailPreset["routeShape"]>,
  string
> = {
  out_and_back: "Out & back",
  loop: "Loop",
  point_to_point: "Point-to-point",
};

const CELL_LABEL: Record<
  NonNullable<TrailPreset["cellReception"]>,
  string
> = {
  none: "None — carry a beacon",
  patchy: "Patchy",
  reliable: "Reliable",
};

function MetricPill({
  label,
  value,
  unit,
  highlight = false,
}: {
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean;
}) {
  const labelCls = highlight
    ? "text-[10px] uppercase tracking-wider text-blue-400"
    : "text-[10px] uppercase tracking-wider text-muted";
  const valueCls = highlight
    ? "text-sm font-mono font-medium tabular-nums text-blue-300"
    : "text-sm font-mono font-medium tabular-nums";
  return (
    <div className="flex items-baseline gap-1">
      <span className={labelCls}>{label}</span>
      <span className={valueCls}>{value}</span>
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

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}m`;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}
