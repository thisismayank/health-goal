import Link from "next/link";
import { findTrailBySlug } from "@/lib/basecamp/trail-library";
import { getFullTrailLibrary } from "@/lib/basecamp/trail-coords";
import { HERO_TRAILS } from "@/lib/basecamp/hero-trails";
import { TrailPhoto } from "@/components/trails/trail-photo";

// Public — no auth. A stranger's first tap should already be about
// picking a hike, not signing up.
export const dynamic = "force-static";

/**
 * Cold-start landing. Grid of 6-8 hero trails a stranger recognizes
 * (Rainier, Denali, Whitney, Kili, EBC, Wonderland, Angels Landing,
 * Bear Mtn). Tapping one drops the user into a 3-question form + a
 * verdict card in one screen. Signup only comes AFTER they've seen
 * a personalized read on the objective they care about.
 */
export default function StartPage() {
  const trails = HERO_TRAILS.map((h) => {
    const preset =
      findTrailBySlug(h.slug) ??
      getFullTrailLibrary().find((p) => p.slug === h.slug);
    return { ...h, preset };
  }).filter(
    (
      t,
    ): t is typeof t & { preset: NonNullable<(typeof t)["preset"]> } =>
      t.preset != null,
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-5 py-4 flex items-baseline justify-between gap-3 border-b border-panel-border/60">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-mono font-semibold text-blue-300">
            Basecamp
          </span>
          <span className="text-[11px] text-muted">
            training for the hike you're actually going on
          </span>
        </div>
        <Link
          href="/login"
          className="text-xs text-muted hover:text-foreground"
        >
          Sign in →
        </Link>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-5 py-8 space-y-6">
        <section>
          <h1 className="text-2xl font-semibold leading-tight">
            Pick a hike. Answer three questions. See if you're ready.
          </h1>
          <p className="text-sm text-muted mt-2 leading-relaxed">
            No account needed to try it. We&apos;ll score the trail against
            your current fitness, tell you the honest verdict, and — if
            you like it — build a training plan to get you there.
          </p>
          <p className="text-[11px] text-muted mt-3 italic">
            Free during beta. Solo dev, mountaineer + software. No card,
            no upsell.
          </p>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {trails.map(({ slug, hook, preset }) => (
            <Link
              key={slug}
              href={`/start/${slug}`}
              className="group rounded-lg border border-panel-border bg-panel overflow-hidden hover:border-blue-500/50 transition"
            >
              <div className="relative">
                <TrailPhoto preset={preset} aspect="tile" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="text-base font-semibold text-white leading-tight drop-shadow-lg truncate">
                    {preset.name}
                  </div>
                  <div className="text-[11px] text-white/70 drop-shadow">
                    {preset.region}
                  </div>
                </div>
              </div>
              <div className="p-3 space-y-1">
                <div className="text-xs text-blue-300/90">{hook}</div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted">
                  {preset.distanceKm >= 30
                    ? `${Math.round(preset.distanceKm * 0.6213712)} mi`
                    : `${(preset.distanceKm * 0.6213712).toFixed(1)} mi`}{" "}
                  · +{preset.elevationGainFt.toLocaleString()} ft · ~
                  {preset.typicalHours}h
                </div>
              </div>
            </Link>
          ))}
        </section>

        <section className="pt-2 border-t border-panel-border/40">
          <p className="text-xs text-muted">
            Something else in mind?{" "}
            <Link
              href="/login"
              className="text-blue-300 hover:text-blue-200 underline underline-offset-4"
            >
              Sign in
            </Link>{" "}
            to search the full library of ~90 curated trails.
          </p>
        </section>
      </main>
    </div>
  );
}
