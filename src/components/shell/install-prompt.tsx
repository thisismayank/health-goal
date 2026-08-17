"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "basecamp:installPromptDismissedAt";
const DISMISS_TTL_DAYS = 14;

type Platform = "ios" | "android_chrome" | "desktop" | "other";

// Chrome's beforeinstallprompt event (not in default DOM lib types).
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "other";
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  if (isIOS) return "ios";
  const isAndroid = /Android/.test(ua);
  if (isAndroid) return "android_chrome";
  if (/Macintosh|Windows|Linux/.test(ua)) return "desktop";
  return "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // Chrome / Android
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS
  return (
    "standalone" in window.navigator &&
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function wasRecentlyDismissed(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at)) return false;
  const daysAgo = (Date.now() - at) / (1000 * 60 * 60 * 24);
  return daysAgo < DISMISS_TTL_DAYS;
}

/**
 * Sticky install nudger. Auto-hidden when:
 *   - already installed (standalone mode)
 *   - user dismissed in the last 14 days
 *   - on /login or /welcome (chromeless routes shouldn't nag)
 *
 * On Chrome/Edge/Android — hooks beforeinstallprompt and offers a
 * one-tap Install button.
 * On iOS Safari — shows Add-to-Home-Screen instructions (Share → Add).
 * Elsewhere — hidden.
 */
export function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [installed, setInstalled] = useState(true);
  const [dismissed, setDismissed] = useState(true);
  const [chromePromptEvent, setChromePromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [pathname, setPathname] = useState<string>("/");

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());
    setDismissed(wasRecentlyDismissed());
    setPathname(window.location.pathname);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setChromePromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const install = async () => {
    if (!chromePromptEvent) return;
    await chromePromptEvent.prompt();
    try {
      const choice = await chromePromptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
      }
    } finally {
      setChromePromptEvent(null);
    }
  };

  const hiddenRoute =
    pathname === "/login" ||
    pathname === "/welcome" ||
    pathname.startsWith("/welcome/");
  if (installed || dismissed || hiddenRoute) return null;

  // Chrome / Android: only show when the browser has fired
  // beforeinstallprompt (means all install criteria are satisfied).
  if (
    (platform === "android_chrome" || platform === "desktop") &&
    chromePromptEvent
  ) {
    return (
      <Shell onDismiss={dismiss}>
        <div className="text-sm">
          <span className="font-medium">Install Basecamp</span> for faster
          launches + a proper home-screen icon.
        </div>
        <button
          type="button"
          onClick={install}
          className="rounded-md bg-accent-strong text-background font-medium text-xs px-3 py-1.5 hover:bg-accent transition"
        >
          Install →
        </button>
      </Shell>
    );
  }

  // iOS: manual add-to-home-screen. All iOS browsers (Chrome, Firefox,
  // Edge) share the same WebKit + share-sheet path, so one message
  // covers all of them.
  if (platform === "ios") {
    return (
      <Shell onDismiss={dismiss}>
        <div className="text-xs leading-relaxed">
          <span className="font-medium">Install Basecamp:</span> tap the Share
          button{" "}
          <span className="inline-block text-blue-300">
            {shareGlyph()}
          </span>{" "}
          → <span className="text-blue-300">Add to Home Screen</span>.
          <span className="text-muted"> (Safari, Chrome, or any browser.)</span>
        </div>
      </Shell>
    );
  }

  // Android Chrome without a beforeinstallprompt event (user visited
  // before + dismissed, or Chromium variant that doesn't fire it):
  // give explicit menu instructions.
  if (platform === "android_chrome") {
    return (
      <Shell onDismiss={dismiss}>
        <div className="text-xs leading-relaxed">
          <span className="font-medium">Install Basecamp:</span> tap{" "}
          <span className="text-blue-300">⋮</span> (top-right) →{" "}
          <span className="text-blue-300">Install app</span> or{" "}
          <span className="text-blue-300">Add to Home Screen</span>.
        </div>
      </Shell>
    );
  }

  // Desktop Chrome/Edge without beforeinstallprompt: point at the
  // address-bar install icon or the three-dot menu.
  if (platform === "desktop") {
    return (
      <Shell onDismiss={dismiss}>
        <div className="text-xs leading-relaxed">
          <span className="font-medium">Install Basecamp:</span> click the
          install icon{" "}
          <span className="text-blue-300">⊕</span> in the address bar, or{" "}
          <span className="text-blue-300">⋮</span> →{" "}
          <span className="text-blue-300">Install Basecamp</span> (Chrome / Edge).
        </div>
      </Shell>
    );
  }

  return null;
}

function Shell({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed left-0 right-0 z-40 px-3"
      style={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-md rounded-lg border border-blue-500/40 bg-blue-950/60 backdrop-blur px-4 py-3 shadow-xl shadow-blue-500/10 flex items-center gap-3">
        <div className="flex-1 min-w-0">{children}</div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss install prompt"
          className="text-muted hover:text-foreground text-lg leading-none shrink-0"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function shareGlyph() {
  // Simple inline SVG that resembles iOS's share icon (square with up-arrow).
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "text-bottom" }}
    >
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M20 15v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4" />
    </svg>
  );
}
