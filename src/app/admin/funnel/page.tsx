/**
 * Product analytics dashboard.
 *
 * Gated to user_id === 1 (Mayank). Not shipping a permissions model
 * for one admin. If a second admin ever exists, promote to a proper
 * `role` column on user_profile.
 *
 * What's here on purpose:
 *   - Funnel: distinct sessions that fired each step in the last 30d.
 *   - Attribution split: onboarded events grouped by src cookie value.
 *   - D7 stickiness: new signups in the last 30d, and whether they
 *     hit the "3+ distinct home_visit days in first 7d" bar.
 *   - Daily event counts as a raw feed for eyeballing spikes.
 *
 * What's deliberately NOT here yet:
 *   - Time-series charting (numbers first; charts once we know
 *     what to look at)
 *   - A/B breakdowns (no experiments running)
 *   - Cohort-over-time views (need > 30d of data first)
 */

import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { getUserFromSession } from "@/lib/auth/sessions";

export const dynamic = "force-dynamic";

const ADMIN_USER_ID = 1;
const FUNNEL_STEPS = [
  { name: "start_visit", label: "/start visit" },
  { name: "start_trail_view", label: "Tapped a trail" },
  { name: "verdict_shown", label: "Verdict shown" },
  { name: "get_plan_clicked", label: "Get plan clicked" },
  { name: "email_entered", label: "Email entered" },
  { name: "code_verified", label: "Code verified" },
  { name: "onboarded", label: "Onboarded" },
] as const;

type FunnelRow = { name: string; sessions: number };
type AttributionRow = { source: string; onboardedCount: number };
type DailyRow = { day: string; name: string; count: number };
type StickyRow = {
  userId: number;
  email: string | null;
  onboardedAt: Date;
  distinctHomeDays: number;
  isSticky: boolean;
};

export default async function FunnelPage() {
  const user = await getUserFromSession();
  if (!user || user.id !== ADMIN_USER_ID) notFound();

  const [funnel, attribution, daily, sticky] = await Promise.all([
    loadFunnel(),
    loadAttribution(),
    loadDaily(),
    loadStickiness(),
  ]);

  const startVisits = funnel.find((r) => r.name === "start_visit")?.sessions ?? 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <header>
        <div className="text-xs font-mono uppercase tracking-widest text-blue-400">
          [FUNNEL · LAST 30d]
        </div>
        <h1 className="text-2xl font-semibold mt-1">Product analytics</h1>
        <p className="text-xs text-muted mt-1">
          Distinct sessions per step. First row is denominator for the funnel.
        </p>
      </header>

      <section className="rounded-lg border border-panel-border bg-panel p-4 space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-muted">
          Cold-start funnel
        </h2>
        <div className="space-y-1">
          {FUNNEL_STEPS.map((step) => {
            const row = funnel.find((r) => r.name === step.name);
            const count = row?.sessions ?? 0;
            const pct = startVisits > 0 ? (count / startVisits) * 100 : 0;
            return (
              <div
                key={step.name}
                className="flex items-baseline gap-3 text-sm font-mono"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-foreground">{step.label}</span>
                  <span className="text-muted text-xs ml-2">{step.name}</span>
                </div>
                <div className="tabular-nums text-blue-300 w-16 text-right">
                  {count}
                </div>
                <div className="tabular-nums text-muted w-14 text-right text-xs">
                  {pct.toFixed(1)}%
                </div>
                <div className="w-32 h-1 bg-panel-border rounded overflow-hidden">
                  <div
                    className="h-full bg-blue-400"
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-panel-border bg-panel p-4 space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-muted">
          Onboarded by attribution source
        </h2>
        {attribution.length === 0 ? (
          <p className="text-xs text-muted">No onboarded events with attribution yet.</p>
        ) : (
          <div className="space-y-1">
            {attribution.map((row) => (
              <div
                key={row.source}
                className="flex items-baseline gap-3 text-sm font-mono"
              >
                <div className="flex-1">{row.source}</div>
                <div className="tabular-nums text-blue-300 w-16 text-right">
                  {row.onboardedCount}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-panel-border bg-panel p-4 space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-muted">
          Stickiness · signups in last 30d
        </h2>
        <p className="text-xs text-muted">
          Sticky = 3+ distinct home_visit days within 7 days of onboarding.
        </p>
        {sticky.length === 0 ? (
          <p className="text-xs text-muted">No signups in the last 30 days.</p>
        ) : (
          <>
            <div className="text-sm">
              <span className="text-accent font-mono font-semibold">
                {sticky.filter((s) => s.isSticky).length}
              </span>{" "}
              /{" "}
              <span className="font-mono tabular-nums">{sticky.length}</span>{" "}
              stuck ({(
                (sticky.filter((s) => s.isSticky).length / sticky.length) *
                100
              ).toFixed(0)}
              %)
            </div>
            <div className="space-y-0.5 mt-2">
              {sticky.map((s) => (
                <div
                  key={s.userId}
                  className="flex items-baseline gap-3 text-xs font-mono"
                >
                  <div className="w-8 text-muted">#{s.userId}</div>
                  <div className="flex-1 min-w-0 truncate">
                    {s.email ?? "(no email)"}
                  </div>
                  <div className="text-muted w-24 tabular-nums">
                    {s.onboardedAt.toISOString().slice(0, 10)}
                  </div>
                  <div
                    className={`w-16 text-right tabular-nums ${
                      s.isSticky ? "text-accent" : "text-muted"
                    }`}
                  >
                    {s.distinctHomeDays}d in 7
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="rounded-lg border border-panel-border bg-panel p-4 space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-muted">
          Daily event counts (last 14d)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 text-xs font-mono">
          {daily.map((d, i) => (
            <div
              key={`${d.day}:${d.name}:${i}`}
              className="flex items-baseline gap-2"
            >
              <div className="text-muted w-24 tabular-nums">{d.day}</div>
              <div className="flex-1 truncate">{d.name}</div>
              <div className="tabular-nums text-blue-300 w-8 text-right">
                {d.count}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

async function loadFunnel(): Promise<FunnelRow[]> {
  const rows = await db.execute<{ name: string; sessions: string }>(sql`
    SELECT name, COUNT(DISTINCT session_id)::text AS sessions
    FROM event
    WHERE created_at > NOW() - INTERVAL '30 days'
      AND name IN (
        'start_visit', 'start_trail_view', 'verdict_shown',
        'get_plan_clicked', 'email_entered', 'code_verified', 'onboarded'
      )
    GROUP BY name
  `);
  return rows.map((r) => ({ name: r.name, sessions: Number(r.sessions) }));
}

async function loadAttribution(): Promise<AttributionRow[]> {
  const rows = await db.execute<{ source: string; c: string }>(sql`
    SELECT
      COALESCE(properties -> 'attribution' ->> 'src',
               properties -> 'attribution' ->> 'utm_source',
               '(none)') AS source,
      COUNT(*)::text AS c
    FROM event
    WHERE name = 'onboarded'
      AND created_at > NOW() - INTERVAL '30 days'
    GROUP BY source
    ORDER BY c DESC
  `);
  return rows.map((r) => ({ source: r.source, onboardedCount: Number(r.c) }));
}

async function loadDaily(): Promise<DailyRow[]> {
  const rows = await db.execute<{
    day: string;
    name: string;
    c: string;
  }>(sql`
    SELECT
      TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
      name,
      COUNT(*)::text AS c
    FROM event
    WHERE created_at > NOW() - INTERVAL '14 days'
    GROUP BY day, name
    ORDER BY day DESC, name ASC
  `);
  return rows.map((r) => ({ day: r.day, name: r.name, count: Number(r.c) }));
}

async function loadStickiness(): Promise<StickyRow[]> {
  const rows = await db.execute<{
    user_id: number;
    email: string | null;
    onboarded_at: string;
    days: string;
  }>(sql`
    WITH signups AS (
      SELECT
        (properties ->> 'firstTime')::boolean AS first_time,
        user_id,
        MIN(created_at) AS onboarded_at
      FROM event
      WHERE name = 'onboarded'
        AND created_at > NOW() - INTERVAL '30 days'
        AND user_id IS NOT NULL
      GROUP BY user_id, first_time
    )
    SELECT
      s.user_id,
      u.email,
      s.onboarded_at,
      COALESCE(
        (
          SELECT COUNT(DISTINCT DATE(e.created_at AT TIME ZONE 'UTC'))
          FROM event e
          WHERE e.name = 'home_visit'
            AND e.user_id = s.user_id
            AND e.created_at >= s.onboarded_at
            AND e.created_at < s.onboarded_at + INTERVAL '7 days'
        ),
        0
      )::text AS days
    FROM signups s
    LEFT JOIN user_profile u ON u.id = s.user_id
    WHERE s.first_time IS DISTINCT FROM false
    ORDER BY s.onboarded_at DESC
  `);
  return rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    onboardedAt: new Date(r.onboarded_at),
    distinctHomeDays: Number(r.days),
    isSticky: Number(r.days) >= 3,
  }));
}
