import Link from "next/link";
import { requireOnboardedUser } from "@/lib/data";
import { todayInTimeZone } from "@/lib/date";
import { allTrails, type TrailPreset } from "@/lib/basecamp/trail-library";
import { POPULAR_DESTINATIONS, coordsForQuery } from "@/lib/basecamp/destinations";
import { computeCharacterSheet } from "@/lib/basecamp/stats";
import { computeRank } from "@/lib/basecamp/rank";
import { isLocked, minClassForPreset } from "@/lib/basecamp/class-fit";
import { presetToVirtualTrail } from "@/lib/basecamp/preset-trail";
import {
  assessTrail,
  loadFitnessSnapshot,
  VERDICT_COLOR,
  VERDICT_LABEL,
  type Verdict,
} from "@/lib/basecamp/trail-assessment";
import { DiscoverSearch } from "@/components/trails/discover-search";
import { TrailsSubNav } from "@/components/shell/trails-sub-nav";
import {
  ItineraryPlanner,
  type ItineraryPresetInput,
} from "@/components/trails/itinerary-planner";

export const dynamic = "force-dynamic";

const VERDICT_ORDER: Verdict[] = [
  "comfortable",
  "achievable",
  "hard",
  "do_not_attempt",
];

const VERDICT_HEADLINE: Record<Verdict, string> = {
  comfortable: "Ready — pick one and go",
  achievable: "Reachable — some prep helps",
  hard: "Doable if you pace it",
  do_not_attempt: "Not ready — technical/long alpine objectives",
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesQuery(preset: TrailPreset, q: string): boolean {
  const nq = normalize(q);
  if (!nq) return false;
  const hay = normalize(
    `${preset.name} ${preset.region} ${preset.country}`,
  );
  return nq.split(/\s+/).every((token) => hay.includes(token));
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireOnboardedUser();
  const params = await searchParams;
  const rawQuery = typeof params.q === "string" ? params.q : "";
  const query = rawQuery.trim();

  const today = todayInTimeZone(user.timezone);

  const matches = query
    ? allTrails().filter((t) => matchesQuery(t, query))
    : [];

  // One fitness snapshot for all matches. assessTrail's optional
  // `snapshot` opt lets us skip N-1 duplicate queries.
  const snapshot = matches.length > 0 ? await loadFitnessSnapshot(user.id) : null;

  // User's current Hiker Class — used for LOCKED chips on results.
  const sheet = await computeCharacterSheet(user.id);
  const userClass = computeRank(sheet).current;

  const assessed = snapshot
    ? await Promise.all(
        matches.map(async (preset) => {
          const virtual = presetToVirtualTrail(preset, user.id);
          const assessment = await assessTrail(user.id, virtual, today, {
            snapshot,
          });
          return { preset, assessment };
        }),
      )
    : [];

  // Group by verdict, sort within each by "how easy" (shorter first).
  const byVerdict = new Map<Verdict, typeof assessed>();
  for (const item of assessed) {
    const bucket = byVerdict.get(item.assessment.verdict) ?? [];
    bucket.push(item);
    byVerdict.set(item.assessment.verdict, bucket);
  }
  for (const bucket of byVerdict.values()) {
    bucket.sort((a, b) => a.preset.typicalHours - b.preset.typicalHours);
  }

  return (
    <div className="space-y-5">
      <TrailsSubNav />
      <div>
        <h1 className="text-2xl font-semibold leading-tight">
          Where are you going?
        </h1>
        <p className="text-sm text-muted mt-1 leading-relaxed">
          Type a destination and see which hikes there are actually right for
          you — based on your recent training.
        </p>
      </div>

      <DiscoverSearch initialQuery={query} />

      {!query && (
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-widest text-muted">
            Popular destinations
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {POPULAR_DESTINATIONS.map((d) => (
              <Link
                key={d.query}
                href={`/trails/discover?q=${encodeURIComponent(d.query)}`}
                className="rounded-md border border-panel-border bg-panel px-3 py-2 hover:border-blue-500/40 transition"
              >
                <div className="text-sm font-medium truncate">{d.label}</div>
                {d.hint && (
                  <div className="text-[10px] text-muted mt-0.5 truncate">
                    {d.hint}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {query && matches.length === 0 && (
        <section className="rounded-lg border border-panel-border bg-panel p-5 text-sm text-muted leading-relaxed">
          <p>
            No trails in our library match{" "}
            <span className="text-foreground">"{query}"</span>. We've curated
            ~90 famous trails; less-common ones may be missing.
          </p>
          <p className="mt-2 text-xs">
            Try a broader term (e.g. "Cascades" instead of a specific peak) or{" "}
            <Link
              href="/trails"
              className="text-blue-300 hover:underline"
            >
              add a custom trail
            </Link>
            .
          </p>
        </section>
      )}

      {query && matches.length > 0 && (
        <>
          <ItineraryPlanner
            destinationLabel={query}
            coords={coordsForQuery(query)}
            presets={assessed.map<ItineraryPresetInput>(({ preset, assessment }) => ({
              slug: preset.slug,
              name: preset.name,
              region: preset.region,
              distanceKm: preset.distanceKm,
              elevationGainFt: preset.elevationGainFt,
              maxAltitudeFt: preset.maxAltitudeFt,
              typicalHours: preset.typicalHours,
              packWeightLb: preset.packWeightLb,
              terrainGrade: preset.terrainGrade,
              verdict: assessment.verdict,
            }))}
          />

          <div className="text-xs text-muted">
            <span className="text-foreground">{matches.length}</span> trail
            {matches.length === 1 ? "" : "s"} match "{query}" — ranked by fit
            for your current fitness.
          </div>
          {VERDICT_ORDER.map((verdict) => {
            const bucket = byVerdict.get(verdict);
            if (!bucket || bucket.length === 0) return null;
            return (
              <section key={verdict} className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <h2
                    className={`text-xs font-mono uppercase tracking-widest ${VERDICT_COLOR[verdict]}`}
                  >
                    [{VERDICT_LABEL[verdict]}] · {bucket.length}
                  </h2>
                  <div className="text-[10px] text-muted italic">
                    {VERDICT_HEADLINE[verdict]}
                  </div>
                </div>
                <div className="space-y-2">
                  {bucket.map(({ preset, assessment }) => {
                    const requiredClass = minClassForPreset(preset);
                    const locked = isLocked(userClass, requiredClass);
                    return (
                      <Link
                        key={preset.slug}
                        href={`/trails/preset/${preset.slug}`}
                        className={`block rounded-md border px-4 py-3 transition ${
                          verdict === "comfortable"
                            ? "border-accent/40 bg-accent-strong/5 hover:border-accent/60"
                            : verdict === "achievable"
                              ? "border-blue-500/30 bg-blue-950/10 hover:border-blue-500/60"
                              : verdict === "hard"
                                ? "border-warn/30 bg-warn/5 hover:border-warn/60"
                                : "border-danger/30 bg-danger/5 hover:border-danger/60"
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="font-medium truncate">
                            {preset.name}
                          </div>
                          <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                            {locked ? (
                              <span className="text-[10px] font-mono uppercase tracking-wider text-warn">
                                🔒 Class {requiredClass}
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono uppercase tracking-wider text-muted">
                                Class {requiredClass}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted mt-1">
                          {preset.region}
                          {" · "}
                          {preset.distanceKm} km · +
                          {preset.elevationGainFt.toLocaleString()} ft · ~
                          {preset.typicalHours}h · {preset.terrainGrade}
                        </div>
                        {assessment.suggestedAdjustments.length > 0 &&
                          verdict !== "comfortable" && (
                            <div className="text-[11px] text-muted mt-1.5 italic line-clamp-2">
                              {assessment.suggestedAdjustments[0]}
                            </div>
                          )}
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
