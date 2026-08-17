import { SubNav } from "./sub-nav";

/**
 * Sub-nav for the Trails tab. Stays static — the sibling pages are
 * all discoverable and known ahead of time.
 */
export function TrailsSubNav() {
  return (
    <SubNav
      items={[
        {
          href: "/trails",
          label: "Your trails",
          matches: (p) =>
            p === "/trails" ||
            (p.startsWith("/trails/") &&
              !p.startsWith("/trails/preset") &&
              !p.startsWith("/trails/discover") &&
              !p.startsWith("/trails/backfill") &&
              !p.startsWith("/trails/link")),
        },
        {
          href: "/trails/discover",
          label: "Discover",
          matches: (p) => p.startsWith("/trails/discover"),
        },
        {
          href: "/trails/backfill",
          label: "Backfill",
          matches: (p) => p.startsWith("/trails/backfill"),
        },
      ]}
    />
  );
}
