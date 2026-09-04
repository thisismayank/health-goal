import Link from "next/link";
import { notFound } from "next/navigation";
import {
  findTrailBySlug,
  formatTrailDuration,
} from "@/lib/basecamp/trail-library";
import { getFullTrailLibrary } from "@/lib/basecamp/trail-coords";
import { ColdStartFlow } from "@/components/start/cold-start-flow";
import { track } from "@/lib/analytics/track";

// Public — no auth. The stranger's 3-question form + verdict card
// both live on this page; the form's server action recomputes the
// synthetic snapshot + assessment each submit, so there's no auth
// state to persist between form and verdict.
export const dynamic = "force-dynamic";

export default async function ColdStartTrailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const preset =
    findTrailBySlug(slug) ??
    getFullTrailLibrary().find((p) => p.slug === slug);
  if (!preset) notFound();

  await track("start_trail_view", { properties: { slug } });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-5 py-4 flex items-baseline justify-between gap-3 border-b border-panel-border/60">
        <Link
          href="/start"
          className="text-xs text-muted hover:text-foreground"
        >
          ← All hikes
        </Link>
        <div className="text-lg font-mono font-semibold text-blue-300">
          Basecamp
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-5 py-6 space-y-6">
        <section>
          <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
            Trail
          </div>
          <h1 className="text-2xl font-semibold leading-tight mt-1">
            {preset.name}
          </h1>
          <div className="text-sm text-muted mt-0.5">{preset.region}</div>
          <div className="text-xs text-muted mt-1">
            {(preset.distanceKm * 0.6213712).toFixed(1)} mi · +
            {preset.elevationGainFt.toLocaleString()} ft · max{" "}
            {preset.maxAltitudeFt.toLocaleString()} ft ·{" "}
            {formatTrailDuration(preset)} · {preset.terrainGrade}
          </div>
        </section>

        <ColdStartFlow slug={slug} presetName={preset.name} />
      </main>
    </div>
  );
}
