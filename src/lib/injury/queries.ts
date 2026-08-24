import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { injury } from "@/db/schema";
import type { ActiveInjury } from "@/lib/plan/injury-adaptation";

/**
 * Active = endDate is null. Ordered by startDate desc so the most
 * recent shows first in the settings list.
 */
export async function activeInjuries(userId: number): Promise<
  Array<ActiveInjury & { id: number; startDate: string }>
> {
  const rows = await db
    .select({
      id: injury.id,
      region: injury.region,
      severity: injury.severity,
      notes: injury.notes,
      startDate: injury.startDate,
    })
    .from(injury)
    .where(and(eq(injury.userId, userId), isNull(injury.endDate)));
  return rows;
}
