"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTrail } from "@/lib/actions";

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
