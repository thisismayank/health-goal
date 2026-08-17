import { getActivePlan } from "@/lib/data";
import { requireCurrentUser } from "@/lib/data";
import { SubNav } from "./sub-nav";

/**
 * Sub-nav for the Plan tab. Server component so it can look up the
 * user's active plan id and link 'Full plan' at the right route.
 * Keeps the sibling routes (This week / Full plan / History / New)
 * one tap away from any of them.
 */
export async function PlanSubNav() {
  const user = await requireCurrentUser();
  const plan = await getActivePlan(user.id);

  const items = [
    {
      href: "/train",
      label: "This week",
      matches: (p: string) => p === "/train",
    },
    ...(plan
      ? [
          {
            href: `/plan/${plan.id}`,
            label: "Full plan",
            matches: (p: string) =>
              p.startsWith(`/plan/${plan.id}`) && !p.startsWith("/plan/new"),
          },
        ]
      : []),
    {
      href: "/history",
      label: "History",
      matches: (p: string) => p === "/history",
    },
    {
      href: "/plan/new",
      label: "New plan",
      matches: (p: string) =>
        p === "/plan/new" || p === "/plan/upload",
    },
  ];
  return <SubNav items={items} />;
}
