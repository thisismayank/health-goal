/**
 * Server-side event tracker for the product analytics funnel.
 *
 * Every call appends one row to `event`. Never throws — telemetry
 * must not break the app; failures log and swallow.
 *
 * Session linkage:
 *   - Anonymous visitors: sessionId comes from the `bcv` cookie set
 *     by src/proxy.ts on first touch.
 *   - Onboarded users: the same sessionId persists across the signup
 *     handoff (the cookie survives the magic-link roundtrip), so a
 *     Reddit visit → signup can be joined on session_id.
 *
 * Attribution:
 *   - The `bca` cookie carries first-touch UTM-like params. Merged
 *     into properties.attribution for signup-milestone events
 *     (onboarded, code_verified) so the funnel dashboard can slice
 *     by source without a separate join.
 */

import { cookies } from "next/headers";
import { db } from "@/db/client";
import { event } from "@/db/schema";

const VISITOR_COOKIE = "bcv";
const ATTRIBUTION_COOKIE = "bca";
// Events that get first-touch attribution folded in automatically.
// Every other event has ambient attribution reachable via session_id
// join if analysis needs it, but these are the signup milestones
// where inline attribution is worth the width.
const ATTRIBUTION_EVENTS = new Set([
  "onboarded",
  "code_verified",
  "url_verified",
  "email_entered",
]);

export type TrackOpts = {
  userId?: number | null;
  properties?: Record<string, unknown>;
  /** Override sessionId when the caller has one out-of-band (rare). */
  sessionId?: string;
};

export async function track(name: string, opts?: TrackOpts): Promise<void> {
  try {
    let sessionId = opts?.sessionId;
    let attribution: Record<string, string> | null = null;
    if (!sessionId || ATTRIBUTION_EVENTS.has(name)) {
      const store = await cookies();
      sessionId = sessionId ?? store.get(VISITOR_COOKIE)?.value ?? "unknown";
      if (ATTRIBUTION_EVENTS.has(name)) {
        const raw = store.get(ATTRIBUTION_COOKIE)?.value;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as unknown;
            if (parsed && typeof parsed === "object") {
              attribution = parsed as Record<string, string>;
            }
          } catch {
            // Bad cookie payload — ignore.
          }
        }
      }
    }
    const properties = attribution
      ? { ...(opts?.properties ?? {}), attribution }
      : opts?.properties ?? null;
    await db.insert(event).values({
      userId: opts?.userId ?? null,
      sessionId,
      name,
      properties,
    });
  } catch (err) {
    console.warn("[track] failed:", name, err);
  }
}
