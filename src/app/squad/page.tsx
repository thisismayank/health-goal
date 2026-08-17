import Link from "next/link";
import { requireOnboardedUser } from "@/lib/data";
import { getSquadsForUser } from "@/lib/squad/queries";
import { CreateSquadForm } from "@/components/squad/create-form";

export const dynamic = "force-dynamic";

export default async function SquadIndexPage() {
  const user = await requireOnboardedUser();
  const squads = await getSquadsForUser(user.id);

  return (
    <div className="space-y-5">
      <section>
        <div className="text-xs uppercase tracking-widest text-muted">
          Squads
        </div>
        <h1 className="text-2xl font-semibold mt-0.5">Your squads</h1>
        <p className="text-sm text-muted mt-1 leading-relaxed">
          Small friend groups (max 8). See what your people are hiking, share
          trails, compare times on the same objectives. Private by design —
          no discovery, no strangers.
        </p>
      </section>

      {squads.length > 0 ? (
        <div className="space-y-2">
          {squads.map((s) => (
            <Link
              key={s.id}
              href={`/squad/${s.id}`}
              className="block rounded-md border border-panel-border bg-panel px-4 py-3 hover:border-blue-500/40 transition"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-medium truncate">{s.name}</div>
                <div className="text-xs text-muted whitespace-nowrap">
                  {s.memberCount} member{s.memberCount === 1 ? "" : "s"}
                </div>
              </div>
              {s.role === "admin" && (
                <div className="text-[10px] uppercase tracking-widest text-blue-300 mt-0.5">
                  Admin
                </div>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-panel-border bg-panel/40 p-4 text-sm text-muted space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
            [NOT YET]
          </div>
          <p className="leading-relaxed">
            Squads are for when a couple of your friends are also using
            Basecamp. No point creating one solo — you&apos;d just be
            comparing yourself to yourself. Come back once you have people
            to share trails with.
          </p>
        </div>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-blue-300 hover:underline">
          Ready to start one anyway?
        </summary>
        <div className="mt-3">
          <CreateSquadForm />
        </div>
      </details>
    </div>
  );
}
