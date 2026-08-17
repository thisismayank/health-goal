import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Oura redirects here after OAuth. Bounces to /oauth/oura/return
 * so the token exchange + initial sync happen with a branded loading
 * state instead of a blank browser.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");

  const dest = new URL("/oauth/oura/return", url.origin);
  if (err) dest.searchParams.set("error", err);
  if (code) dest.searchParams.set("code", code);
  return NextResponse.redirect(dest);
}
