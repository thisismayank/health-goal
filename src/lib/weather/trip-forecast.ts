/**
 * Shared 'forecast for a trip' resolver. Used by both the trip-week
 * notification cron and the home trip-week hero.
 *
 * Best-effort: null result if we can't resolve destination coords, if the
 * target date is beyond Open-Meteo's 16-day horizon, or if the fetch
 * fails. Callers render accordingly.
 */

import { coordsForQuery } from "@/lib/basecamp/destinations";
import {
  fetchDailyForecast,
  type DailyForecast,
} from "@/lib/weather/open-meteo";

export async function tryFetchTripForecast({
  trailName,
  notes,
  targetDate,
}: {
  trailName: string;
  notes: string | null;
  targetDate: string;
}): Promise<DailyForecast | null> {
  // Concatenate name + notes so region-y words in either can match.
  const searchable = `${trailName} ${notes ?? ""}`;
  const coords = coordsForQuery(searchable);
  if (!coords) return null;
  try {
    const res = await fetchDailyForecast(coords.lat, coords.lng);
    return res.daily.find((d) => d.date === targetDate) ?? null;
  } catch (e) {
    console.warn(
      `[trip-forecast] fetch failed for ${trailName}:`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}
