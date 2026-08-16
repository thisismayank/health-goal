/**
 * Notification sender + delivery-log helpers. Mirrors the magic-link
 * email sender: uses Resend when RESEND_API_KEY is set, falls back to
 * console.log otherwise so local + missing-key setups still work.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notificationDelivery, notificationPreference } from "@/db/schema";

const FROM_ADDRESS =
  process.env.NOTIFICATION_FROM ??
  process.env.MAGIC_LINK_FROM ??
  "Basecamp <onboarding@resend.dev>";

export type SendEmailInput = {
  userId: number;
  to: string;
  subject: string;
  text: string;
  html: string;
  kind: string; // e.g. 'trip_week'
  dedupeKey: string; // e.g. 'trip_45_final_prep_2026-08-16'
};

export type SendResult =
  | { ok: true; skipped: "deduped" }
  | { ok: true; skipped: false; via: "resend" | "console"; providerId?: string }
  | { ok: false; via: "resend"; error: string };

/**
 * Best-effort email send with dedupe. Idempotent via the
 * notification_delivery unique(userId, dedupeKey) constraint.
 */
export async function sendNotificationEmail(
  input: SendEmailInput,
): Promise<SendResult> {
  // Fast-path dedupe check (avoids the API call when we know we've sent).
  const existing = await db
    .select({ id: notificationDelivery.id })
    .from(notificationDelivery)
    .where(
      and(
        eq(notificationDelivery.userId, input.userId),
        eq(notificationDelivery.dedupeKey, input.dedupeKey),
      ),
    )
    .limit(1);
  if (existing[0]) return { ok: true, skipped: "deduped" };

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(
      `\n[notification] Resend not configured. Would send to ${input.to}:\n  subject: ${input.subject}\n  dedupeKey: ${input.dedupeKey}\n`,
    );
    await logDelivery({
      userId: input.userId,
      kind: input.kind,
      dedupeKey: input.dedupeKey,
      channel: "email",
      ok: true,
      providerMessageId: null,
      errorMessage: null,
    });
    return { ok: true, skipped: false, via: "console" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };
    if (!res.ok) {
      const errText = body.message || `${res.status}`;
      await logDelivery({
        userId: input.userId,
        kind: input.kind,
        dedupeKey: input.dedupeKey,
        channel: "email",
        ok: false,
        providerMessageId: null,
        errorMessage: errText,
      });
      return { ok: false, via: "resend", error: errText };
    }
    await logDelivery({
      userId: input.userId,
      kind: input.kind,
      dedupeKey: input.dedupeKey,
      channel: "email",
      ok: true,
      providerMessageId: body.id ?? null,
      errorMessage: null,
    });
    return {
      ok: true,
      skipped: false,
      via: "resend",
      providerId: body.id,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    await logDelivery({
      userId: input.userId,
      kind: input.kind,
      dedupeKey: input.dedupeKey,
      channel: "email",
      ok: false,
      providerMessageId: null,
      errorMessage: msg,
    });
    return { ok: false, via: "resend", error: msg };
  }
}

async function logDelivery(v: {
  userId: number;
  kind: string;
  dedupeKey: string;
  channel: string;
  ok: boolean;
  providerMessageId: string | null;
  errorMessage: string | null;
}) {
  await db
    .insert(notificationDelivery)
    .values(v)
    .onConflictDoNothing({
      target: [notificationDelivery.userId, notificationDelivery.dedupeKey],
    });
}

// Opt-out design: absent row = enabled.
export async function isEmailEnabled(
  userId: number,
  kind: string,
): Promise<boolean> {
  const [row] = await db
    .select({ emailEnabled: notificationPreference.emailEnabled })
    .from(notificationPreference)
    .where(
      and(
        eq(notificationPreference.userId, userId),
        eq(notificationPreference.kind, kind),
      ),
    )
    .limit(1);
  if (!row) return true;
  return row.emailEnabled;
}
