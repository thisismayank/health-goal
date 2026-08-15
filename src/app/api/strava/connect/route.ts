import { NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/strava/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/strava/callback`;
  return NextResponse.redirect(authorizeUrl(redirectUri));
}
