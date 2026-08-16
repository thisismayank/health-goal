"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  glyph: string;
  matches: (path: string) => boolean;
};

const TABS: Tab[] = [
  {
    href: "/",
    label: "Home",
    glyph: "◈",
    matches: (p) => p === "/",
  },
  {
    href: "/train",
    label: "Train",
    glyph: "▲",
    matches: (p) => p === "/train" || p.startsWith("/train/") || p === "/week" || p === "/history",
  },
  {
    href: "/progress",
    label: "Progress",
    glyph: "◉",
    matches: (p) =>
      p === "/progress" ||
      p.startsWith("/progress/") ||
      p === "/character" ||
      p === "/body",
  },
  {
    href: "/trails",
    label: "Trails",
    glyph: "⛰",
    matches: (p) => p === "/trails" || p.startsWith("/trails/"),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  // Hide the shell on auth pages so they feel like their own thing.
  if (pathname === "/login" || pathname === "/welcome" || pathname.startsWith("/welcome/")) {
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t border-blue-500/20 bg-background/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-2xl grid grid-cols-4">
        {TABS.map((t) => {
          const active = t.matches(pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center justify-center py-2.5 gap-0.5 transition ${
                active
                  ? "text-blue-300"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <span
                className={`text-lg leading-none ${active ? "text-blue-300" : "text-muted"}`}
              >
                {t.glyph}
              </span>
              <span
                className={`text-[10px] uppercase tracking-wider ${active ? "font-medium" : ""}`}
              >
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
