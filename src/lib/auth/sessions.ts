import { cookies } from "next/headers";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { authSession, userProfile, type UserProfile } from "@/db/schema";
import { generateToken } from "./tokens";

const SESSION_COOKIE = "basecamp_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createSession(userId: number): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(authSession).values({
    token,
    userId,
    expiresAt,
  });
  return { token, expiresAt };
}

export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Read the session cookie, look up the session + user, return the user if
 * the session is valid (exists and not expired). Returns null otherwise.
 * Also touches lastSeenAt for observability.
 */
export async function getUserFromSession(): Promise<UserProfile | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const now = new Date();
  const [session] = await db
    .select()
    .from(authSession)
    .where(and(eq(authSession.token, token), gte(authSession.expiresAt, now)))
    .limit(1);
  if (!session) return null;

  const [user] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.id, session.userId))
    .limit(1);
  if (!user) return null;

  // Best-effort touch; don't fail the request if this write hits an issue.
  db.update(authSession)
    .set({ lastSeenAt: now })
    .where(eq(authSession.id, session.id))
    .catch(() => {});

  return user;
}

export async function deleteSessionByToken(token: string): Promise<void> {
  await db.delete(authSession).where(eq(authSession.token, token));
}

export async function getCurrentSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
