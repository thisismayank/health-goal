import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stravaAccount } from "@/db/schema";
import { getCurrentUser } from "@/lib/data";
import {
  StravaDisconnectButton,
  StravaSyncButton,
} from "@/components/strava-actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: PageProps<"/settings">) {
  const params = await searchParams;
  const connected = params.connected === "1";
  const err = typeof params.error === "string" ? params.error : null;

  const user = await getCurrentUser();
  if (!user) return <p className="text-muted">No user found.</p>;

  const rows = await db
    .select()
    .from(stravaAccount)
    .where(eq(stravaAccount.userId, user.id))
    .limit(1);
  const strava = rows[0] ?? null;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted mt-1">
          Integrations and account preferences.
        </p>
      </section>

      {connected && (
        <div className="rounded-md bg-accent-strong/20 border border-accent-strong/40 text-accent px-4 py-2 text-sm">
          Strava connected. Recent activities will start flowing in shortly.
        </div>
      )}
      {err && (
        <div className="rounded-md bg-danger/20 border border-danger/40 text-danger px-4 py-2 text-sm">
          Strava error: {err}
        </div>
      )}

      <section className="rounded-lg border border-panel-border bg-panel p-5 space-y-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Strava</h2>
          {strava && (
            <span className="text-xs text-accent uppercase tracking-wider">
              Connected
            </span>
          )}
        </header>

        {strava ? (
          <>
            <dl className="text-sm text-muted space-y-1">
              <div>
                Athlete ID:{" "}
                <span className="text-foreground">{strava.athleteId}</span>
              </div>
              <div>
                Scope: <span className="text-foreground">{strava.scope}</span>
              </div>
              <div>
                Last sync:{" "}
                <span className="text-foreground">
                  {strava.lastSyncAt
                    ? new Date(strava.lastSyncAt).toLocaleString()
                    : "never"}
                </span>
              </div>
              <div>
                Token expires:{" "}
                <span className="text-foreground">
                  {new Date(strava.expiresAt).toLocaleString()}
                </span>
              </div>
            </dl>
            <p className="text-xs text-muted">
              New Strava activities auto-import via webhook. Use Sync now to
              backfill the last 30 days if webhooks lagged.
            </p>
            <div className="flex flex-wrap gap-3">
              <StravaSyncButton />
              <StravaDisconnectButton />
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              Connect Strava to auto-import runs, hikes, and rides into your
              workout history. Activities that fall on a planned session's date
              will mark that session complete.
            </p>
            <Link
              href="/api/strava/connect"
              className="inline-block rounded-md bg-accent-strong hover:bg-accent text-background font-medium px-4 py-2"
            >
              Connect Strava
            </Link>
          </>
        )}
      </section>

      <section className="rounded-lg border border-panel-border bg-panel p-5 space-y-2">
        <h2 className="text-lg font-medium">Coming soon</h2>
        <ul className="text-sm text-muted space-y-1 list-disc list-inside">
          <li>HealthKit via native iOS bridge</li>
          <li>Garmin direct integration (pending developer-program approval)</li>
          <li>FIT / GPX / TCX file import</li>
        </ul>
      </section>
    </div>
  );
}
