import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stravaAccount } from "@/db/schema";
import { exchangeCode } from "@/lib/strava/client";
import { getCurrentUser } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");

  if (err) {
    return NextResponse.redirect(
      `${url.origin}/settings?error=${encodeURIComponent(err)}`,
    );
  }
  if (!code) {
    return NextResponse.redirect(`${url.origin}/settings?error=missing_code`);
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(`${url.origin}/settings?error=no_user`);
  }

  try {
    const tokens = await exchangeCode(code);
    const values = {
      userId: user.id,
      athleteId: String(tokens.athlete.id),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expires_at * 1000),
      scope: "read,activity:read_all",
      updatedAt: new Date(),
    };

    const existing = await db
      .select()
      .from(stravaAccount)
      .where(eq(stravaAccount.userId, user.id))
      .limit(1);

    if (existing[0]) {
      await db
        .update(stravaAccount)
        .set(values)
        .where(eq(stravaAccount.id, existing[0].id));
    } else {
      await db.insert(stravaAccount).values(values);
    }
    return NextResponse.redirect(`${url.origin}/settings?connected=1`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect(
      `${url.origin}/settings?error=${encodeURIComponent(msg)}`,
    );
  }
}
