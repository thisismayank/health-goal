"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setNotificationPreference } from "@/lib/actions";

export function NotificationToggle({
  kind,
  label,
  description,
  initialEnabled,
}: {
  kind: string;
  label: string;
  description: string;
  initialEnabled: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      try {
        await setNotificationPreference({ kind, emailEnabled: next });
        router.refresh();
      } catch {
        setEnabled(!next);
      }
    });
  };

  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted mt-0.5">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={pending}
        onClick={toggle}
        className={`relative shrink-0 mt-1 h-6 w-11 rounded-full transition ${
          enabled ? "bg-accent-strong" : "bg-panel-border"
        } disabled:opacity-50`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${
            enabled ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
