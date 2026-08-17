"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setHomeBase } from "@/lib/actions";

/**
 * Home-base input for the "Ready near me" trail filter.
 *
 * Accepts a city ("Manhattan, NY") which we geocode via Nominatim,
 * OR a "lat, lng" paste for users who prefer to be precise. Empty
 * submit clears the value.
 */
export function HomeBaseForm({
  initialLabel,
  initialLat,
  initialLng,
}: {
  initialLabel: string | null;
  initialLat: number | null;
  initialLng: number | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState<string>(initialLabel ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saved">("idle");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await setHomeBase({ query });
      if (res.ok) {
        setStatus("saved");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <label className="block text-xs text-muted" htmlFor="home-base">
        Home base — city, or a &quot;lat, lng&quot; paste
      </label>
      <div className="flex items-stretch gap-2">
        <input
          id="home-base"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setStatus("idle");
          }}
          placeholder="Manhattan, NY"
          className="flex-1 rounded-md bg-background border border-panel-border px-3 py-2 text-sm focus:border-blue-500/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent-strong hover:bg-accent text-background font-medium text-sm px-3 py-2 disabled:opacity-50"
        >
          {pending ? "…" : "Save"}
        </button>
      </div>
      {initialLat != null && initialLng != null && (
        <p className="text-[11px] text-muted">
          Currently: {initialLat.toFixed(3)}, {initialLng.toFixed(3)}. Clear
          the field and save to remove.
        </p>
      )}
      {error && (
        <p className="text-[11px] text-danger" role="alert">
          {error}
        </p>
      )}
      {status === "saved" && !error && (
        <p className="text-[11px] text-accent" role="status">
          Saved.
        </p>
      )}
    </form>
  );
}
