/**
 * Token freshness for Oura — mirrors getValidTokens in strava/tokens.
 * Oura access tokens last ~24h; we refresh 60s before expiry so a
 * long-running request doesn't burn on a boundary.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ouraAccount } from "@/db/schema";
import { refreshTokens } from "./client";

const REFRESH_SLACK_MS = 60_000;

export async function getValidTokens(
  userId: number,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const [row] = await db
    .select()
    .from(ouraAccount)
    .where(eq(ouraAccount.userId, userId))
    .limit(1);
  if (!row) return null;

  const expiresAtMs = new Date(row.expiresAt).getTime();
  if (expiresAtMs - REFRESH_SLACK_MS > Date.now()) {
    return { accessToken: row.accessToken, refreshToken: row.refreshToken };
  }

  const fresh = await refreshTokens(row.refreshToken);
  const newExpires = new Date(Date.now() + fresh.expires_in * 1000);
  await db
    .update(ouraAccount)
    .set({
      accessToken: fresh.access_token,
      refreshToken: fresh.refresh_token,
      expiresAt: newExpires,
      updatedAt: new Date(),
    })
    .where(eq(ouraAccount.id, row.id));

  return {
    accessToken: fresh.access_token,
    refreshToken: fresh.refresh_token,
  };
}
