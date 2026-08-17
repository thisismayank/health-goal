import Link from "next/link";
import { getFullTrailLibrary } from "@/lib/basecamp/trail-coords";
import { presetToVirtualTrail } from "@/lib/basecamp/preset-trail";
import {
  assessTrail,
  VERDICT_COLOR,
  VERDICT_LABEL,
  type Verdict,
} from "@/lib/basecamp/trail-assessment";
import { todayInTimeZone } from "@/lib/date";
import type { UserProfile } from "@/db/schema";
import { formatFt, formatKm, pickUnits } from "@/lib/units";

const RADIUS_MI = 200;
const RADIUS_KM = RADIUS_MI * 1.60934;
const MAX_RESULTS = 12;

// Verdicts we consider "worth surfacing" in the near-me feed. If the
// engine says "do_not_attempt" we don't want to tease the trail —
// the user isn't ready.
const SHOW_VERDICTS: Verdict[] = ["comfortable", "achievable"];

/**
 * "Ready near me this weekend" — the location engine v1.
 *
 * Given the user's saved home coords (set in Settings), assess every
 * preset within RADIUS_MI, keep the ones whose readiness verdict is
 * comfortable/achievable, and group them by verdict for the user to
 * pick from.
 *
 * Silent when the user hasn't set a home base yet — the Settings CTA
 * elsewhere handles that.
 */
export async function NearMeSection({ user }: { user: UserProfile }) {
  if (user.homeLat == null || user.homeLng == null) return null;

  const units = pickUnits(user);
  const today = todayInTimeZone(user.timezone);
  const homeLat = user.homeLat;
  const homeLng = user.homeLng;

  // Filter presets by proximity FIRST so we only assess a small
  // number. assessTrail is a few DB reads per call; we don't want
  // to do it against the whole 200+ preset library. Use the
  // coord-augmented library — many trails only get their trailhead
  // via the TRAIL_COORDS overlay in lib/basecamp/trail-coords.ts.
  const nearby = getFullTrailLibrary()
    .filter(
      (p) =>
        p.startLat != null &&
        p.startLng != null &&
        haversineKm(homeLat, homeLng, p.startLat, p.startLng) <= RADIUS_KM,
    )
    .map((p) => ({
      preset: p,
      km: haversineKm(homeLat, homeLng, p.startLat!, p.startLng!),
    }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 30); // asses a bit more than we'll display, in case some fail the verdict cut

  if (nearby.length === 0) {
    return (
      <section className="rounded-md border border-panel-border bg-panel/60 p-4">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted">
          Near you
        </div>
        <p className="text-sm text-muted mt-1">
          No presets within {RADIUS_MI} mi of {user.homeLocation}. Try
          Discover for a specific region, or add a custom trail.
        </p>
      </section>
    );
  }

  const assessed = await Promise.all(
    nearby.map(async ({ preset, km }) => ({
      preset,
      km,
      assessment: await assessTrail(
        user.id,
        presetToVirtualTrail(preset, user.id),
        today,
      ),
    })),
  );

  const shown = assessed
    .filter((a) => SHOW_VERDICTS.includes(a.assessment.verdict))
    .slice(0, MAX_RESULTS);

  if (shown.length === 0) {
    return (
      <section className="rounded-md border border-warn/30 bg-warn/5 p-4">
        <div className="text-[10px] font-mono uppercase tracking-widest text-warn">
          Near you
        </div>
        <p className="text-sm text-muted mt-1">
          Nothing within {RADIUS_MI} mi is ready for you yet based on
          the last 60 days of training. Build up first, or search for a
          longer-drive destination.
        </p>
      </section>
    );
  }

  // Group by verdict for a scannable layout.
  const byVerdict = new Map<Verdict, typeof shown>();
  for (const item of shown) {
    const bucket = byVerdict.get(item.assessment.verdict) ?? [];
    bucket.push(item);
    byVerdict.set(item.assessment.verdict, bucket);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
          Ready near {shortLabel(user.homeLocation ?? "")}
        </div>
        <div className="text-[10px] text-muted">
          within {RADIUS_MI} mi · your current fitness
        </div>
      </div>
      {SHOW_VERDICTS.filter((v) => byVerdict.has(v)).map((verdict) => (
        <div key={verdict} className="space-y-1.5">
          <div
            className={`text-[10px] font-mono uppercase tracking-widest ${VERDICT_COLOR[verdict]}`}
          >
            {VERDICT_LABEL[verdict]}
          </div>
          <div className="space-y-1">
            {byVerdict.get(verdict)!.map(({ preset, km }) => (
              <Link
                key={preset.slug}
                href={`/trails/preset/${preset.slug}`}
                className="block rounded-md border border-panel-border bg-panel px-3 py-2 hover:border-blue-500/40 transition"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-medium text-sm truncate">{preset.name}</div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted whitespace-nowrap">
                    {units === "metric"
                      ? `${Math.round(km)} km`
                      : `${Math.round(km * 0.6213712)} mi`}
                  </div>
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {preset.region} · {formatKm(preset.distanceKm, units)} · +
                  {formatFt(preset.elevationGainFt, units)} · ~
                  {preset.typicalHours}h
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

// -------- helpers --------

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Trim OSM's chatty "Manhattan, New York County, City of New York,
// New York, United States" down to something short for the header.
function shortLabel(full: string): string {
  const parts = full.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 2) return full;
  return `${parts[0]}, ${parts[parts.length - 2] ?? parts[1]}`;
}
