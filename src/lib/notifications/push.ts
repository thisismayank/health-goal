/**
 * Server-side web push sender + delivery-log integration. Mirrors
 * sendNotificationEmail but for browser push. Silent when VAPID env vars
 * aren't set (dev mode), so nothing breaks if you haven't generated
 * keys yet.
 *
 * On 404/410 from the Push service (subscription expired / user removed
 * it) we delete the local row so we stop trying.
 */

import { and, eq } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db/client";
import { notificationDelivery, pushSubscription } from "@/db/schema";

let vapidConfigured = false;
function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:hello@example.com";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  vapidConfigured = true;
  return true;
}

export type PushAction = {
  action: string; // stable id, used as event.action in SW
  title: string; // human label on the button
  icon?: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  // Extra buttons on the notification. Chrome/Android show all;
  // desktop may collapse behind '…'. Max ~2 shown reliably.
  actions?: PushAction[];
  // Maps action.id → URL for the SW to route to on tap.
  actionUrls?: Record<string, string>;
};

export type SendPushInput = {
  userId: number;
  kind: string;
  dedupeKey: string;
  payload: PushPayload;
};

export type SendPushResult =
  | { ok: true; skipped: "deduped" | "no_vapid" | "no_subs" | "opted_out" }
  | { ok: true; skipped: false; sent: number; removed: number }
  | { ok: false; error: string };

/**
 * Fire push to all of a user's subscriptions. Idempotent via
 * (userId, dedupeKey, 'push') unique constraint on notification_delivery.
 * Also checks per-user push preference for the kind — silent no-op when
 * opted out. Safe to call from anywhere; every guard fails gracefully.
 */
export async function sendNotificationPush(
  input: SendPushInput,
): Promise<SendPushResult> {
  if (!ensureVapid()) {
    return { ok: true, skipped: "no_vapid" };
  }

  const enabled = await isPushEnabled(input.userId, input.kind);
  if (!enabled) return { ok: true, skipped: "opted_out" };

  // Dedupe: has this push been logged for this user+key already?
  const existing = await db
    .select({ id: notificationDelivery.id })
    .from(notificationDelivery)
    .where(
      and(
        eq(notificationDelivery.userId, input.userId),
        eq(notificationDelivery.dedupeKey, input.dedupeKey),
        eq(notificationDelivery.channel, "push"),
      ),
    )
    .limit(1);
  if (existing[0]) return { ok: true, skipped: "deduped" };

  const subs = await db
    .select()
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, input.userId));
  if (subs.length === 0) return { ok: true, skipped: "no_subs" };

  const body = JSON.stringify(input.payload);
  let sent = 0;
  let removed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body,
      );
      sent++;
      await db
        .update(pushSubscription)
        .set({ lastUsedAt: new Date() })
        .where(eq(pushSubscription.id, sub.id));
    } catch (e: unknown) {
      const status = (e as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        // Subscription is dead — clean up so we stop trying.
        await db
          .delete(pushSubscription)
          .where(eq(pushSubscription.id, sub.id));
        removed++;
      } else {
        console.warn(
          "[push] send failed",
          status,
          e instanceof Error ? e.message : e,
        );
      }
    }
  }

  await db
    .insert(notificationDelivery)
    .values({
      userId: input.userId,
      kind: input.kind,
      dedupeKey: input.dedupeKey,
      channel: "push",
      ok: sent > 0,
      providerMessageId: null,
      errorMessage: sent === 0 ? `no successful sends of ${subs.length}` : null,
    })
    .onConflictDoNothing({
      target: [
        notificationDelivery.userId,
        notificationDelivery.dedupeKey,
        notificationDelivery.channel,
      ],
    });

  return { ok: true, skipped: false, sent, removed };
}

// Opt-out check — mirrors isEmailEnabled for the push channel.
export async function isPushEnabled(
  userId: number,
  kind: string,
): Promise<boolean> {
  const { notificationPreference } = await import("@/db/schema");
  const [row] = await db
    .select({ pushEnabled: notificationPreference.pushEnabled })
    .from(notificationPreference)
    .where(
      and(
        eq(notificationPreference.userId, userId),
        eq(notificationPreference.kind, kind),
      ),
    )
    .limit(1);
  if (!row) return true; // absent = enabled
  return row.pushEnabled;
}
