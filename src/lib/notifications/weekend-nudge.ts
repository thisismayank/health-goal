/**
 * Weekend Nudge — Thursday email suggesting trails ready for the user's
 * fitness. Recurring hook independent of scheduled trips: for casual
 * users who haven't planned anything, this gives them a reason to open
 * the app on a Friday/Saturday.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { trail, type UserProfile } from "@/db/schema";
import { TRAIL_LIBRARY, type TrailPreset } from "@/lib/basecamp/trail-library";
import { presetToVirtualTrail } from "@/lib/basecamp/preset-trail";
import {
  assessTrail,
  loadFitnessSnapshot,
  type Verdict,
} from "@/lib/basecamp/trail-assessment";
import { computeCharacterSheet } from "@/lib/basecamp/stats";
import { computeRank } from "@/lib/basecamp/rank";
import { todayInTimeZone } from "@/lib/date";

type NudgeTrail = {
  preset: TrailPreset;
  verdict: Verdict;
  saved: boolean;
};

export type WeekendNudgePayload = {
  user: UserProfile;
  hikerClass: string;
  hikerClassLabel: string;
  ready: NudgeTrail[];
  achievable: NudgeTrail[];
};

/**
 * Pick 2 READY + 1 ACHIEVABLE trails for the weekend nudge. Excludes
 * trails the user has already saved (they know about those). Prefers
 * region variety when possible.
 */
export async function buildWeekendNudge(
  user: UserProfile,
): Promise<WeekendNudgePayload | null> {
  const today = todayInTimeZone(user.timezone);

  // Load user's saved slugs so we don't recommend what they already have.
  const savedRows = await db
    .select({ presetSlug: trail.presetSlug })
    .from(trail)
    .where(eq(trail.userId, user.id));
  const savedSlugs = new Set(
    savedRows
      .map((r) => r.presetSlug)
      .filter((s): s is string => s !== null),
  );

  const [sheet, snap] = await Promise.all([
    computeCharacterSheet(user.id),
    loadFitnessSnapshot(user.id),
  ]);
  const rank = computeRank(sheet);

  // Assess all library trails against the user's fitness. Same
  // per-snapshot batch pattern as /trails/discover.
  const scored: NudgeTrail[] = await Promise.all(
    TRAIL_LIBRARY.filter((p) => !savedSlugs.has(p.slug)).map(async (preset) => {
      const virtual = presetToVirtualTrail(preset, user.id);
      const assessment = await assessTrail(user.id, virtual, today, {
        snapshot: snap,
      });
      return { preset, verdict: assessment.verdict, saved: false };
    }),
  );

  const ready = scored
    .filter((s) => s.verdict === "comfortable")
    .sort((a, b) => a.preset.typicalHours - b.preset.typicalHours);
  const achievable = scored
    .filter((s) => s.verdict === "achievable")
    .sort((a, b) => a.preset.typicalHours - b.preset.typicalHours);

  const picks = pickWithVariety(ready, 2);
  const usedRegions = new Set(picks.map((p) => p.preset.region));
  const oneAchievable = pickWithVariety(
    achievable.filter((a) => !usedRegions.has(a.preset.region)),
    1,
  );
  const stretchPicks =
    oneAchievable.length > 0 ? oneAchievable : achievable.slice(0, 1);

  if (picks.length === 0 && stretchPicks.length === 0) return null;

  return {
    user,
    hikerClass: rank.current,
    hikerClassLabel: rank.currentLabel,
    ready: picks,
    achievable: stretchPicks,
  };
}

// Pick up to `n` trails, preferring different regions to avoid recommending
// three variations of the same peak.
function pickWithVariety(
  candidates: NudgeTrail[],
  n: number,
): NudgeTrail[] {
  const picks: NudgeTrail[] = [];
  const regionsSeen = new Set<string>();
  for (const c of candidates) {
    if (picks.length >= n) break;
    if (regionsSeen.has(c.preset.region)) continue;
    picks.push(c);
    regionsSeen.add(c.preset.region);
  }
  // Backfill from any remaining if we didn't hit n via variety.
  for (const c of candidates) {
    if (picks.length >= n) break;
    if (picks.some((p) => p.preset.slug === c.preset.slug)) continue;
    picks.push(c);
  }
  return picks;
}

export type WeekendNudgeEmail = {
  subject: string;
  text: string;
  html: string;
};

export function renderWeekendNudgeEmail({
  payload,
  appUrl,
}: {
  payload: WeekendNudgePayload;
  appUrl: string;
}): WeekendNudgeEmail {
  const { user, hikerClass, hikerClassLabel, ready, achievable } = payload;
  const first = user.name.split(" ")[0];
  const total = ready.length + achievable.length;

  const subject =
    total === 1
      ? `1 hike ready for you this weekend`
      : `${total} hikes ready for you this weekend`;

  const textLines: string[] = [
    `Hi ${first},`,
    ``,
    `Weekend's coming. Based on your recent training (${hikerClass} ${hikerClassLabel}):`,
    ``,
  ];
  if (ready.length > 0) {
    textLines.push(`READY (do these anytime):`);
    for (const r of ready) textLines.push(`  ✓ ${trailLine(r.preset)}`);
    textLines.push(``);
  }
  if (achievable.length > 0) {
    textLines.push(`ACHIEVABLE (with focus):`);
    for (const a of achievable) textLines.push(`  ~ ${trailLine(a.preset)}`);
    textLines.push(``);
  }
  textLines.push(
    `Open Basecamp for personalized ratings + itinerary + weather:`,
    `${appUrl}/trails/discover`,
    ``,
    `Not planning anything this weekend? Turn these off in Settings.`,
  );

  const html = `<!doctype html>
<html>
<body style="font-family:-apple-system,system-ui,sans-serif;background:#0a0b0d;color:#e8eaed;padding:32px 16px;margin:0">
  <div style="max-width:520px;margin:0 auto;padding:24px;background:#14161a;border:1px solid #23262c;border-radius:8px">
    <div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:0.15em;color:#7dd3fc;text-transform:uppercase">
      [WEEKEND NUDGE]
    </div>
    <h1 style="font-size:20px;margin:8px 0 4px 0;line-height:1.3;color:#e8eaed">
      ${total === 1 ? "1 hike" : `${total} hikes`} ready for you this weekend
    </h1>
    <p style="color:#9aa0a6;font-size:13px;margin:0 0 16px 0">
      For ${escape(first)} · ${escape(hikerClass)} ${escape(hikerClassLabel)}
    </p>
    ${ready.length > 0 ? renderSection(ready, "READY", "#78c47a", appUrl) : ""}
    ${achievable.length > 0 ? renderSection(achievable, "ACHIEVABLE", "#7dd3fc", appUrl) : ""}
    <div style="margin-top:24px">
      <a href="${appUrl}/trails/discover" style="display:inline-block;background:#4fa552;color:#0a0b0d;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:500">
        Plan a trip in Basecamp →
      </a>
    </div>
    <p style="color:#9aa0a6;font-size:11px;margin-top:24px;border-top:1px solid #23262c;padding-top:16px">
      Not planning anything this weekend? Turn off Weekend Nudge in Settings.
    </p>
  </div>
</body>
</html>`;

  return { subject, text: textLines.join("\n") + "\n\nBasecamp\n", html };
}

function trailLine(p: TrailPreset): string {
  return `${p.name} · ${p.typicalHours}h · +${p.elevationGainFt.toLocaleString()} ft · ${p.region}`;
}

function renderSection(
  trails: NudgeTrail[],
  label: string,
  color: string,
  appUrl: string,
): string {
  const rows = trails
    .map((t) => {
      const p = t.preset;
      const href = `${appUrl}/trails/preset/${p.slug}`;
      return `<a href="${href}" style="display:block;text-decoration:none;color:inherit;margin-bottom:8px;padding:12px;background:#0a0b0d;border:1px solid #23262c;border-radius:6px">
        <div style="font-size:14px;font-weight:500;color:#e8eaed">${escape(p.name)}</div>
        <div style="font-size:12px;color:#9aa0a6;margin-top:2px">${p.typicalHours}h · +${p.elevationGainFt.toLocaleString()} ft · ${escape(p.region)}</div>
      </a>`;
    })
    .join("");
  return `<p style="margin:16px 0 8px 0;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:0.15em;color:${color};text-transform:uppercase">[${label}]</p>${rows}`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
