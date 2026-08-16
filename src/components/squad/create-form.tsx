"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSquad } from "@/lib/actions";

export function CreateSquadForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-blue-500/40 bg-blue-950/20 text-blue-300 font-medium px-4 py-3 hover:border-blue-400 hover:bg-blue-950/30 transition"
      >
        + Create a squad
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            const res = await createSquad({ name });
            router.push(`/squad/${res.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create");
          }
        });
      }}
      className="rounded-md border border-blue-500/40 bg-blue-950/10 p-4 space-y-3"
    >
      <label className="block space-y-1">
        <span className="text-[10px] uppercase tracking-widest text-blue-300">
          Squad name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={60}
          placeholder="e.g. Weekend Warriors, Kili 2026"
          className="w-full rounded-md bg-panel border border-panel-border px-3 py-2 text-sm"
        />
      </label>
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setName("");
            setError(null);
          }}
          disabled={pending}
          className="rounded-md border border-panel-border px-3 py-2 text-sm text-muted hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-md bg-accent-strong text-background font-medium px-4 py-2 text-sm hover:bg-accent transition disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create squad"}
        </button>
      </div>
    </form>
  );
}
