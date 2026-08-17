import { NextResponse } from "next/server";
import { authorizeUrl, isConfigured } from "@/lib/oura/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!isConfigured()) {
    return NextResponse.redirect(
      `${url.origin}/settings/integrations?error=oura_not_configured`,
    );
  }
  const redirectUri = `${url.origin}/api/oura/callback`;
  return NextResponse.redirect(authorizeUrl(redirectUri));
}
