"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadPlan } from "@/lib/actions";
import type { PlanGoalType } from "@/db/schema";

export function UploadPlanForm({
  goalOptions,
  exampleJson,
}: {
  goalOptions: { value: PlanGoalType; label: string }[];
  exampleJson: string;
}) {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    startTransition(async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        setError("Invalid JSON — check for trailing commas or missing quotes.");
        return;
      }
      const shape = coerce(parsed);
      if ("error" in shape) {
        setError(shape.error);
        return;
      }
      try {
        const r = await uploadPlan(shape.value);
        setOk(`Imported — ${r.sessions} sessions saved as your active plan.`);
        setTimeout(() => router.push("/train"), 800);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  };

  const fillExample = () => setRaw(exampleJson);

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-[10px] font-mono uppercase tracking-widest text-muted">
          Paste plan JSON
        </label>
        <button
          type="button"
          onClick={fillExample}
          className="text-xs text-blue-300 hover:underline"
        >
          Load example →
        </button>
      </div>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={16}
        spellCheck={false}
        placeholder='{ "name": "...", "goalType": "...", "sessions": [...] }'
        className="w-full rounded-md bg-background border border-panel-border px-3 py-2 text-xs font-mono focus:border-blue-500/50 focus:outline-none"
      />

      <details className="text-xs">
        <summary className="cursor-pointer text-blue-300 hover:underline">
          Allowed goal types
        </summary>
        <ul className="mt-2 space-y-0.5 text-muted">
          {goalOptions.map((g) => (
            <li key={g.value}>
              <code className="text-blue-300">{g.value}</code> — {g.label}
            </li>
          ))}
        </ul>
      </details>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {ok && <p className="text-sm text-accent">{ok}</p>}

      <button
        type="submit"
        disabled={pending || !raw.trim()}
        className="rounded-md bg-accent-strong hover:bg-accent text-background font-medium text-sm px-4 py-2 disabled:opacity-50"
      >
        {pending ? "Validating…" : "Import plan →"}
      </button>
    </form>
  );
}

// Client-side shape check so we get a friendly error before hitting
// the server. Server-side validation in uploadPlan is the source of
// truth for the DB write.
function coerce(
  input: unknown,
):
  | { value: Parameters<typeof uploadPlan>[0] }
  | { error: string } {
  if (!input || typeof input !== "object") return { error: "Root must be an object" };
  const o = input as Record<string, unknown>;
  if (typeof o.name !== "string" || !o.name)
    return { error: "'name' (string) is required" };
  if (typeof o.goalType !== "string")
    return { error: "'goalType' (string) is required" };
  if (!Array.isArray(o.sessions) || o.sessions.length === 0)
    return { error: "'sessions' (non-empty array) is required" };

  return {
    value: {
      name: o.name,
      goalType: o.goalType as PlanGoalType,
      goalEvent: typeof o.goalEvent === "string" ? o.goalEvent : undefined,
      sessions: o.sessions as Parameters<typeof uploadPlan>[0]["sessions"],
    },
  };
}
