import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Strava redirects here after OAuth. We used to do the token exchange
 * + activity sync inline (2-5s of blank browser), then redirect. Now
 * we bounce immediately to /oauth/strava/return which shows a branded
 * loading state via loading.tsx while the same work runs server-side.
 *
 * We keep this as an API route so the Strava-registered redirect_uri
 * doesn't need to change.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");

  const dest = new URL("/oauth/strava/return", url.origin);
  if (err) dest.searchParams.set("error", err);
  if (code) dest.searchParams.set("code", code);
  return NextResponse.redirect(dest);
}
