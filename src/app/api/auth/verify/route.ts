import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { consumeMagicLink } from "@/lib/auth/magic-links";
import { createSession, setSessionCookie } from "@/lib/auth/sessions";
import { track } from "@/lib/analytics/track";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?err=invalid_token", url));
  }

  const result = await consumeMagicLink(token);
  if (!result.ok) {
    const code =
      result.reason === "expired"
        ? "expired_token"
        : "invalid_token";
    return NextResponse.redirect(new URL(`/login?err=${code}`, url));
  }

  const { token: sessionToken, expiresAt } = await createSession(result.userId);
  await setSessionCookie(sessionToken, expiresAt);

  // Cold-start handoff: if the user came in via /start (public
  // verdict-before-signup), a signed cookie was set on that path
  // with their trail slug + answers. Route them to /onboarding/seed
  // so the answers become their onboarding baseline + the trail is
  // saved as primary. Home routing takes over from there.
  const store = await cookies();
  const hasSeed = !!store.get("cold_start_seed");
  await track("url_verified", {
    userId: result.userId,
    properties: { isNewUser: result.isNewUser, hasColdStartSeed: hasSeed },
  });
  if (hasSeed) {
    return NextResponse.redirect(new URL("/onboarding/seed", url));
  }

  // First-time users otherwise land on home; unonboarded users get
  // routed onward from there.
  return NextResponse.redirect(new URL("/", url));
}
