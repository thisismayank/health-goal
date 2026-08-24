"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logInjury, resolveInjury } from "@/lib/actions";

type Region = "knee" | "back" | "ankle" | "hip" | "shoulder" | "other";
type Severity = "light" | "moderate" | "recovering";

type Injury = {
  id: number;
  region: Region;
  severity: Severity;
  notes: string | null;
  startDate: string;
};

/**
 * Active-injuries panel on /body. Two roles:
 *   - Log a new injury (region + severity + optional notes).
 *   - Resolve an existing one (marks endDate = today).
 *
 * Coach picks these up automatically (see coach-context.ts) and
 * per-session adaptation runs off the same rows.
 */
export function InjuryPanel({ injuries }: { injuries: Injury[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState<Region>("knee");
  const [severity, setSeverity] = useState<Severity>("light");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await logInjury({
          region,
          severity,
          notes: notes.trim() || undefined,
        });
        setOpen(false);
        setNotes("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  const resolve = (id: number) => {
    startTransition(async () => {
      await resolveInjury(id);
      router.refresh();
    });
  };

  return (
    <section className="rounded-lg border border-panel-border bg-panel p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs uppercase tracking-widest text-muted">
          Active injuries
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs text-blue-300 hover:text-blue-200"
          >
            + Log injury
          </button>
        )}
      </div>

      {injuries.length === 0 && !open && (
        <p className="text-xs text-muted">
          None. Log an injury and the plan will adapt — sessions that
          would aggravate it get swapped or downgraded, and the coach
          adjusts its recommendations.
        </p>
      )}

      {injuries.length > 0 && (
        <ul className="space-y-2">
          {injuries.map((i) => (
            <li
              key={i.id}
              className="flex items-baseline justify-between gap-3 rounded-md border border-warn/30 bg-warn/5 px-3 py-2"
            >
              <div className="text-xs">
                <span className="font-medium capitalize text-foreground">
                  {i.region}
                </span>
                <span className="text-warn"> · {i.severity}</span>
                <span className="text-muted"> · since {i.startDate}</span>
                {i.notes && (
                  <div className="text-muted italic mt-0.5">{i.notes}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => resolve(i.id)}
                disabled={pending}
                className="text-[10px] uppercase tracking-wider text-muted hover:text-accent underline underline-offset-4 disabled:opacity-50"
              >
                resolved
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <form onSubmit={submit} className="space-y-3 pt-2 border-t border-panel-border">
          <ChipRow
            label="Where?"
            value={region}
            onChange={setRegion}
            options={[
              ["knee", "Knee"],
              ["back", "Back"],
              ["ankle", "Ankle"],
              ["hip", "Hip"],
              ["shoulder", "Shoulder"],
              ["other", "Other"],
            ]}
          />
          <ChipRow
            label="How bad?"
            value={severity}
            onChange={setSeverity}
            options={[
              ["light", "Light — dial it back"],
              ["moderate", "Moderate — swap the session"],
              ["recovering", "Recovering — skip anything conflicting"],
            ]}
          />
          <label className="block text-xs space-y-1">
            <span className="text-muted">Notes (optional)</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
              placeholder="MCL sprain, right side"
              className="w-full rounded-md bg-background border border-panel-border px-2 py-1.5 text-sm focus:border-blue-500/50 focus:outline-none"
            />
          </label>
          {error && (
            <p className="text-xs text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-accent-strong hover:bg-accent text-background font-medium text-xs px-3 py-1.5 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Log injury"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="text-xs text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function ChipRow<V extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: V;
  onChange: (v: V) => void;
  options: [V, string][];
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`text-xs px-2.5 py-1 rounded-full border transition ${
              value === v
                ? "border-blue-500/60 bg-blue-500/15 text-blue-200"
                : "border-panel-border bg-panel text-muted hover:text-foreground hover:border-blue-500/40"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
