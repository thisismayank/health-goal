"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Today" },
  { href: "/week", label: "Week" },
  { href: "/body", label: "Body" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <>
      <header className="border-b border-panel-border bg-panel/60 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tracking-wide">RAINIER</span>
            <span className="text-xs text-muted uppercase tracking-widest">
              Companion
            </span>
          </Link>
          <nav className="hidden sm:flex gap-1 text-sm">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded px-3 py-1.5 transition ${
                  pathname === t.href
                    ? "bg-panel-border text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <nav className="fixed bottom-0 inset-x-0 sm:hidden bg-panel/95 backdrop-blur border-t border-panel-border z-50">
        <div className="mx-auto max-w-2xl grid grid-cols-3">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center justify-center py-3 text-xs ${
                pathname === t.href ? "text-accent" : "text-muted"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
