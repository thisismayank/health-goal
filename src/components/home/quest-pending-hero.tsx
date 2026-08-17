import { getLastSetsForExercise } from "@/lib/data";
import { LogSessionForm } from "@/components/log-session-form";
import { ReopenButton } from "@/components/session-actions";
import { LogPanel } from "@/components/home/log-panel";
import { PlannedDetails } from "@/components/plan/planned-details";
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

// Coarse family classification for chip color. Keep it visual — the
// exact category is already in the sub-label text.
type CategoryFamily = "aerobic" | "mountain" | "strength" | "recovery";

function familyFor(category: string): CategoryFamily {
  if (
    ["STAIRMASTER", "INCLINE_TREADMILL", "OUTDOOR_HIKE", "LOADED_HIKE", "LONG_MOUNTAIN_SESSION"].includes(
      category,
    )
  )
    return "mountain";
  if (["EASY_RUN", "QUALITY_RUN", "ZONE2_CARDIO"].includes(category))
    return "aerobic";
  if (
    ["UPPER_STRENGTH", "LOWER_STRENGTH", "FULL_BODY_STRENGTH", "MOUNTAIN_LEGS"].includes(
      category,
    )
  )
    return "strength";
  return "recovery";
}

const FAMILY_STYLE: Record<CategoryFamily, string> = {
  aerobic: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  mountain: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  strength: "bg-red-500/15 text-red-300 border-red-500/30",
  recovery: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

const FAMILY_GLYPH: Record<CategoryFamily, string> = {
  aerobic: "◐",
  mountain: "▲",
  strength: "▮",
  recovery: "◇",
};

export async function QuestPendingHero({
  session,
  userId,
}: {
  session: PlannedSession;
  userId: number;
}) {
  const prescription = safeParsePrescription(session.strengthPrescription);
  const family = familyFor(session.sessionCategory);
  const isSkipped = session.status === "skipped";

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-blue-500/30 bg-blue-950/10 shadow-lg shadow-blue-500/10 p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
                {isSkipped ? "[QUEST · SKIPPED]" : "[TODAY'S QUEST]"}
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${FAMILY_STYLE[family]}`}
              >
                <span className="text-[9px] leading-none">
                  {FAMILY_GLYPH[family]}
                </span>
                {session.sessionCategory.replaceAll("_", " ").toLowerCase()}
              </span>
            </div>
            <h2 className="text-xl font-semibold mt-2 leading-tight">
              {session.title}
            </h2>
          </div>
        </div>

        <MetricChips session={session} />

        <PlannedDetails session={session} />
      </section>

      {isSkipped ? (
        <div className="rounded-lg border border-panel-border bg-panel p-4 flex items-center justify-between">
          <span className="text-warn text-sm">Skipped today.</span>
          <ReopenButton plannedSessionId={session.id} />
        </div>
      ) : (
        <LogPanel plannedSessionId={session.id}>
          <PlannedFormWrap
            plannedSessionId={session.id}
            durationMinutes={session.targetDurationMinutes}
            rpeMin={session.targetRpeMin}
            rpeMax={session.targetRpeMax}
            prescription={prescription}
            userId={userId}
          />
        </LogPanel>
      )}
    </div>
  );
}

function MetricChips({ session }: { session: PlannedSession }) {
  const chips: { label: string; value: string; unit?: string }[] = [];
  if (session.targetDurationMinutes != null) {
    chips.push({ label: "Duration", value: `${session.targetDurationMinutes}`, unit: "min" });
  }
  if (session.targetRpeMin != null && session.targetRpeMax != null) {
    chips.push({
      label: "RPE",
      value:
        session.targetRpeMin === session.targetRpeMax
          ? `${session.targetRpeMin}`
          : `${session.targetRpeMin}–${session.targetRpeMax}`,
    });
  }
  if (session.targetElevationGainFt != null) {
    chips.push({ label: "Vertical", value: `+${session.targetElevationGainFt}`, unit: "ft" });
  }
  if (session.targetPackWeightLb != null) {
    chips.push({ label: "Pack", value: `${session.targetPackWeightLb}`, unit: "lb" });
  }
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {chips.map((c) => (
        <div key={c.label} className="flex items-baseline gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted">
            {c.label}
          </span>
          <span className="text-sm font-mono font-medium tabular-nums">
            {c.value}
          </span>
          {c.unit && <span className="text-[10px] text-muted">{c.unit}</span>}
        </div>
      ))}
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
    <LogSessionForm
      plannedSessionId={plannedSessionId}
      defaultDurationMinutes={durationMinutes}
      defaultRpeMin={rpeMin}
      defaultRpeMax={rpeMax}
      prescription={prescription}
      prevSetsByExercise={prevSetsByExercise}
    />
  );
}
