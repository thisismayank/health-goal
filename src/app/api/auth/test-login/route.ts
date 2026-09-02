import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userProfile } from "@/db/schema";
import { createSession, setSessionCookie } from "@/lib/auth/sessions";
import { isValidEmail } from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";

/**
 * Automation-only login endpoint for LLM agents (Devin), Playwright,
 * and other bots that can't check email inboxes. Given a valid email
 * plus the shared TEST_LOGIN_TOKEN secret, mints a real session cookie.
 *
 * Modes:
 *   - Default: `?email=X&token=Y` — sign in as an existing user only.
 *     404 if the email isn't in user_profile.
 *   - `?create=1` — auto-provision the user if missing. Name defaults
 *     to the email's local-part (title-cased), same shape as the
 *     magic-link consumeMagicLink flow.
 *   - `?next=/path` — respond with a 307 redirect instead of JSON.
 *     Also happens automatically when the request carries a
 *     `cold_start_seed` cookie: mirrors /api/auth/verify's cold-start
 *     handoff so agents can drive the WHOLE signup flow end-to-end
 *     (fill /start form → tap CTA → hit this endpoint → land on
 *     /?welcome=cold-start).
 *
 * Usage (Devin / Playwright / curl):
 *   curl -c jar "$BASE/api/auth/test-login?email=X&token=$TEST_LOGIN_TOKEN&create=1"
 *
 * Guardrails:
 *  - Disabled entirely when TEST_LOGIN_TOKEN is unset (feature-flagged
 *    off, safe to ship).
 *  - constant-time secret comparison — no timing oracle.
 *  - Rotate TEST_LOGIN_TOKEN on Vercel to revoke all in-flight access.
 *  - `create=1` gated by the same token — if the token leaks, arbitrary
 *    account creation is possible. Rotate to remediate.
 */
export async function GET(request: Request) {
  const expected = process.env.TEST_LOGIN_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "test_login_disabled" },
      { status: 404 },
    );
  }

  const url = new URL(request.url);
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  const token = url.searchParams.get("token") ?? "";
  const create = url.searchParams.get("create") === "1";
  const nextParam = url.searchParams.get("next");
  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { ok: false, error: "invalid_email" },
      { status: 400 },
    );
  }
  if (!safeEqual(token, expected)) {
    return NextResponse.json(
      { ok: false, error: "invalid_token" },
      { status: 403 },
    );
  }

  let [user] = await db
    .select({ id: userProfile.id, name: userProfile.name })
    .from(userProfile)
    .where(eq(userProfile.email, email))
    .limit(1);
  let created = false;
  if (!user) {
    if (!create) {
      return NextResponse.json(
        { ok: false, error: "user_not_found" },
        { status: 404 },
      );
    }
    const localPart = email.split("@")[0];
    const defaultName =
      localPart
        .replace(/[._-]+/g, " ")
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ") || "Traveler";
    const [inserted] = await db
      .insert(userProfile)
      .values({
        email,
        name: defaultName,
        createdVia: "magic_link", // agent traffic looks like normal signup
      })
      .returning({ id: userProfile.id, name: userProfile.name });
    user = inserted;
    created = true;
  }

  const { token: sessionToken, expiresAt } = await createSession(user.id);
  await setSessionCookie(sessionToken, expiresAt);

  // Cold-start handoff mirror: if the caller carries a cold_start_seed
  // cookie (they came from /start and tapped the CTA), route to
  // /onboarding/seed same as the URL magic-link path does. Lets Devin
  // drive the whole cold-start flow end-to-end.
  const store = await cookies();
  const hasSeed = !!store.get("cold_start_seed");
  const redirectTo = nextParam ?? (hasSeed ? "/onboarding/seed" : null);
  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, url), { status: 307 });
  }

  return NextResponse.json({
    ok: true,
    userId: user.id,
    name: user.name,
    created,
    expiresAt: expiresAt.toISOString(),
  });
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
