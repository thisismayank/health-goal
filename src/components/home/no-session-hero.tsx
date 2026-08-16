import { TomorrowTeaser } from "@/components/home/quest-done-hero";
import type { PlannedSession } from "@/db/schema";

export function NoSessionHero({
  tomorrowSession,
}: {
  tomorrowSession: PlannedSession | null;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-blue-500/20 bg-blue-950/5 p-5 space-y-2">
        <div className="text-xs font-mono uppercase tracking-widest text-blue-400/80">
          [REST DAY]
        </div>
        <h2 className="text-xl font-medium mt-1">No quest today.</h2>
        <p className="text-sm text-muted leading-relaxed">
          Recovery is training. Walk, mobilize, eat well, sleep long.
          {tomorrowSession && " Your next quest is queued for tomorrow."}
        </p>
      </section>

      {tomorrowSession && <TomorrowTeaser session={tomorrowSession} />}
    </div>
  );
}
