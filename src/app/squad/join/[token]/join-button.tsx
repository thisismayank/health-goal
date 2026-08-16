"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { joinSquadByToken } from "@/lib/actions";

export function JoinSquadButton({
  token,
  squadName,
}: {
  token: string;
  squadName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              const res = await joinSquadByToken(token);
              router.replace(`/squad/${res.id}`);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to join");
            }
          })
        }
        className="w-full rounded-md bg-accent-strong text-background font-medium px-6 py-3 hover:bg-accent transition disabled:opacity-50"
      >
        {pending ? "Joining…" : `Join ${squadName} →`}
      </button>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <Link
        href="/"
        className="text-xs text-muted hover:text-foreground inline-block"
      >
        Not now
      </Link>
    </div>
  );
}
