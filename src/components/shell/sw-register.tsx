"use client";

import { useEffect } from "react";

/**
 * Registers the push service worker on mount so opting into
 * notifications from /settings is instant instead of "download +
 * install + subscribe". Silent on browsers without SW support (older
 * Safari, private windows) — those users just don't get push.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silent — SW registration failures shouldn't surface to users.
      // If push doesn't work, the settings toggle will report it.
    });
  }, []);
  return null;
}
