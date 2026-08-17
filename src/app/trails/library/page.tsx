import Link from "next/link";
import { allTrails } from "@/lib/basecamp/trail-library";
import { requireOnboardedUser } from "@/lib/data";
import { TrailsSubNav } from "@/components/shell/trails-sub-nav";
import { pickUnits } from "@/lib/units";
import { LibrarySearch } from "./library-search";

export const dynamic = "force-dynamic";

/**
 * Full preset library browser — moved out of the /trails landing
 * because embedding it there created a nested scroll container
 * (mobile anti-pattern) that pushed the user's own saved trails
 * below the fold.
 *
 * Server-side: pass the raw list once. The client component owns
 * the search input + filter chips + rendering. Full page-height
 * scroll — no inner scroller.
 */
export default async function LibraryPage() {
  const user = await requireOnboardedUser();
  const units = pickUnits(user);
  const trails = allTrails();

  return (
    <div className="space-y-4">
      <TrailsSubNav />
      <section>
        <h1 className="text-2xl font-semibold">Trail library</h1>
        <p className="text-sm text-muted mt-1">
          {trails.length} curated presets. Sourced from NPS.gov, Wikipedia
          (CC-BY-SA), USGS, and guidebook consensus. For a fit-ranked
          view of a specific region, use{" "}
          <Link
            href="/trails/discover"
            className="text-blue-300 hover:underline"
          >
            Discover
          </Link>
          .
        </p>
      </section>

      <LibrarySearch trails={trails} units={units} />
    </div>
  );
}
