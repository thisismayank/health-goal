import { SubNav } from "./sub-nav";

/**
 * Sub-nav for the Trails tab. Static — the sibling pages are known
 * ahead of time. Match rules are declarative (see MatchSpec in
 * sub-nav.tsx) so they can safely cross the RSC boundary.
 */
export function TrailsSubNav() {
  return (
    <SubNav
      items={[
        {
          href: "/trails",
          label: "Your trails",
          match: {
            prefix: ["/trails"],
            notPrefix: [
              "/trails/preset",
              "/trails/discover",
              "/trails/backfill",
              "/trails/link",
              "/trails/library",
            ],
          },
        },
        {
          href: "/trails/discover",
          label: "Discover",
          match: { prefix: ["/trails/discover"] },
        },
        {
          href: "/trails/library",
          label: "Library",
          match: { prefix: ["/trails/library", "/trails/preset"] },
        },
        {
          href: "/trails/backfill",
          label: "Backfill",
          match: { prefix: ["/trails/backfill"] },
        },
      ]}
    />
  );
}
