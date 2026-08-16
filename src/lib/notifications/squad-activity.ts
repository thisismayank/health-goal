/**
 * Squad activity notifications — fires when a member logs a trail
 * completion. Notifies every OTHER member of every squad the actor
 * belongs to, subject to per-recipient opt-out.
 *
 * Dedupe key: squad_activity_{completionId}_{recipientId} — one email
 * per recipient per completion. If the completion is deleted + re-added
 * the new row has a fresh id and can send again (rare, acceptable).
 */

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  squadMember,
  trail,
  trailCompletion,
  userProfile,
} from "@/db/schema";
import { isEmailEnabled, sendNotificationEmail } from "./send";

const KIND = "squad_activity";

export async function notifySquadOfCompletion({
  actorUserId,
  completionId,
  appUrl,
}: {
  actorUserId: number;
  completionId: number;
  appUrl: string;
}): Promise<void> {
  // Look up the completion + actor + trail in one round trip.
  const [row] = await db
    .select({
      completionId: trailCompletion.id,
      completedAt: trailCompletion.completedAt,
      timeMinutes: trailCompletion.timeMinutes,
      notes: trailCompletion.notes,
      actorName: userProfile.name,
      trailName: trail.name,
      trailId: trail.id,
      distanceKm: trail.distanceKm,
      elevationGainFt: trail.elevationGainFt,
      typicalHours: trail.typicalHours,
      region: trail.notes, // proxy — trail table has no region column
    })
    .from(trailCompletion)
    .innerJoin(userProfile, eq(userProfile.id, trailCompletion.userId))
    .innerJoin(trail, eq(trail.id, trailCompletion.trailId))
    .where(eq(trailCompletion.id, completionId))
    .limit(1);
  if (!row) return;

  // All squads the actor belongs to.
  const actorSquads = await db
    .select({ squadId: squadMember.squadId })
    .from(squadMember)
    .where(eq(squadMember.userId, actorUserId));
  if (actorSquads.length === 0) return;
  const squadIds = actorSquads.map((s) => s.squadId);

  // All OTHER members of those squads, with their email.
  const recipients = await db
    .select({
      userId: squadMember.userId,
      email: userProfile.email,
      name: userProfile.name,
    })
    .from(squadMember)
    .innerJoin(userProfile, eq(userProfile.id, squadMember.userId))
    .where(inArray(squadMember.squadId, squadIds));
  const seen = new Set<number>();
  const others = recipients.filter((r) => {
    if (r.userId === actorUserId) return false;
    if (!r.email) return false;
    if (seen.has(r.userId)) return false;
    seen.add(r.userId);
    return true;
  });
  if (others.length === 0) return;

  const email = renderSquadActivityEmail({
    actorName: row.actorName,
    trailName: row.trailName,
    trailId: row.trailId,
    distanceKm: row.distanceKm,
    elevationGainFt: row.elevationGainFt,
    typicalHours: row.typicalHours,
    completedAt: row.completedAt,
    timeMinutes: row.timeMinutes,
    notes: row.notes,
    appUrl,
  });

  // Fire per-recipient. Sequential — small squads (≤8) mean at most 7
  // per completion. If squads ever get bigger, switch to Promise.all.
  for (const r of others) {
    if (!r.email) continue;
    const enabled = await isEmailEnabled(r.userId, KIND);
    if (!enabled) continue;
    await sendNotificationEmail({
      userId: r.userId,
      to: r.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
      kind: KIND,
      dedupeKey: `squad_activity_${completionId}_${r.userId}`,
    });
  }
}

type EmailArgs = {
  actorName: string;
  trailName: string;
  trailId: number;
  distanceKm: number;
  elevationGainFt: number;
  typicalHours: number;
  completedAt: string;
  timeMinutes: number | null;
  notes: string | null;
  appUrl: string;
};

function renderSquadActivityEmail(a: EmailArgs) {
  const firstName = a.actorName.split(" ")[0];
  const trailUrl = `${a.appUrl}/trails/${a.trailId}`;
  const timeStr =
    a.timeMinutes != null ? ` in ${formatMinutes(a.timeMinutes)}` : "";
  const metricLine = `${a.distanceKm} km · +${a.elevationGainFt.toLocaleString()} ft · typical ${a.typicalHours}h`;

  const subject = `${firstName} just did ${a.trailName}`;

  const textLines: string[] = [
    `${firstName} just completed ${a.trailName}${timeStr}.`,
    ``,
    metricLine,
    `on ${a.completedAt}`,
  ];
  if (a.notes) textLines.push(``, `"${a.notes}"`);
  textLines.push(
    ``,
    `See in your squad: ${trailUrl}`,
    ``,
    `Turn off squad activity emails in Basecamp Settings.`,
  );

  const html = `<!doctype html>
<html>
<body style="font-family:-apple-system,system-ui,sans-serif;background:#0a0b0d;color:#e8eaed;padding:32px 16px;margin:0">
  <div style="max-width:520px;margin:0 auto;padding:24px;background:#14161a;border:1px solid #23262c;border-radius:8px">
    <div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:0.15em;color:#7dd3fc;text-transform:uppercase">
      [SQUAD]
    </div>
    <h1 style="font-size:20px;margin:8px 0 8px 0;line-height:1.3;color:#e8eaed">
      ${escape(firstName)} just did <b>${escape(a.trailName)}</b>
      ${a.timeMinutes != null ? `<span style="color:#7dd3fc"> in ${formatMinutes(a.timeMinutes)}</span>` : ""}
    </h1>
    <p style="color:#9aa0a6;font-size:13px;margin:0 0 4px 0">${escape(metricLine)}</p>
    <p style="color:#9aa0a6;font-size:13px;margin:0">on ${escape(a.completedAt)}</p>
    ${a.notes ? `<p style="color:#e8eaed;font-size:14px;font-style:italic;margin:16px 0 0 0;padding:12px;background:#0a0b0d;border-left:2px solid #7dd3fc;border-radius:0 4px 4px 0">"${escape(a.notes)}"</p>` : ""}
    <div style="margin-top:24px">
      <a href="${trailUrl}" style="display:inline-block;background:#4fa552;color:#0a0b0d;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:500">
        See it in Basecamp →
      </a>
    </div>
    <p style="color:#9aa0a6;font-size:11px;margin-top:24px;border-top:1px solid #23262c;padding-top:16px">
      You're getting this because ${escape(firstName)} is in one of your squads. Turn off squad activity emails in Settings.
    </p>
  </div>
</body>
</html>`;

  return {
    subject,
    text: textLines.join("\n") + "\n\nBasecamp\n",
    html,
  };
}

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}m`;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
