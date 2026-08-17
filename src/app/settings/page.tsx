import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  dailyMetric,
  notificationPreference,
  stravaAccount,
} from "@/db/schema";
import { requireCurrentUser } from "@/lib/data";
import { NotificationToggle } from "@/components/settings/notification-toggle";
import { PushToggle } from "@/components/settings/push-toggle";
import { getAccountView as getIntervalsView } from "@/lib/intervals/credentials";
import {
  StravaDisconnectButton,
  StravaSyncButton,
} from "@/components/strava-actions";
import { IntervalsSyncButton } from "@/components/intervals-actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: PageProps<"/settings">) {
  const params = await searchParams;
  // Support both legacy `?connected=1` and the new `?connected=strava`.
  const connected =
    params.connected === "1" || params.connected === "strava";
  const importedCount =
    typeof params.imported === "string" && /^\d+$/.test(params.imported)
      ? Number(params.imported)
      : null;
  const err = typeof params.error === "string" ? params.error : null;

  const user = await requireCurrentUser();

  const stravaRow = (
    await db
      .select()
      .from(stravaAccount)
      .where(eq(stravaAccount.userId, user.id))
      .limit(1)
  )[0];

  const lastAutoRow = (
    await db
      .select({ lastAutoSyncAt: dailyMetric.lastAutoSyncAt })
      .from(dailyMetric)
      .where(eq(dailyMetric.userId, user.id))
      .orderBy(desc(dailyMetric.lastAutoSyncAt))
      .limit(1)
  )[0];
  const lastAutoSync = lastAutoRow?.lastAutoSyncAt ?? null;
  const intervalsView = await getIntervalsView(user.id);
  const intervalsOn = !!intervalsView;

  const prefRows = await db
    .select()
    .from(notificationPreference)
    .where(eq(notificationPreference.userId, user.id));
  const tripWeekEnabled =
    prefRows.find((p) => p.kind === "trip_week")?.emailEnabled ?? true;
  const weekendNudgeEnabled =
    prefRows.find((p) => p.kind === "weekend_nudge")?.emailEnabled ?? true;
  const squadActivityEnabled =
    prefRows.find((p) => p.kind === "squad_activity")?.emailEnabled ?? true;
  const featuredTrailEnabled =
    prefRows.find((p) => p.kind === "featured_trail")?.emailEnabled ?? true;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted mt-1">
          Integrations and account preferences.
        </p>
        <Link
          href="/settings/integrations"
          className="inline-block mt-3 text-sm text-blue-300 hover:underline"
        >
          See all integrations →
        </Link>
      </section>

      {connected && (
        <div className="rounded-md bg-accent-strong/20 border border-accent-strong/40 text-accent px-4 py-2 text-sm">
          <span className="font-mono">✓</span> Strava connected
          {importedCount != null && importedCount > 0 ? (
            <>
              {" — "}
              <span className="font-mono">{importedCount}</span> recent
              activit{importedCount === 1 ? "y" : "ies"} imported.
            </>
          ) : (
            "."
          )}
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
          {stravaRow && (
            <span className="text-xs text-accent uppercase tracking-wider">
              Connected
            </span>
          )}
        </header>

        {stravaRow ? (
          <>
            <dl className="text-sm text-muted space-y-1">
              <div>
                Athlete ID:{" "}
                <span className="text-foreground">{stravaRow.athleteId}</span>
              </div>
              <div>
                Scope: <span className="text-foreground">{stravaRow.scope}</span>
              </div>
              <div>
                Last sync:{" "}
                <span className="text-foreground">
                  {stravaRow.lastSyncAt
                    ? new Date(stravaRow.lastSyncAt).toLocaleString()
                    : "never"}
                </span>
              </div>
              <div>
                Token expires:{" "}
                <span className="text-foreground">
                  {new Date(stravaRow.expiresAt).toLocaleString()}
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

      <section className="rounded-lg border border-panel-border bg-panel p-5 space-y-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">intervals.icu</h2>
          {intervalsOn && (
            <span className="text-xs text-accent uppercase tracking-wider">
              Configured
            </span>
          )}
        </header>

        {intervalsOn ? (
          <>
            <dl className="text-sm text-muted space-y-1">
              <div>
                Athlete ID:{" "}
                <span className="text-foreground font-mono">
                  {intervalsView?.athleteId}
                </span>
              </div>
              <div>
                API key:{" "}
                <span className="text-foreground font-mono">
                  ••••{intervalsView?.apiKeyLast4}
                </span>{" "}
                <span className="text-[10px] opacity-60">
                  (encrypted at rest)
                </span>
              </div>
              <div>
                Last auto-sync:{" "}
                <span className="text-foreground">
                  {lastAutoSync
                    ? new Date(lastAutoSync).toLocaleString()
                    : "never"}
                </span>
              </div>
            </dl>
            <p className="text-xs text-muted">
              Pulls the last 30 days of wellness (HRV, resting HR, sleep,
              steps, weight). Manage this connection on{" "}
              <Link
                href="/settings/integrations"
                className="text-blue-300 hover:underline"
              >
                the integrations page
              </Link>
              .
            </p>
            <IntervalsSyncButton />
          </>
        ) : (
          <p className="text-sm text-muted">
            Not connected.{" "}
            <Link
              href="/settings/integrations"
              className="text-blue-300 hover:underline"
            >
              Add your intervals.icu API key →
            </Link>
          </p>
        )}
      </section>

      <section className="rounded-lg border border-panel-border bg-panel p-5 space-y-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Health Auto Export (webhook)</h2>
          <span className="text-xs text-muted uppercase tracking-wider">
            Ready
          </span>
        </header>
        <p className="text-sm text-muted">
          Endpoint accepts POSTs from Health Auto Export (iOS) with a Bearer
          token. Not required if intervals.icu covers your recovery data.
        </p>
        <code className="block text-xs text-muted break-all">
          POST /api/health-import/webhook
        </code>
      </section>

      <section className="rounded-lg border border-panel-border bg-panel p-5 space-y-3">
        <h2 className="text-lg font-medium">Notifications</h2>
        <p className="text-xs text-muted">
          Emails go to{" "}
          <span className="text-foreground">{user.email ?? "your account"}</span>
          . Requires{" "}
          <code className="text-foreground">RESEND_API_KEY</code> in the deploy;
          otherwise sends are logged to Vercel runtime output only.
        </p>
        <div className="divide-y divide-panel-border">
          <NotificationToggle
            kind="trip_week"
            label="Trip-week countdown"
            description="1-week, 3-day, 1-day, day-of, and post-trip emails for saved trails with a target date."
            initialEnabled={tripWeekEnabled}
          />
          <NotificationToggle
            kind="weekend_nudge"
            label="Weekend nudge"
            description="Thursday email with 3 hikes ready for your fitness — even when nothing's planned. Weekly."
            initialEnabled={weekendNudgeEnabled}
          />
          <NotificationToggle
            kind="squad_activity"
            label="Squad activity"
            description="Email when a squadmate logs a trail completion — see what your people are doing."
            initialEnabled={squadActivityEnabled}
          />
          <NotificationToggle
            kind="featured_trail"
            label="Featured trail of the week"
            description="Monday morning email with one hand-picked trail matched to your Hiker Class. New each week."
            initialEnabled={featuredTrailEnabled}
          />
        </div>
        <div className="pt-4 border-t border-panel-border space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
            [PUSH NOTIFICATIONS]
          </div>
          <PushToggle
            vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
          />
        </div>
      </section>

      <section className="rounded-lg border border-panel-border bg-panel p-5 space-y-3">
        <h2 className="text-lg font-medium">Account</h2>
        <dl className="text-sm text-muted space-y-1">
          <div>
            Signed in as{" "}
            <span className="text-foreground">
              {user.email ?? user.name}
            </span>
          </div>
        </dl>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="rounded-md border border-panel-border px-4 py-2 text-sm text-muted hover:text-foreground hover:border-blue-500/40 transition"
          >
            Sign out
          </button>
        </form>
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
