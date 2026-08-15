"use client";

import { useTransition } from "react";
import { reopenSession, skipSession } from "@/lib/actions";

export function SkipButton({ plannedSessionId }: { plannedSessionId: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => skipSession(plannedSessionId))}
      disabled={pending}
      className="text-sm text-muted hover:text-warn disabled:opacity-50"
    >
      {pending ? "…" : "Skip today"}
    </button>
  );
}

export function ReopenButton({ plannedSessionId }: { plannedSessionId: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => reopenSession(plannedSessionId))}
      disabled={pending}
      className="text-sm text-muted hover:text-foreground disabled:opacity-50"
    >
      {pending ? "…" : "Reopen"}
    </button>
  );
}
