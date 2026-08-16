/**
 * Open-Meteo forecast fetcher. Free, no API key, CORS-friendly.
 * Docs: https://open-meteo.com/en/docs
 *
 * Free-tier limits are per-IP not per-user, so fetching from the client
 * is fine. If we ever hit rate limits, proxy through /api/weather and
 * add caching there.
 */

export type DailyForecast = {
  date: string; // YYYY-MM-DD in the destination's local tz
  weatherCode: number;
  tempMaxF: number;
  tempMinF: number;
  precipInches: number;
  precipProbabilityPct: number;
  windMaxMph: number;
};

export type ForecastResult = {
  daily: DailyForecast[];
  timezone: string;
  fetchedAt: number; // ms epoch
};

const MAX_DAYS = 16; // Open-Meteo free tier caps daily forecast at 16 days.

/**
 * Fetch a daily forecast for the given coordinates. Returns up to 16
 * days starting today (destination-local). Throws on network/parse
 * error — caller decides how to render.
 */
export async function fetchDailyForecast(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<ForecastResult> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lng.toFixed(4));
  url.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "wind_speed_10m_max",
    ].join(","),
  );
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", String(MAX_DAYS));

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    throw new Error(`Open-Meteo ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const body = (await res.json()) as {
    timezone: string;
    daily: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_sum: number[];
      precipitation_probability_max: (number | null)[];
      wind_speed_10m_max: number[];
    };
  };

  const daily: DailyForecast[] = body.daily.time.map((date, i) => ({
    date,
    weatherCode: body.daily.weather_code[i] ?? 0,
    tempMaxF: Math.round(body.daily.temperature_2m_max[i] ?? 0),
    tempMinF: Math.round(body.daily.temperature_2m_min[i] ?? 0),
    precipInches: +(body.daily.precipitation_sum[i] ?? 0).toFixed(2),
    precipProbabilityPct: Math.round(
      body.daily.precipitation_probability_max[i] ?? 0,
    ),
    windMaxMph: Math.round(body.daily.wind_speed_10m_max[i] ?? 0),
  }));

  return { daily, timezone: body.timezone, fetchedAt: Date.now() };
}

/**
 * WMO weather-code interpretation. Docs:
 * https://open-meteo.com/en/docs (see 'Weather variable documentation')
 */
export type WeatherKind =
  | "clear"
  | "mainly_clear"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "heavy_rain"
  | "snow"
  | "showers"
  | "thunder";

export function interpretWeatherCode(code: number): {
  kind: WeatherKind;
  label: string;
  glyph: string;
} {
  if (code === 0) return { kind: "clear", label: "Clear", glyph: "☀" };
  if (code >= 1 && code <= 2)
    return { kind: "mainly_clear", label: "Mainly clear", glyph: "🌤" };
  if (code === 3) return { kind: "cloudy", label: "Overcast", glyph: "☁" };
  if (code >= 45 && code <= 48)
    return { kind: "fog", label: "Fog", glyph: "🌫" };
  if (code >= 51 && code <= 57)
    return { kind: "drizzle", label: "Drizzle", glyph: "🌦" };
  if (code >= 61 && code <= 65) {
    if (code >= 65)
      return { kind: "heavy_rain", label: "Heavy rain", glyph: "🌧" };
    return { kind: "rain", label: "Rain", glyph: "🌧" };
  }
  if (code >= 71 && code <= 77)
    return { kind: "snow", label: "Snow", glyph: "❄" };
  if (code >= 80 && code <= 82)
    return { kind: "showers", label: "Showers", glyph: "🌦" };
  if (code >= 85 && code <= 86)
    return { kind: "snow", label: "Snow showers", glyph: "❄" };
  if (code >= 95 && code <= 99)
    return { kind: "thunder", label: "Thunderstorm", glyph: "⛈" };
  return { kind: "cloudy", label: "Unknown", glyph: "·" };
}
