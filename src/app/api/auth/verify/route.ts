import { NextResponse } from "next/server";
import { consumeMagicLink } from "@/lib/auth/magic-links";
import { createSession, setSessionCookie } from "@/lib/auth/sessions";

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

  // First-time users could be routed to onboarding once it exists.
  // For now, everyone lands on home.
  return NextResponse.redirect(new URL("/", url));
}
