import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stravaAccount } from "@/db/schema";
import { requireCurrentUser } from "@/lib/data";
import { isConfigured as intervalsConfigured } from "@/lib/intervals/client";

export const dynamic = "force-dynamic";

type Status = "connected" | "available" | "approval" | "deprecating";

type Integration = {
  name: string;
  blurb: string;
  status: Status;
  reason?: string; // shown on 'approval' / 'deprecating' cards
  connectHref?: string; // when status === 'available'
  glyph: string;
};

export default async function IntegrationsPage() {
  const user = await requireCurrentUser();

  const [strava] = await db
    .select({ athleteId: stravaAccount.athleteId })
    .from(stravaAccount)
    .where(eq(stravaAccount.userId, user.id))
    .limit(1);
  const stravaConnected = !!strava;
  const intervalsOn = intervalsConfigured();

  const live: Integration[] = [
    {
      name: "Strava",
      blurb: "Runs, hikes, rides, uploads. The most-connected source.",
      status: stravaConnected ? "connected" : "available",
      connectHref: "/api/strava/connect",
      glyph: "◐",
    },
    {
      name: "Apple Health",
      blurb:
        "iOS steps, workouts, sleep, HRV via the Health Auto Export bridge.",
      status: "available",
      connectHref: "/settings#apple-health",
      glyph: "❤︎",
    },
    {
      name: "Intervals.icu",
      blurb:
        "Recovery & readiness scores from Garmin/Wahoo/Zwift (via Intervals).",
      status: intervalsOn ? "connected" : "available",
      connectHref: "/settings#intervals",
      glyph: "▲",
    },
  ];

  const comingSoon: Integration[] = [
    {
      name: "Garmin (direct)",
      blurb: "First-party Garmin Connect activity + wellness pull.",
      status: "approval",
      reason: "Waiting on Garmin Health API developer-program approval.",
      glyph: "▽",
    },
    {
      name: "Oura Ring",
      blurb: "Sleep score, HRV, readiness, temperature trend.",
      status: "approval",
      reason: "On the roadmap — planned as next integration.",
      glyph: "◯",
    },
    {
      name: "Whoop",
      blurb: "Strain, recovery, sleep coach data.",
      status: "approval",
      reason: "Waiting on Whoop developer partnership approval.",
      glyph: "◈",
    },
    {
      name: "Fitbit",
      blurb: "Activity, sleep, heart rate. Being consolidated by Google.",
      status: "approval",
      reason: "On the roadmap — evaluating alongside Google's consolidation.",
      glyph: "◇",
    },
    {
      name: "Polar",
      blurb: "AccessLink API for training + physical activity.",
      status: "approval",
      reason: "On the roadmap.",
      glyph: "◆",
    },
    {
      name: "Withings",
      blurb: "Body composition, sleep, HR (scales + trackers).",
      status: "approval",
      reason: "On the roadmap.",
      glyph: "☱",
    },
    {
      name: "Google Fit",
      blurb: "Steps, workouts, heart rate from Android + connected apps.",
      status: "deprecating",
      reason:
        "Google is sunsetting the Fit REST API at end of 2026. Evaluating Health Connect (Android-native) as the replacement.",
      glyph: "◒",
    },
  ];

  return (
    <div className="space-y-6">
      <section>
        <Link
          href="/settings"
          className="text-xs text-muted hover:text-foreground"
        >
          ← Settings
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Integrations</h1>
        <p className="text-sm text-muted mt-1">
          Connect a data source so Basecamp can personalize your ratings
          + tune your plan.
        </p>
      </section>

      <section className="space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
          [LIVE]
        </div>
        <div className="space-y-2">
          {live.map((i) => (
            <IntegrationCard key={i.name} integration={i} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted">
          [COMING SOON]
        </div>
        <div className="space-y-2">
          {comingSoon.map((i) => (
            <IntegrationCard key={i.name} integration={i} />
          ))}
        </div>
      </section>

      <section className="rounded-md border border-panel-border bg-panel/60 p-4 space-y-2 text-sm">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted">
          [DON'T SEE YOURS?]
        </div>
        <p className="text-muted leading-relaxed">
          Every source that ships an OAuth or REST API is on the table.
          Tell us what you use and we&apos;ll prioritize it.
        </p>
        <a
          href="mailto:hello@basecamp.app?subject=Integration%20request"
          className="text-blue-300 hover:underline text-sm"
        >
          Request an integration →
        </a>
      </section>
    </div>
  );
}

function IntegrationCard({ integration }: { integration: Integration }) {
  const { name, blurb, status, reason, connectHref, glyph } = integration;
  const border =
    status === "connected"
      ? "border-accent/50 bg-accent-strong/5"
      : status === "available"
        ? "border-panel-border bg-panel"
        : "border-panel-border bg-panel opacity-80";

  return (
    <div className={`rounded-lg border ${border} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="text-blue-300 text-lg leading-none pt-0.5"
            aria-hidden
          >
            {glyph}
          </span>
          <div className="min-w-0">
            <div className="font-medium">{name}</div>
            <div className="text-xs text-muted mt-0.5">{blurb}</div>
            {reason && (
              <div className="text-[11px] text-muted mt-1.5 italic">
                {reason}
              </div>
            )}
          </div>
        </div>
        <StatusChip status={status} connectHref={connectHref} />
      </div>
    </div>
  );
}

function StatusChip({
  status,
  connectHref,
}: {
  status: Status;
  connectHref?: string;
}) {
  if (status === "connected") {
    return (
      <span className="text-xs font-mono uppercase tracking-wider text-accent whitespace-nowrap">
        ✓ CONNECTED
      </span>
    );
  }
  if (status === "available" && connectHref) {
    return (
      <Link
        href={connectHref}
        className="rounded-md bg-accent-strong hover:bg-accent text-background font-medium text-xs px-3 py-1.5 whitespace-nowrap"
      >
        Connect →
      </Link>
    );
  }
  if (status === "approval") {
    return (
      <span className="text-[10px] font-mono uppercase tracking-wider text-blue-300 border border-blue-500/40 rounded px-2 py-0.5 whitespace-nowrap">
        Coming soon
      </span>
    );
  }
  if (status === "deprecating") {
    return (
      <span className="text-[10px] font-mono uppercase tracking-wider text-warn border border-warn/40 rounded px-2 py-0.5 whitespace-nowrap">
        Under review
      </span>
    );
  }
  return null;
}
