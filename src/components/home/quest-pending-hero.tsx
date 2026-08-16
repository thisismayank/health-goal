import { getLastSetsForExercise } from "@/lib/data";
import { LogSessionForm } from "@/components/log-session-form";
import { ReopenButton, SkipButton } from "@/components/session-actions";
import type { PlannedSession } from "@/db/schema";

type Prescription = { name: string; sets: number; reps: string }[];

function safeParsePrescription(json: string | null): Prescription | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as Prescription) : null;
  } catch {
    return null;
  }
}

export async function QuestPendingHero({
  session,
  userId,
}: {
  session: PlannedSession;
  userId: number;
}) {
  const prescription = safeParsePrescription(session.strengthPrescription);
  const rpeRange =
    session.targetRpeMin != null && session.targetRpeMax != null
      ? session.targetRpeMin === session.targetRpeMax
        ? `RPE ${session.targetRpeMin}`
        : `RPE ${session.targetRpeMin}–${session.targetRpeMax}`
      : null;

  const isSkipped = session.status === "skipped";

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-blue-500/30 bg-blue-950/10 shadow-lg shadow-blue-500/10 p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-mono uppercase tracking-widest text-blue-400">
              {isSkipped ? "[QUEST · SKIPPED]" : "[YOUR NEXT QUEST]"}
            </div>
            <div className="text-xs uppercase tracking-widest text-muted mt-1">
              {session.sessionCategory.replaceAll("_", " ").toLowerCase()}
            </div>
            <h2 className="text-xl font-medium mt-1 leading-tight">
              {session.title}
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {session.targetDurationMinutes != null && (
            <span>
              <span className="text-foreground">
                {session.targetDurationMinutes}
              </span>{" "}
              min
            </span>
          )}
          {rpeRange && <span>{rpeRange}</span>}
          {session.targetPackWeightLb != null && (
            <span>
              Pack{" "}
              <span className="text-foreground">
                {session.targetPackWeightLb}
              </span>{" "}
              lb
            </span>
          )}
          {session.targetElevationGainFt != null && (
            <span>
              +
              <span className="text-foreground">
                {session.targetElevationGainFt}
              </span>{" "}
              ft
            </span>
          )}
        </div>
        {session.instructions && (
          <p className="text-sm leading-relaxed text-foreground/90">
            {session.instructions}
          </p>
        )}
      </section>

      {isSkipped ? (
        <div className="rounded-lg border border-panel-border bg-panel p-4 flex items-center justify-between">
          <span className="text-warn text-sm">Skipped today.</span>
          <ReopenButton plannedSessionId={session.id} />
        </div>
      ) : (
        <PlannedFormWrap
          plannedSessionId={session.id}
          durationMinutes={session.targetDurationMinutes}
          rpeMin={session.targetRpeMin}
          rpeMax={session.targetRpeMax}
          prescription={prescription}
          userId={userId}
        />
      )}
    </div>
  );
}

async function PlannedFormWrap({
  plannedSessionId,
  durationMinutes,
  rpeMin,
  rpeMax,
  prescription,
  userId,
}: {
  plannedSessionId: number;
  durationMinutes: number | null;
  rpeMin: number | null;
  rpeMax: number | null;
  prescription: Prescription | null;
  userId: number;
}) {
  const prevSetsByExercise: Record<
    string,
    { reps: number | null; weightKg: number | null }[]
  > = {};
  if (prescription) {
    for (const ex of prescription) {
      const rows = await getLastSetsForExercise(userId, ex.name);
      prevSetsByExercise[ex.name] = rows.map((r) => ({
        reps: r.reps,
        weightKg: r.weightKg,
      }));
    }
  }

  return (
    <>
      <LogSessionForm
        plannedSessionId={plannedSessionId}
        defaultDurationMinutes={durationMinutes}
        defaultRpeMin={rpeMin}
        defaultRpeMax={rpeMax}
        prescription={prescription}
        prevSetsByExercise={prevSetsByExercise}
      />
      <div className="flex justify-center">
        <SkipButton plannedSessionId={plannedSessionId} />
      </div>
    </>
  );
}
