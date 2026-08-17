import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userProfile } from "@/db/schema";
import { createSession, setSessionCookie } from "@/lib/auth/sessions";
import { isValidEmail } from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";

/**
 * Automation-only login endpoint. Given a valid email + the shared
 * TEST_LOGIN_TOKEN secret, mints a real session cookie for that user.
 *
 * Usage (Devin / Playwright / curl):
 *   curl -c cookies.txt "$BASE/api/auth/test-login?email=X&token=$TEST_LOGIN_TOKEN"
 *
 * Then reuse cookies.txt for authenticated requests.
 *
 * Guardrails:
 *  - Disabled entirely when TEST_LOGIN_TOKEN is unset (feature-flagged
 *    off by default, safe to leave the code shipped).
 *  - constant-time secret comparison — no timing oracle.
 *  - Existing user only — the endpoint won't auto-create accounts.
 *  - Rotate TEST_LOGIN_TOKEN on Vercel to revoke all in-flight access.
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

  const [user] = await db
    .select({ id: userProfile.id, name: userProfile.name })
    .from(userProfile)
    .where(eq(userProfile.email, email))
    .limit(1);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "user_not_found" },
      { status: 404 },
    );
  }

  const { token: sessionToken, expiresAt } = await createSession(user.id);
  await setSessionCookie(sessionToken, expiresAt);
  return NextResponse.json({
    ok: true,
    userId: user.id,
    name: user.name,
    expiresAt: expiresAt.toISOString(),
  });
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
