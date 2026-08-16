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
} from "@/lib/basecamp/trail-assessment";
import { TrailDeleteButton } from "@/components/trail-actions";

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
