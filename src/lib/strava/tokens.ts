import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stravaAccount, type StravaAccount } from "@/db/schema";
import { refreshTokens } from "./client";

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export async function getValidTokens(userId: number): Promise<StravaAccount | null> {
  const rows = await db
    .select()
    .from(stravaAccount)
    .where(eq(stravaAccount.userId, userId))
    .limit(1);
  const account = rows[0];
  if (!account) return null;

  const now = Date.now();
  const expiresAt = account.expiresAt.getTime();
  if (expiresAt - now > REFRESH_BUFFER_MS) return account;

  const refreshed = await refreshTokens(account.refreshToken);
  const [updated] = await db
    .update(stravaAccount)
    .set({
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: new Date(refreshed.expires_at * 1000),
      updatedAt: new Date(),
    })
    .where(eq(stravaAccount.id, account.id))
    .returning();
  return updated;
}
