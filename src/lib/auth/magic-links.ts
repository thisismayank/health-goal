import { and, count, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { magicLink, userProfile } from "@/db/schema";
import { generateToken, normalizeEmail } from "./tokens";

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Rate-limit thresholds.
const PER_EMAIL_WINDOW_MS = 15 * 60 * 1000; // 15 min
const PER_EMAIL_MAX = 5; // per window
const GLOBAL_WINDOW_MS = 60 * 1000; // 1 min
const GLOBAL_MAX = 30; // per window

export type RateLimitReason = "per_email" | "global";

/**
 * Cheap rate-limit check using the existing magic_link table as its own
 * counter. No extra Redis dependency; correctness good enough for
 * pre-launch (attacker rotating emails will still hit the global cap +
 * fill their own dedupe entries).
 *
 * Returns null when OK to proceed, or the reason when limited.
 */
export async function checkMagicLinkRateLimit(
  rawEmail: string,
): Promise<RateLimitReason | null> {
  const email = normalizeEmail(rawEmail);
  const now = Date.now();

  const perEmailCutoff = new Date(now - PER_EMAIL_WINDOW_MS);
  const [perEmail] = await db
    .select({ n: count() })
    .from(magicLink)
    .where(
      and(
        eq(magicLink.requestedEmail, email),
        gte(magicLink.createdAt, perEmailCutoff),
      ),
    );
  if ((perEmail?.n ?? 0) >= PER_EMAIL_MAX) return "per_email";

  const globalCutoff = new Date(now - GLOBAL_WINDOW_MS);
  const [global] = await db
    .select({ n: count() })
    .from(magicLink)
    .where(gte(magicLink.createdAt, globalCutoff));
  if ((global?.n ?? 0) >= GLOBAL_MAX) return "global";

  return null;
}

/**
 * Issue a magic-link token for an email. If a user with this email exists,
 * link the token to that userId; otherwise leave userId null (verify time
 * will provision the user).
 */
export async function issueMagicLink(rawEmail: string): Promise<{
  token: string;
  email: string;
  expiresAt: Date;
  isNewUser: boolean;
}> {
  const email = normalizeEmail(rawEmail);
  const [existing] = await db
    .select({ id: userProfile.id })
    .from(userProfile)
    .where(eq(userProfile.email, email))
    .limit(1);

  const token = generateToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);

  await db.insert(magicLink).values({
    token,
    requestedEmail: email,
    userId: existing?.id ?? null,
    expiresAt,
  });

  return { token, email, expiresAt, isNewUser: !existing };
}

/**
 * Verify a magic-link token. If valid + unused + unexpired, marks it used
 * and returns the userId to sign in as. Provisions a new user if the token
 * was issued for an email that didn't exist yet.
 */
export async function consumeMagicLink(token: string): Promise<
  | { ok: true; userId: number; isNewUser: boolean }
  | { ok: false; reason: "not_found" | "expired" | "already_used" }
> {
  const now = new Date();
  const [row] = await db
    .select()
    .from(magicLink)
    .where(and(eq(magicLink.token, token), isNull(magicLink.usedAt)))
    .limit(1);

  if (!row) {
    // Could be missing OR already used — differentiate for clearer messaging.
    const [maybeUsed] = await db
      .select({ usedAt: magicLink.usedAt })
      .from(magicLink)
      .where(eq(magicLink.token, token))
      .limit(1);
    if (maybeUsed?.usedAt) return { ok: false, reason: "already_used" };
    return { ok: false, reason: "not_found" };
  }

  if (row.expiresAt < now) {
    return { ok: false, reason: "expired" };
  }

  let userId = row.userId;
  let isNewUser = false;
  if (userId == null) {
    // Provision a new user with the requested email. Name defaults to the
    // local-part of the email — user can rename in profile later.
    const localPart = row.requestedEmail.split("@")[0];
    const defaultName = localPart
      .replace(/[._-]+/g, " ")
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") || "Traveler";
    const [inserted] = await db
      .insert(userProfile)
      .values({
        email: row.requestedEmail,
        name: defaultName,
        createdVia: "magic_link",
      })
      .returning({ id: userProfile.id });
    userId = inserted.id;
    isNewUser = true;
  }

  await db
    .update(magicLink)
    .set({ usedAt: now, userId })
    .where(eq(magicLink.id, row.id));

  return { ok: true, userId, isNewUser };
}

export function magicLinkUrl(baseUrl: string, token: string): string {
  const url = new URL("/api/auth/verify", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function purgeExpiredMagicLinks(): Promise<void> {
  await db.delete(magicLink).where(and(gte(magicLink.expiresAt, new Date())));
}
