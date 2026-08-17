"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SubNavItem = {
  href: string;
  label: string;
  matches?: (path: string) => boolean; // default: exact match
};

/**
 * Segmented sub-nav for pages that have sibling routes. Keeps the
 * layout consistent (thin pill row under the page header) so users
 * always know where they can jump next without opening a menu.
 */
export function SubNav({ items }: { items: SubNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 py-1 no-scrollbar">
      {items.map((it) => {
        const active = it.matches ? it.matches(pathname) : pathname === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition ${
              active
                ? "bg-blue-500/20 text-blue-200 border border-blue-500/40"
                : "text-muted border border-panel-border hover:text-foreground hover:border-blue-500/30"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
