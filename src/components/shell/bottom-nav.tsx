"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart2,
  Home,
  CalendarDays,
  Mountain,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

type Tab = {
  href: string;
  label: string;
  Icon: LucideIcon;
  matches: (path: string) => boolean;
};

const TABS: Tab[] = [
  {
    href: "/",
    label: "Home",
    Icon: Home,
    matches: (p) => p === "/",
  },
  {
    href: "/train",
    label: "Plan",
    Icon: CalendarDays,
    matches: (p) =>
      p === "/train" ||
      p.startsWith("/train/") ||
      p === "/week" ||
      p === "/history" ||
      p.startsWith("/plan"),
  },
  {
    href: "/progress",
    label: "Progress",
    Icon: BarChart2,
    matches: (p) =>
      p === "/progress" ||
      p.startsWith("/progress/") ||
      p === "/character" ||
      p === "/body",
  },
  {
    href: "/trails",
    label: "Trails",
    Icon: Mountain,
    matches: (p) => p === "/trails" || p.startsWith("/trails/"),
  },
  {
    href: "/coach",
    label: "Coach",
    Icon: MessageSquare,
    matches: (p) => p === "/coach" || p.startsWith("/coach/"),
  },
];

// Settings kept off the bottom nav intentionally — it's reachable via
// the north-star bar's gear icon, and the coach warrants the fifth
// slot more (daily-use vs occasional).

export function BottomNav() {
  const pathname = usePathname();

  if (
    pathname === "/login" ||
    pathname === "/welcome" ||
    pathname.startsWith("/welcome/")
  ) {
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t border-blue-500/20 bg-background/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-2xl grid grid-cols-5">
        {TABS.map((t) => {
          const active = t.matches(pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center justify-center py-2.5 gap-0.5 transition ${
                active ? "text-blue-300" : "text-muted hover:text-foreground"
              }`}
            >
              <t.Icon
                size={20}
                strokeWidth={active ? 2 : 1.5}
                aria-hidden
              />
              <span
                className={`text-[10px] uppercase tracking-wider ${
                  active ? "font-medium" : ""
                }`}
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
