import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { squad } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/data";
import {
  getSquadActivityFeed,
  getSquadMembers,
  isMemberOf,
} from "@/lib/squad/queries";
import { SquadInviteLink } from "@/components/squad/invite-link";

export const dynamic = "force-dynamic";

export default async function SquadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const squadId = Number(id);
  if (!Number.isFinite(squadId)) notFound();

  const user = await requireOnboardedUser();
  const membership = await isMemberOf(squadId, user.id);
  if (!membership.member) notFound();

  const [s] = await db
    .select()
    .from(squad)
    .where(eq(squad.id, squadId))
    .limit(1);
  if (!s) notFound();

  const [members, feed] = await Promise.all([
    getSquadMembers(squadId, user.id),
    getSquadActivityFeed(squadId, user.id, 30),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/squad"
          className="text-xs text-muted hover:text-foreground"
        >
          ← Squads
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{s.name}</h1>
        <div className="text-xs text-muted mt-0.5">
          {members.length} member{members.length === 1 ? "" : "s"}
        </div>
      </div>

      <SquadInviteLink
        squadId={squadId}
        inviteToken={s.inviteToken}
        isAdmin={membership.role === "admin"}
      />

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-muted">
          Members
        </h2>
        <div className="rounded-md border border-panel-border bg-panel divide-y divide-panel-border">
          {members.map((m) => (
            <div
              key={m.userId}
              className="flex items-baseline justify-between gap-3 px-4 py-2.5"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {m.name}
                  {m.isYou && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-widest text-blue-300">
                      you
                    </span>
                  )}
                </div>
                {m.email && (
                  <div className="text-[10px] text-muted truncate">
                    {m.email}
                  </div>
                )}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted whitespace-nowrap">
                {m.role}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-muted">
          Recent completions · {feed.length}
        </h2>
        {feed.length === 0 ? (
          <div className="rounded-md border border-panel-border bg-panel p-5 text-sm text-muted leading-relaxed">
            No completions yet. Log a trail from{" "}
            <Link
              href="/trails"
              className="text-blue-300 hover:underline"
            >
              your trails
            </Link>
            {" "}and it'll show up here for the whole squad.
          </div>
        ) : (
          <ul className="divide-y divide-panel-border border border-panel-border rounded-md bg-panel">
            {feed.map((f) => (
              <li key={f.completionId} className="px-4 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-sm font-medium">
                      {f.userName}
                      {f.isYou && (
                        <span className="ml-1.5 text-[10px] uppercase tracking-widest text-blue-300">
                          you
                        </span>
                      )}
                    </span>
                    {" "}
                    <span className="text-muted text-sm">did</span>{" "}
                    <Link
                      href={`/trails/${f.trailId}`}
                      className="text-sm text-blue-300 hover:underline"
                    >
                      {f.trailName}
                    </Link>
                  </div>
                  <div className="text-xs text-muted whitespace-nowrap tabular-nums">
                    {f.completedAt}
                    {f.timeMinutes != null && (
                      <span> · {formatMinutes(f.timeMinutes)}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}m`;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}
