import { Suspense } from "react";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { trail } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/data";
import { allTrails } from "@/lib/basecamp/trail-library";
import { TrailForm } from "@/components/trail-form";
import { TrailsSubNav } from "@/components/shell/trails-sub-nav";
import { TrailIcon } from "@/components/ui/icons";
import { formatFt, formatKm, formatPackLb, pickUnits } from "@/lib/units";
import { NearMeSection } from "@/components/trails/near-me-section";

export const dynamic = "force-dynamic";

/**
 * Trails landing page. Restructured after Devin's review:
 *
 *   1. Your saved trails, front and center (was buried below the catalog)
 *   2. Discover CTA (destination-first, the differentiated flow)
 *   3. Small entries to backfill + library browser + custom trail form
 *
 * The full alphabetical catalog moved to /trails/library so we're not
 * stuck with a nested scroll container on mobile.
 */
export default async function TrailsPage() {
  const user = await requireOnboardedUser();
  const units = pickUnits(user);

  const savedTrails = await db
    .select()
    .from(trail)
    .where(eq(trail.userId, user.id))
    .orderBy(desc(trail.createdAt));

  return (
    <div className="space-y-6">
      <TrailsSubNav />

      <section>
        <h1 className="text-2xl font-semibold">Trails</h1>
        <p className="text-sm text-muted mt-1">
          Your saved trails, plus a destination-first search that ranks
          hikes for your current fitness.
        </p>
      </section>

      {/* Near-me feed. Silent when the user hasn't set a home base;
          when set, we surface ready + achievable trails within 200mi
          so weekend planning starts from "what's actually reachable"
          rather than an empty search box. */}
      <Suspense fallback={null}>
        <NearMeSection user={user} />
      </Suspense>

      {/* Your trails — front-and-center, per Devin */}
      {savedTrails.length > 0 ? (
        <section className="space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
            [YOUR TRAILS · {savedTrails.length}]
          </div>
          <div className="space-y-2">
            {savedTrails.map((t) => (
              <Link
                key={t.id}
                href={`/trails/${t.id}`}
                className={`block rounded-md border px-4 py-3 hover:border-blue-500/40 transition ${
                  t.isPrimary
                    ? "border-blue-500/60 bg-blue-950/20"
                    : "border-panel-border bg-panel"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-medium truncate flex items-center gap-2">
                    {t.isPrimary && (
                      <span className="text-blue-300" title="Primary goal">
                        ★
                      </span>
                    )}
                    {t.name}
                  </div>
                  {t.targetDate && (
                    <div className="text-xs text-muted whitespace-nowrap font-mono tabular-nums">
                      {t.targetDate}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted mt-1">
                  {formatKm(t.distanceKm, units)} · +
                  {formatFt(t.elevationGainFt, units)} gain · max{" "}
                  {formatFt(t.maxAltitudeFt, units)} · ~{t.typicalHours}h
                  {t.packWeightLb > 0 &&
                    ` · ${formatPackLb(t.packWeightLb, units)} pack`}
                  {t.isPrimary && (
                    <span className="text-blue-300 ml-2 font-mono uppercase tracking-wider text-[10px]">
                      · primary goal
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-md border border-panel-border bg-panel/40 p-4 text-sm text-muted space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
            [NO SAVED TRAILS YET]
          </div>
          <p className="leading-relaxed">
            Save a trail from Discover or the library to see its personalized
            readiness rating, and set one as your primary goal.
          </p>
        </section>
      )}

      {/* Discover — destination-first, the flagship flow */}
      <Link
        href="/trails/discover"
        className="block rounded-lg border border-accent/50 bg-accent-strong/5 shadow-lg shadow-accent/10 p-4 hover:border-accent transition"
      >
        <div className="text-xs font-mono uppercase tracking-widest text-accent">
          [PLANNING A TRIP?]
        </div>
        <div className="text-base font-medium mt-1">
          Show me hikes at a destination → ranked for me
        </div>
        <div className="text-xs text-muted mt-0.5">
          Type a national park or region — see which hikes are actually
          right for your fitness right now.
        </div>
      </Link>

      {/* Small entries to library + backfill + custom */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Link
          href="/trails/library"
          className="rounded-md border border-panel-border bg-panel/60 p-3 hover:border-blue-500/40 transition"
        >
          <div className="text-xs font-medium flex items-center gap-2">
            <TrailIcon size={14} className="text-blue-300" />
            Browse the library
          </div>
          <div className="text-[11px] text-muted mt-0.5">
            {allTrails().length} curated presets with filters
          </div>
        </Link>

        <Link
          href="/trails/backfill"
          className="rounded-md border border-panel-border bg-panel/60 p-3 hover:border-blue-500/40 transition"
        >
          <div className="text-xs font-medium">Backfill from history →</div>
          <div className="text-[11px] text-muted mt-0.5">
            Match your Garmin / Strava hikes to trails
          </div>
        </Link>
      </div>

      <details className="rounded-lg border border-panel-border bg-panel p-4 group">
        <summary className="cursor-pointer text-sm text-muted select-none hover:text-foreground">
          Can&apos;t find a trail? Add a custom one.
        </summary>
        <div className="mt-4">
          <TrailForm />
        </div>
      </details>
    </div>
  );
}
