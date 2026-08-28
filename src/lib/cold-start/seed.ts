/**
 * Signed cookie for carrying a stranger's cold-start answers through
 * the magic-link signup round-trip.
 *
 * Flow: /start/[slug] "Get the plan" CTA → writeSeed({slug, answers})
 * → redirect to /login → user gets email → clicks link → lands on
 * /onboarding/seed → readAndConsumeSeed() reads the answers, creates
 * the trail row, seeds the profile fields, kicks off /plan/new.
 *
 * Signed (HMAC-SHA256) so we can trust the payload wasn't tampered
 * with in flight. HttpOnly + Secure + 15-min TTL — the whole magic-
 * link roundtrip should complete in a few minutes; anything longer
 * and we'd rather the user re-answer than trust a stale cookie.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { ColdStartAnswers } from "@/lib/basecamp/synthetic-snapshot";

const COOKIE_NAME = "cold_start_seed";
const TTL_SECONDS = 15 * 60;

export type ColdStartSeed = {
  slug: string;
  answers: ColdStartAnswers;
  // Millis since epoch, embedded so the signature covers freshness.
  writtenAt: number;
};

function key(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) throw new Error("APP_ENCRYPTION_KEY not set");
  return Buffer.from(raw, "hex");
}

function sign(payload: string): string {
  return createHmac("sha256", key()).update(payload).digest("base64url");
}

function pack(seed: ColdStartSeed): string {
  const payload = Buffer.from(JSON.stringify(seed), "utf8").toString(
    "base64url",
  );
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

function unpack(cookie: string): ColdStartSeed | null {
  const dot = cookie.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  const expected = sign(payload);
  // timingSafeEqual requires equal length or throws.
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const seed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as ColdStartSeed;
    if (Date.now() - seed.writtenAt > TTL_SECONDS * 1000) return null;
    return seed;
  } catch {
    return null;
  }
}

export async function writeSeed(input: {
  slug: string;
  answers: ColdStartAnswers;
}): Promise<void> {
  const seed: ColdStartSeed = {
    slug: input.slug,
    answers: input.answers,
    writtenAt: Date.now(),
  };
  const store = await cookies();
  store.set(COOKIE_NAME, pack(seed), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

/**
 * Read + clear. Never leaves the cookie behind — consuming the seed
 * once is the whole contract (post-signup onboarding uses it, then
 * the cookie is gone).
 */
export async function readAndConsumeSeed(): Promise<ColdStartSeed | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const seed = unpack(raw);
  store.delete(COOKIE_NAME);
  return seed;
}

/**
 * Peek at the seed without clearing it. Used by /login to tailor copy
 * ("save your Rainier verdict") to what the user just did on /start.
 * The consume happens later, at /onboarding/seed.
 */
export async function readSeedNoConsume(): Promise<ColdStartSeed | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return unpack(raw);
}
