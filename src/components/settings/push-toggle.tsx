"use client";

import { useEffect, useState, useTransition } from "react";

// Browser API for asking permission + subscribing. Basecamp's push
// subscription is per-device (each browser you install the PWA on
// needs its own).
export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(s);
    if (!s) return;
    setPermission(Notification.permission);
    checkExisting().then(setSubscribed).catch(() => setSubscribed(false));
  }, []);

  async function checkExisting(): Promise<boolean> {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  }

  async function subscribe() {
    setError(null);
    if (!vapidPublicKey) {
      setError("Push isn't configured on the server yet (missing VAPID key).");
      return;
    }
    startTransition(async () => {
      try {
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== "granted") {
          setError("Permission denied. Enable notifications in your browser.");
          return;
        }
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            .buffer as ArrayBuffer,
        });
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });
        if (!res.ok) throw new Error(`server ${res.status}`);
        setSubscribed(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to subscribe");
      }
    });
  }

  async function unsubscribe() {
    setError(null);
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          setSubscribed(false);
          return;
        }
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint }),
          });
        }
        setSubscribed(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to unsubscribe");
      }
    });
  }

  if (!supported) {
    return (
      <p className="text-xs text-muted italic">
        Push notifications aren't supported in this browser. On iPhone,
        install Basecamp to your Home Screen first (Share → Add to Home
        Screen), then open the installed app.
      </p>
    );
  }

  if (permission === "denied") {
    return (
      <p className="text-xs text-warn">
        Notifications blocked by your browser. Enable them in browser
        settings for basecamp, then reload this page.
      </p>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">Push notifications on this device</div>
        <div className="text-xs text-muted mt-0.5">
          Instant pings for trip-week reminders, squad activity, and class-up
          moments. Per-device — enable on every browser you want push on.
        </div>
        {error && (
          <p className="text-xs text-danger mt-1" role="alert">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={subscribed ? unsubscribe : subscribe}
        disabled={pending}
        className={`shrink-0 rounded-md px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${
          subscribed
            ? "border border-panel-border text-muted hover:text-foreground"
            : "bg-accent-strong text-background hover:bg-accent"
        }`}
      >
        {pending ? "…" : subscribed ? "Turn off" : "Enable push"}
      </button>
    </div>
  );
}

// VAPID public keys are base64url-encoded, but PushSubscription wants a
// Uint8Array. Convert.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
