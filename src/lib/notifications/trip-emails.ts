/**
 * Trip-week email content per phase. Rendered to plain-text + HTML for
 * Resend. Kept simple + inline-styled — no template engine, no external
 * assets, so the email works everywhere.
 */

import type { Trail, UserProfile } from "@/db/schema";
import type { TripPhase } from "@/lib/home/state";

export type TripEmail = {
  subject: string;
  text: string;
  html: string;
};

export function buildTripEmail({
  user,
  trail,
  phase,
  daysUntil,
  appUrl,
}: {
  user: UserProfile;
  trail: Trail;
  phase: TripPhase;
  daysUntil: number;
  appUrl: string;
}): TripEmail {
  const firstName = user.name.split(" ")[0];
  const trailUrl = `${appUrl}/trails/${trail.id}`;
  const homeUrl = appUrl;

  if (phase === "final_prep") {
    return {
      subject: `${daysUntil} days to ${trail.name} — final prep week`,
      text: plainText(
        `Hi ${firstName},`,
        ``,
        `Your ${trail.name} trip is ${daysUntil} days away.`,
        ``,
        `This is your last real training window. What to focus on:`,
        `  - One long session mid-week (approximate the trail's demands).`,
        `  - Break in any new boots or gear.`,
        `  - Check the extended forecast for the trip window.`,
        trail.packWeightLb > 0
          ? `  - Test your pack at ${trail.packWeightLb} lb on one session.`
          : null,
        ``,
        `Open Basecamp: ${homeUrl}`,
        `Trail details: ${trailUrl}`,
      ),
      html: shell(
        `${daysUntil} days to <b>${escape(trail.name)}</b>`,
        `[FINAL PREP]`,
        `<p>Hi ${escape(firstName)},</p>` +
          `<p>Your ${escape(trail.name)} trip is <b>${daysUntil} days</b> away. This is your last real training window.</p>` +
          `<p style="margin:16px 0 4px 0;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:0.15em;color:#7dd3fc;text-transform:uppercase">Focus this week</p>` +
          list([
            "One long session mid-week (approximate the trail's demands).",
            "Break in any new boots or gear.",
            "Check the extended forecast for the trip window.",
            trail.packWeightLb > 0
              ? `Test your pack at ${trail.packWeightLb} lb on one session.`
              : null,
          ]),
        homeUrl,
        "Open Basecamp",
      ),
    };
  }

  if (phase === "taper") {
    return {
      subject: `${daysUntil} day${daysUntil === 1 ? "" : "s"} to ${trail.name} — taper mode`,
      text: plainText(
        `Hi ${firstName},`,
        ``,
        `${daysUntil} day${daysUntil === 1 ? "" : "s"} until ${trail.name}. Rest window starts now.`,
        ``,
        `Focus:`,
        `  - No strenuous training. Walks + mobility only.`,
        `  - Hydrate consistently. Aim for 8+ hours of sleep.`,
        `  - Finalize gear, snacks, route notes.`,
        trail.maxAltitudeFt >= 10000
          ? `  - Altitude ${trail.maxAltitudeFt.toLocaleString()} ft — sleep high the night before if possible.`
          : null,
        ``,
        `Open Basecamp: ${homeUrl}`,
      ),
      html: shell(
        `${daysUntil} day${daysUntil === 1 ? "" : "s"} to <b>${escape(trail.name)}</b>`,
        `[TAPER]`,
        `<p>Hi ${escape(firstName)},</p>` +
          `<p>Rest window starts now. Fitness is already in the bank.</p>` +
          `<p style="margin:16px 0 4px 0;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:0.15em;color:#f5c26b;text-transform:uppercase">Rest window</p>` +
          list([
            "No strenuous training. Walks + mobility only.",
            "Hydrate consistently. Aim for 8+ hours of sleep.",
            "Finalize gear, snacks, route notes.",
            trail.maxAltitudeFt >= 10000
              ? `Altitude ${trail.maxAltitudeFt.toLocaleString()} ft — sleep as high as you can the night before if possible.`
              : null,
          ]),
        homeUrl,
        "Open Basecamp",
      ),
    };
  }

  if (phase === "trip_day") {
    return {
      subject: `Today's the day — ${trail.name}`,
      text: plainText(
        `${firstName},`,
        ``,
        `Today's the day. Have an amazing hike on ${trail.name}.`,
        ``,
        `Reminders:`,
        `  - Start early. Weather + light are both easier in the AM.`,
        `  - Eat + drink on schedule, not by feel. Prevent bonking.`,
        `  - Turnaround time non-negotiable. Summit is optional; going home is not.`,
        ``,
        `Log it when you're back: ${trailUrl}`,
      ),
      html: shell(
        `Today's the day — <b>${escape(trail.name)}</b>`,
        `[TRIP DAY]`,
        `<p>${escape(firstName)},</p>` +
          `<p>Have an amazing hike. Trust the training you've done.</p>` +
          `<p style="margin:16px 0 4px 0;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:0.15em;color:#78c47a;text-transform:uppercase">Reminders</p>` +
          list([
            "Start early. Weather + light are both easier in the AM.",
            "Eat + drink on schedule, not by feel. Prevent bonking.",
            "Turnaround time non-negotiable. Summit is optional; going home is not.",
          ]),
        trailUrl,
        "Log completion when back",
      ),
    };
  }

  // post_trip
  return {
    subject: `How did ${trail.name} go?`,
    text: plainText(
      `${firstName},`,
      ``,
      `Log yesterday's trip if you haven't yet — it counts toward your`,
      `Hiker Class and adds a stamp to your passport.`,
      ``,
      `${trailUrl}`,
    ),
    html: shell(
      `How did <b>${escape(trail.name)}</b> go?`,
      `[POST-TRIP]`,
      `<p>${escape(firstName)},</p>` +
        `<p>Whether you crushed it or turned back — log what happened. It counts toward your Hiker Class and adds a stamp to your passport.</p>`,
      trailUrl,
      "Log completion",
    ),
  };
}

function plainText(...lines: (string | null)[]): string {
  return lines.filter((l) => l !== null).join("\n") + "\n\nBasecamp\n";
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function list(items: (string | null)[]): string {
  const clean = items.filter((i): i is string => i !== null);
  return `<ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.6;color:#e8eaed">${clean
    .map((i) => `<li>${escape(i)}</li>`)
    .join("")}</ul>`;
}

function shell(
  title: string,
  tag: string,
  bodyHtml: string,
  ctaUrl: string,
  ctaLabel: string,
): string {
  return `<!doctype html>
<html>
<body style="font-family:-apple-system,system-ui,sans-serif;background:#0a0b0d;color:#e8eaed;padding:32px 16px;margin:0">
  <div style="max-width:520px;margin:0 auto;padding:24px;background:#14161a;border:1px solid #23262c;border-radius:8px">
    <div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:0.15em;color:#7dd3fc;text-transform:uppercase">${tag}</div>
    <h1 style="font-size:20px;margin:8px 0 16px 0;line-height:1.3;color:#e8eaed">${title}</h1>
    ${bodyHtml}
    <div style="margin-top:24px">
      <a href="${ctaUrl}" style="display:inline-block;background:#4fa552;color:#0a0b0d;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:500">${ctaLabel} →</a>
    </div>
    <p style="color:#9aa0a6;font-size:11px;margin-top:24px;border-top:1px solid #23262c;padding-top:16px">
      You're getting this because Basecamp is tracking a trip in your account. Turn off trip-week emails in Settings.
    </p>
  </div>
</body>
</html>`;
}
