import type { PlannedSession } from "@/db/schema";

type Prescription = { name: string; sets: number; reps: string }[];

function parsePrescription(json: string | null): Prescription | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    return parsed as Prescription;
  } catch {
    return null;
  }
}

/**
 * Collapsible "what's in this workout" block. Renders warm-up / main /
 * cool-down text plus the prescribed sets table. Shared by /train and
 * the home Today's Quest hero so both surfaces show the same detail.
 *
 * `variant` controls container styling — the /train row uses an inset
 * to align with the day column; hero-embedded flush-fills its parent.
 */
export function PlannedDetails({
  session,
  variant = "flush",
}: {
  session: PlannedSession;
  variant?: "flush" | "inset";
}) {
  const prescription = parsePrescription(session.strengthPrescription);
  const hasContent =
    !!session.instructions ||
    (prescription != null && prescription.length > 0);
  if (!hasContent) return null;

  const outerCls =
    variant === "inset"
      ? "ml-[calc(3.5rem+1rem)] group rounded-md border border-panel-border bg-background/30 open:bg-background/40"
      : "group rounded-md border border-panel-border bg-background/30 open:bg-background/40";

  return (
    <details className={outerCls}>
      <summary className="cursor-pointer select-none px-3 py-2 text-xs text-blue-300 hover:text-blue-200 flex items-center gap-2">
        <span className="inline-block transition-transform group-open:rotate-90 text-[10px]">
          ▸
        </span>
        What&apos;s in this workout
      </summary>
      <div className="px-3 pb-3 pt-1 space-y-3">
        {session.instructions && (
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
            {session.instructions}
          </p>
        )}
        {prescription && prescription.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted">
              Prescribed sets
            </div>
            <div className="rounded-md border border-panel-border bg-panel/60 divide-y divide-panel-border">
              {prescription.map((p, i) => (
                <div
                  key={i}
                  className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-xs"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted tabular-nums">
                    {p.sets} × {p.reps}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
