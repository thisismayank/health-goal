"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Data-only match spec so server components can safely pass items
 * across the RSC boundary — functions aren't serializable, so we
 * describe the match rule declaratively and evaluate it here.
 *
 *   { exact: "/train" }
 *   { prefix: ["/plan/"], notPrefix: ["/plan/new", "/plan/upload"] }
 */
export type MatchSpec =
  | { exact: string }
  | { prefix: string[]; notPrefix?: string[] };

export type SubNavItem = {
  href: string;
  label: string;
  match?: MatchSpec;
};

function isActive(pathname: string, item: SubNavItem): boolean {
  const spec = item.match ?? { exact: item.href };
  if ("exact" in spec) return pathname === spec.exact;
  const hasPrefix = spec.prefix.some((p) => pathname.startsWith(p));
  if (!hasPrefix) return false;
  if (spec.notPrefix?.some((p) => pathname.startsWith(p))) return false;
  return true;
}

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
        const active = isActive(pathname, it);
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
