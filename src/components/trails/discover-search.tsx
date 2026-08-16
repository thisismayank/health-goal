"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function DiscoverSearch({
  initialQuery = "",
  autoFocus = true,
}: {
  initialQuery?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [pending, startTransition] = useTransition();

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const clean = q.trim();
    startTransition(() => {
      const target = clean
        ? `/trails/discover?q=${encodeURIComponent(clean)}`
        : `/trails/discover`;
      router.push(target);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus={autoFocus}
          placeholder="Where are you going? e.g. Rainier NP, Zion, Nepal…"
          className="flex-1 rounded-md bg-panel border border-panel-border px-3 py-2.5 text-base placeholder:text-muted focus:border-blue-500/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent-strong text-background font-medium px-4 py-2.5 hover:bg-accent transition disabled:opacity-50"
        >
          {pending ? "…" : "Find →"}
        </button>
      </div>
    </form>
  );
}
