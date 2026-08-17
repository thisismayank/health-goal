/**
 * intervals.icu API client — now per-user credential aware.
 *
 * Callers pass a { athleteId, apiKey } object explicitly instead of
 * reading from env vars. The DB-side loader lives in ./credentials.ts
 * so we can encrypt-at-rest without callers ever seeing plaintext.
 *
 * The legacy env-var path (INTERVALS_API_KEY + INTERVALS_ATHLETE_ID)
 * is deliberately gone — one credential source, no ambiguity.
 */

const API_BASE = "https://intervals.icu/api/v1";

export type IntervalsCreds = {
  athleteId: string;
  apiKey: string;
};

function authHeader(apiKey: string): string {
  // intervals.icu convention: literal "API_KEY" as username, actual key as password.
  const encoded = Buffer.from(`API_KEY:${apiKey}`).toString("base64");
  return `Basic ${encoded}`;
}

// Raw wellness entry — we only reach into a subset in the sync layer.
export type IntervalsWellness = {
  id: string; // YYYY-MM-DD
  weight?: number | null;
  restingHR?: number | null;
  hrv?: number | null;
  hrvSDNN?: number | null;
  sleepSecs?: number | null;
  sleepScore?: number | null;
  sleepQuality?: number | null;
  steps?: number | null;
  respiration?: number | null;
  spO2?: number | null;
  readiness?: number | null;
  ctl?: number | null;
  atl?: number | null;
  fatigue?: number | null;
  stress?: number | null;
  mood?: number | null;
  motivation?: number | null;
  soreness?: number | null;
  updated?: string | null;
  [k: string]: unknown;
};

export async function getWellnessRange(
  creds: IntervalsCreds,
  oldestYmd: string,
  newestYmd: string,
): Promise<IntervalsWellness[]> {
  const url = `${API_BASE}/athlete/${creds.athleteId}/wellness?oldest=${oldestYmd}&newest=${newestYmd}`;
  const res = await fetch(url, {
    headers: { Authorization: authHeader(creds.apiKey) },
  });
  if (!res.ok) {
    throw new Error(
      `intervals.icu wellness ${res.status}: ${await res.text()}`,
    );
  }
  return res.json();
}

export type IntervalsAthlete = {
  id: string;
  name?: string | null;
  city?: string | null;
  timezone?: string | null;
};

export async function getAthlete(
  creds: IntervalsCreds,
): Promise<IntervalsAthlete> {
  const url = `${API_BASE}/athlete/${creds.athleteId}/profile`;
  const res = await fetch(url, {
    headers: { Authorization: authHeader(creds.apiKey) },
  });
  if (!res.ok) {
    throw new Error(
      `intervals.icu profile ${res.status}: ${await res.text()}`,
    );
  }
  const body = (await res.json()) as { athlete: IntervalsAthlete };
  return body.athlete;
}

/**
 * Fast credential validation — one round trip to /profile. Throws
 * with a friendly message on 401/403 so the UI can surface "invalid
 * key" instead of a generic error.
 */
export async function validateCredentials(
  creds: IntervalsCreds,
): Promise<IntervalsAthlete> {
  const url = `${API_BASE}/athlete/${creds.athleteId}/profile`;
  const res = await fetch(url, {
    headers: { Authorization: authHeader(creds.apiKey) },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Invalid athlete ID or API key");
  }
  if (res.status === 404) {
    throw new Error(`Athlete ${creds.athleteId} not found`);
  }
  if (!res.ok) {
    throw new Error(`intervals.icu returned ${res.status}`);
  }
  const body = (await res.json()) as { athlete: IntervalsAthlete };
  return body.athlete;
}
