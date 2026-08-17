import { SubNav } from "./sub-nav";

/**
 * Sub-nav for the Trails tab. Static — the sibling pages are known
 * ahead of time. Match rules are declarative (see MatchSpec in
 * sub-nav.tsx) so they can safely cross the RSC boundary.
 */
export function TrailsSubNav() {
  // Backfill was previously a top-level tab. Devin r3 IA read: it's a
  // one-time setup task occupying permanent navigation. Moved to a
  // link on the /trails landing page instead — still discoverable,
  // no longer taking a slot that repeat visitors don't need.
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
      ]}
    />
  );
}
