"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTrail, setPrimaryTrail, unsetPrimaryTrail } from "@/lib/actions";

export function TrailDeleteButton({ trailId }: { trailId: number }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onClick = () => {
    if (!confirm("Delete this trail?")) return;
    startTransition(async () => {
      await deleteTrail(trailId);
      router.push("/trails");
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-xs text-muted hover:text-danger disabled:opacity-50"
    >
      {pending ? "…" : "Delete trail"}
    </button>
  );
}

export function PrimaryGoalButton({
  trailId,
  isPrimary,
}: {
  trailId: number;
  isPrimary: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onClick = () => {
    startTransition(async () => {
      if (isPrimary) {
        await unsetPrimaryTrail(trailId);
      } else {
        await setPrimaryTrail(trailId);
      }
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`rounded-md px-3 py-1.5 text-xs font-mono uppercase tracking-widest disabled:opacity-50 ${
        isPrimary
          ? "border border-blue-400/60 bg-blue-500/20 text-blue-200 hover:bg-blue-500/30"
          : "border border-panel-border hover:border-blue-500/40 text-muted hover:text-blue-300"
      }`}
    >
      {pending ? "…" : isPrimary ? "★ Primary goal" : "☆ Set as primary goal"}
    </button>
  );
}
