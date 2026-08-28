import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  consumeMagicLinkByCode,
} from "@/lib/auth/magic-links";
import { createSession, setSessionCookie } from "@/lib/auth/sessions";
import { isValidEmail } from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";

/**
 * 6-digit code verification path. Mobile-friendly alternative to the
 * URL magic-link — the user types the code in the same tab where they
 * entered their email, avoiding cross-app browser jumps that lose the
 * cold_start_seed cookie.
 *
 * On success: creates a session, sets the cookie, and returns a
 * `redirect` field so the client can transition (either /onboarding/seed
 * when a cold_start_seed cookie is present, or / otherwise).
 *
 * Rate limiting: brute force is already bounded by the request-link
 * limit (max 5 valid codes per email per 15-min window × 6-digit space
 * = ~140k attempts for 50% odds, well beyond the 15-min TTL). No
 * additional guard needed at this scale.
 */
export async function POST(req: Request) {
  let body: { email?: string; code?: string };
  try {
    body = (await req.json()) as { email?: string; code?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid" },
      { status: 400 },
    );
  }

  const email = (body.email ?? "").trim();
  const code = (body.code ?? "").trim();
  if (!email || !isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { ok: false, error: "invalid" },
      { status: 400 },
    );
  }

  const result = await consumeMagicLinkByCode(email, code);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.reason },
      { status: result.reason === "expired" ? 410 : 400 },
    );
  }

  const { token: sessionToken, expiresAt } = await createSession(result.userId);
  await setSessionCookie(sessionToken, expiresAt);

  // Same cold-start handoff as /api/auth/verify — the presence of the
  // seed cookie signals the user came in via the /start public flow.
  const store = await cookies();
  const redirect = store.get("cold_start_seed")
    ? "/onboarding/seed"
    : "/";

  return NextResponse.json({ ok: true, redirect });
}
