import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stravaAccount } from "@/db/schema";
import { exchangeCode } from "@/lib/strava/client";
import { getCurrentUser } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Runs the Strava OAuth token exchange + initial 30-day sync + plan
 * refresh. Shows loading.tsx while awaiting — the entire flow feels
 * like a single branded "Connecting your Strava…" moment instead of
 * a blank browser tab.
 *
 * On success we redirect to /welcome?step=2 (mid-onboarding) or
 * /settings?connected=strava (post-onboarding). On error we redirect
 * to /settings with an error code the UI can surface.
 */
export default async function StravaReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code : null;
  const err = typeof params.error === "string" ? params.error : null;

  if (err) redirect(`/settings?error=${encodeURIComponent(err)}`);
  if (!code) redirect(`/settings?error=missing_code`);

  const user = await getCurrentUser();
  if (!user) redirect(`/settings?error=no_user`);

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

    // Pull the last 30d of activity so the plan step has real data
    // and the class computation reflects reality. Best-effort — a
    // sync failure shouldn't block the connection.
    let importedCount = 0;
    try {
      const { syncRecent } = await import("@/lib/strava/sync");
      const results = await syncRecent(user.id, 30);
      importedCount = results.filter((r) => r.action === "created").length;
      const { refreshPlanIfEligible } = await import("@/lib/plan/generator");
      await refreshPlanIfEligible(user.id);
    } catch (e) {
      console.error("[strava return] post-connect sync/refresh failed:", e);
    }

    const dest = user.onboardedAt
      ? `/settings?connected=strava&imported=${importedCount}`
      : `/welcome?step=2&connected=strava&imported=${importedCount}`;
    redirect(dest);
  } catch (e) {
    // redirect() throws NEXT_REDIRECT — let it propagate.
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(`/settings?error=${encodeURIComponent(msg)}`);
  }
}
