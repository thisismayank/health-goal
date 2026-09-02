/**
 * Featured Trail of the Week — Monday morning email.
 *
 * Deterministic pick per (Hiker Class + ISO week): every user at the
 * same class sees the same trail that week. Creates a shared talking
 * point + gives users a NEW hike to think about that isn't buried in
 * the library. Excludes trails the user has already saved.
 */

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { trail, type UserProfile } from "@/db/schema";
import { TRAIL_LIBRARY, type TrailPreset } from "@/lib/basecamp/trail-library";
import { presetToVirtualTrail } from "@/lib/basecamp/preset-trail";
import {
  assessTrail,
  loadFitnessSnapshot,
  VERDICT_LABEL,
  type Verdict,
} from "@/lib/basecamp/trail-assessment";
import { computeCharacterSheet } from "@/lib/basecamp/stats";
import { computeRank, type Rank } from "@/lib/basecamp/rank";
import { minClassForPreset } from "@/lib/basecamp/class-fit";
import { todayInTimeZone } from "@/lib/date";

export type FeaturedTrailPayload = {
  user: UserProfile;
  preset: TrailPreset;
  verdict: Verdict;
  hikerClass: Rank;
  hikerClassLabel: string;
  weekTag: string; // yyyy-Www
};

/**
 * Pick this week's featured trail for a user's Hiker Class. Deterministic
 * on (class + weekTag) so identical for all users in the same class.
 * Excludes trails already saved by the user.
 */
export async function pickFeaturedTrail(
  user: UserProfile,
  weekTag: string,
): Promise<FeaturedTrailPayload | null> {
  const savedRows = await db
    .select({ presetSlug: trail.presetSlug })
    .from(trail)
    .where(eq(trail.userId, user.id));
  const savedSlugs = new Set(
    savedRows.map((r) => r.presetSlug).filter((s): s is string => s !== null),
  );

  const sheet = await computeCharacterSheet(user.id);
  const rank = computeRank(sheet);

  // Pool: trails whose OBJECTIVE class matches the user's, excluding what
  // they've already saved. If pool is tiny (< 4), widen to include
  // one-class-below for variety.
  const primary = TRAIL_LIBRARY.filter(
    (p) => minClassForPreset(p) === rank.current && !savedSlugs.has(p.slug),
  );
  const secondary = TRAIL_LIBRARY.filter(
    (p) => !savedSlugs.has(p.slug) && isAdjacentClass(minClassForPreset(p), rank.current),
  );
  const pool = primary.length >= 4 ? primary : [...primary, ...secondary];
  if (pool.length === 0) return null;

  // Deterministic pick with defensive verdict gate: walk the pool
  // starting from the hash-selected index; skip any trail whose
  // assessment returns do_not_attempt for THIS user. Devin's r2
  // caught the failure mode: Cathedral Lakes (easy, 9.5 mi) was
  // featured "for Class E" but assessed as do_not_attempt because
  // the fitness snapshot was empty for a fresh signup. The verdict
  // engine and the picker were disagreeing on the same trail.
  //
  // With the baseline floor in loadFitnessSnapshot this rarely
  // fires, but a fresh user with no cold-start answers (someone who
  // signed up via /login directly) still has an empty snapshot and
  // an easy trail would 'do_not_attempt' at them. This walk keeps
  // Featured coherent no matter what.
  const seed = createHash("sha256")
    .update(`${rank.current}|${weekTag}`)
    .digest();
  const startIdx = seed.readUInt32BE(0) % pool.length;
  const snap = await loadFitnessSnapshot(user.id);
  const today = todayInTimeZone(user.timezone);

  let preset: TrailPreset | null = null;
  let verdict: Verdict = "do_not_attempt";
  for (let step = 0; step < pool.length; step++) {
    const candidate = pool[(startIdx + step) % pool.length];
    const virtual = presetToVirtualTrail(candidate, user.id);
    const assessment = await assessTrail(user.id, virtual, today, {
      snapshot: snap,
    });
    if (assessment.verdict !== "do_not_attempt") {
      preset = candidate;
      verdict = assessment.verdict;
      break;
    }
  }
  if (!preset) return null;

  return {
    user,
    preset,
    verdict,
    hikerClass: rank.current,
    hikerClassLabel: rank.currentLabel,
    weekTag,
  };
}

function isAdjacentClass(a: Rank, b: Rank): boolean {
  const order = ["E", "D", "C", "B", "A", "S"] as const;
  const i = order.indexOf(a);
  const j = order.indexOf(b);
  return Math.abs(i - j) === 1;
}

// Verdict → what tone the email takes for this featured trail.
function verdictCopy(v: Verdict): { headline: string; sub: string } {
  if (v === "comfortable") {
    return {
      headline: "This one's ready when you are.",
      sub: "Your recent training comfortably covers this trail's demands.",
    };
  }
  if (v === "achievable") {
    return {
      headline: "Reachable with a couple weeks of focus.",
      sub: "You've got the base — a bit of targeted training closes the gap.",
    };
  }
  if (v === "hard") {
    return {
      headline: "A real stretch — but that's the point.",
      sub: "Something to work toward. See what it'd take.",
    };
  }
  return {
    headline: "Aspirational — not yet in range.",
    sub: "One to file for later, once you've built up.",
  };
}

export type FeaturedTrailEmail = {
  subject: string;
  text: string;
  html: string;
};

export function renderFeaturedTrailEmail({
  payload,
  appUrl,
  narrative,
}: {
  payload: FeaturedTrailPayload;
  appUrl: string;
  narrative?: { hook: string; why: string } | null;
}): FeaturedTrailEmail {
  const { user, preset, verdict, hikerClass, hikerClassLabel } = payload;
  const first = user.name.split(" ")[0];
  const trailUrl = `${appUrl}/trails/preset/${preset.slug}`;
  const { headline, sub } = verdictCopy(verdict);
  const verdictLabel = VERDICT_LABEL[verdict];

  const subject = narrative?.hook
    ? `${preset.name} — ${narrative.hook}`
    : `Featured this week: ${preset.name}`;
  const metrics = `${preset.distanceKm} km · +${preset.elevationGainFt.toLocaleString()} ft · ~${preset.typicalHours}h · ${preset.terrainGrade}`;

  const text = [
    `Hi ${first},`,
    ``,
    `[FEATURED TRAIL · WEEK]`,
    ``,
    `${preset.name}`,
    `${preset.region}`,
    `${metrics}`,
    ``,
    narrative ? `Why this pick: ${narrative.hook}` : null,
    narrative ? `${narrative.why}` : null,
    narrative ? `` : null,
    `For you (${hikerClass} ${hikerClassLabel}): ${verdictLabel}`,
    `${headline}`,
    `${sub}`,
    ``,
    `About the trail:`,
    `${preset.notes}`,
    ``,
    `See the full For You card + save to plan:`,
    `${trailUrl}`,
    ``,
    `Sources: ${preset.sources.join(", ")}`,
    `Turn off Featured Trail emails in Basecamp Settings.`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n") + "\n\nBasecamp\n";

  const html = `<!doctype html>
<html>
<body style="font-family:-apple-system,system-ui,sans-serif;background:#0a0b0d;color:#e8eaed;padding:32px 16px;margin:0">
  <div style="max-width:520px;margin:0 auto;padding:24px;background:#14161a;border:1px solid #23262c;border-radius:8px">
    <div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:0.15em;color:#7dd3fc;text-transform:uppercase">
      [FEATURED TRAIL · WEEK]
    </div>
    <h1 style="font-size:22px;margin:8px 0 4px 0;line-height:1.25;color:#e8eaed">
      ${escape(preset.name)}
    </h1>
    <p style="color:#9aa0a6;font-size:13px;margin:0 0 12px 0">
      ${escape(preset.region)}
    </p>
    <p style="font-size:13px;color:#9aa0a6;margin:0 0 16px 0">${escape(metrics)}</p>

    <div style="margin:20px 0 4px 0;padding:12px 14px;background:${verdictBg(verdict)};border:1px solid ${verdictBorder(verdict)};border-radius:6px">
      <div style="font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.15em;color:${verdictText(verdict)};text-transform:uppercase">
        [FOR YOU · ${escape(hikerClass)} ${escape(hikerClassLabel)}]
      </div>
      <div style="font-size:18px;font-weight:600;color:${verdictText(verdict)};margin-top:6px">
        ${escape(verdictLabel)}
      </div>
      <p style="font-size:14px;color:#e8eaed;margin:6px 0 0 0;line-height:1.5">${escape(headline)}</p>
      <p style="font-size:13px;color:#9aa0a6;margin:4px 0 0 0;line-height:1.5">${escape(sub)}</p>
    </div>

    ${
      narrative
        ? `<p style="margin:16px 0 4px 0;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:0.15em;color:#7dd3fc;text-transform:uppercase">Why this pick</p>` +
          `<p style="font-size:15px;font-weight:500;color:#e8eaed;margin:4px 0 6px 0;line-height:1.4">${escape(narrative.hook)}</p>` +
          `<p style="font-size:14px;line-height:1.6;color:#e8eaed;margin:0">${escape(narrative.why)}</p>`
        : ""
    }

    <p style="margin:16px 0 4px 0;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:0.15em;color:#9aa0a6;text-transform:uppercase">About the trail</p>
    <p style="font-size:14px;line-height:1.6;color:#9aa0a6;margin:4px 0 0 0">${escape(preset.notes)}</p>

    <div style="margin-top:24px">
      <a href="${trailUrl}" style="display:inline-block;background:#4fa552;color:#0a0b0d;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:500">
        Open in Basecamp →
      </a>
    </div>
    <p style="color:#9aa0a6;font-size:11px;margin-top:24px;border-top:1px solid #23262c;padding-top:16px">
      Trail data: ${escape(preset.sources.join(", "))}. Featured Trail emails
      appear weekly — turn off in Settings.
    </p>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

function verdictBg(v: Verdict): string {
  return v === "comfortable"
    ? "rgba(120,196,122,0.08)"
    : v === "achievable"
      ? "rgba(59,130,246,0.08)"
      : v === "hard"
        ? "rgba(245,194,107,0.08)"
        : "rgba(224,122,95,0.08)";
}
function verdictBorder(v: Verdict): string {
  return v === "comfortable"
    ? "rgba(120,196,122,0.35)"
    : v === "achievable"
      ? "rgba(59,130,246,0.35)"
      : v === "hard"
        ? "rgba(245,194,107,0.35)"
        : "rgba(224,122,95,0.35)";
}
function verdictText(v: Verdict): string {
  return v === "comfortable"
    ? "#78c47a"
    : v === "achievable"
      ? "#7dd3fc"
      : v === "hard"
        ? "#f5c26b"
        : "#e07a5f";
}
function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
