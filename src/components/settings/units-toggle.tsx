"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUnitsPreference } from "@/lib/actions";

export function UnitsToggle({ initial }: { initial: "imperial" | "metric" }) {
  const router = useRouter();
  const [units, setUnits] = useState<"imperial" | "metric">(initial);
  const [pending, startTransition] = useTransition();

  const pick = (next: "imperial" | "metric") => {
    if (next === units) return;
    setUnits(next);
    startTransition(async () => {
      await setUnitsPreference(next);
      router.refresh();
    });
  };

  return (
    <div className="inline-flex rounded-md border border-panel-border overflow-hidden">
      <button
        type="button"
        onClick={() => pick("imperial")}
        disabled={pending}
        className={`px-3 py-1.5 text-xs font-medium transition ${
          units === "imperial"
            ? "bg-blue-500/20 text-blue-200"
            : "bg-panel text-muted hover:text-foreground"
        } disabled:opacity-50`}
      >
        Imperial
        <span className="text-[10px] text-muted ml-1">ft · lb · mi</span>
      </button>
      <button
        type="button"
        onClick={() => pick("metric")}
        disabled={pending}
        className={`px-3 py-1.5 text-xs font-medium transition ${
          units === "metric"
            ? "bg-blue-500/20 text-blue-200"
            : "bg-panel text-muted hover:text-foreground"
        } disabled:opacity-50`}
      >
        Metric
        <span className="text-[10px] text-muted ml-1">m · kg · km</span>
      </button>
    </div>
  );
}
