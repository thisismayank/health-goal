import { getActivePlan, requireCurrentUser } from "@/lib/data";
import { SubNav } from "./sub-nav";

/**
 * Sub-nav for the Plan tab. Server component — looks up the user's
 * active plan id so 'Full plan' points at the right route. Match
 * rules are declarative (see MatchSpec in sub-nav.tsx) so we can
 * safely serialize them across the RSC boundary.
 */
export async function PlanSubNav() {
  const user = await requireCurrentUser();
  const plan = await getActivePlan(user.id);

  const items = [
    { href: "/train", label: "This week", match: { exact: "/train" as const } },
    ...(plan
      ? [
          {
            href: `/plan/${plan.id}`,
            label: "Full plan",
            match: {
              prefix: [`/plan/${plan.id}`],
              notPrefix: ["/plan/new", "/plan/upload"],
            },
          },
        ]
      : []),
    { href: "/history", label: "History", match: { exact: "/history" as const } },
    {
      href: "/plan/new",
      label: "New plan",
      match: { prefix: ["/plan/new", "/plan/upload"] },
    },
  ];
  return <SubNav items={items} />;
}
