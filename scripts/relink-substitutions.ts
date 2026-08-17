/**
 * One-off: after landing the substitution engine, re-scan every user's
 * plan and pull in orphan workouts that now qualify under the widened
 * physio-equivalence rule.
 *
 * Non-destructive: only assigns plannedSessionId to workouts that
 * currently have none. Never overwrites a manual link.
 */

import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { userProfile } from "../src/db/schema";
import { relinkOrphanWorkouts } from "../src/lib/plan/relink";

async function main() {
  const users = await db.select({ id: userProfile.id, email: userProfile.email }).from(userProfile);
  for (const u of users) {
    const r = await relinkOrphanWorkouts(u.id);
    if (r.linked > 0) {
      console.log(
        `[${u.email}] linked ${r.linked} of ${r.scanned} (was orphan: ${r.noPlannedOnDate}, incompatible: ${r.incompatible})`,
      );
    }
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
