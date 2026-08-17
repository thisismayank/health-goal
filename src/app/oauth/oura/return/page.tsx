import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ouraAccount } from "@/db/schema";
import { exchangeCode, getPersonalInfo } from "@/lib/oura/client";
import { getCurrentUser } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function OuraReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code : null;
  const err = typeof params.error === "string" ? params.error : null;

  if (err) redirect(`/settings/integrations?error=${encodeURIComponent(err)}`);
  if (!code) redirect(`/settings/integrations?error=missing_code`);

  const user = await getCurrentUser();
  if (!user) redirect(`/settings/integrations?error=no_user`);

  try {
    // Ouro requires the exact same redirect_uri that was used to
    // request authorization. We register /api/oura/callback there
    // even though this page is the actual UX destination.
    const url = new URL(
      "/api/oura/callback",
      process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000",
    );
    const tokens = await exchangeCode(code, url.toString());

    let ouraUserId: string | null = null;
    try {
      const info = await getPersonalInfo(tokens.access_token);
      ouraUserId = info.id ?? null;
    } catch {
      // personal_info is optional; skip on failure.
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const values = {
      userId: user.id,
      ouraUserId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scope: "personal daily heartrate workout",
      updatedAt: new Date(),
    };

    const existing = await db
      .select()
      .from(ouraAccount)
      .where(eq(ouraAccount.userId, user.id))
      .limit(1);
    if (existing[0]) {
      await db
        .update(ouraAccount)
        .set(values)
        .where(eq(ouraAccount.id, existing[0].id));
    } else {
      await db.insert(ouraAccount).values(values);
    }

    // Initial 30-day pull so today's home surfaces have data.
    let importedCount = 0;
    try {
      const { syncRecent } = await import("@/lib/oura/sync");
      const result = await syncRecent(user.id, 30);
      importedCount = result.upserted;
    } catch (e) {
      console.error("[oura return] initial sync failed:", e);
    }

    redirect(
      `/settings/integrations?connected=oura&imported=${importedCount}`,
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(`/settings/integrations?error=${encodeURIComponent(msg)}`);
  }
}
