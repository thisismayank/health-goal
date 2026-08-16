import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { trail } from "@/db/schema";
import { getCurrentUser } from "@/lib/data";
import { TrailForm } from "@/components/trail-form";
import { TrailSearch } from "@/components/trail-search";

export const dynamic = "force-dynamic";

export default async function TrailsPage() {
  const user = await getCurrentUser();
  if (!user) return <p className="text-muted">No user found.</p>;

  const trails = await db
    .select()
    .from(trail)
    .where(eq(trail.userId, user.id))
    .orderBy(desc(trail.createdAt));

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Trails</h1>
        <p className="text-sm text-muted mt-1">
          Assess any hike against your current fitness. Get a verdict and specific
          adjustments — factoring endurance, vertical, pack, altitude, and recovery.
        </p>
      </section>

      {trails.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-widest text-muted">
            Your trails
          </h2>
          <div className="space-y-2">
            {trails.map((t) => (
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
                  <div className="font-medium truncate">
                    {t.isPrimary && (
                      <span className="text-blue-300 mr-1.5">★</span>
                    )}
                    {t.name}
                  </div>
                  {t.targetDate && (
                    <div className="text-xs text-muted whitespace-nowrap">
                      {t.targetDate}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted mt-1">
                  {t.distanceKm} km · {t.elevationGainFt.toLocaleString()} ft
                  gain · max {t.maxAltitudeFt.toLocaleString()} ft · ~
                  {t.typicalHours}h
                  {t.packWeightLb > 0 && ` · ${t.packWeightLb} lb pack`}
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
      )}

      <section className="rounded-lg border border-panel-border bg-panel p-5 space-y-4">
        <h2 className="text-lg font-medium">Add from library</h2>
        <TrailSearch />
      </section>

      <details className="rounded-lg border border-panel-border bg-panel p-5 group">
        <summary className="cursor-pointer text-lg font-medium select-none">
          Or add a custom trail
        </summary>
        <div className="mt-4">
          <TrailForm />
        </div>
      </details>

      <p className="text-xs text-muted italic">
        Preset data sourced from Wikipedia (CC-BY-SA), NPS.gov (public domain),
        USGS, and guidebook consensus. Numbers approximate — verify current
        conditions before attempting.
      </p>
    </div>
  );
}
