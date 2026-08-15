const API_BASE = "https://intervals.icu/api/v1";

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} not set`);
  return v;
}

function authHeader(): string {
  const key = requireEnv("INTERVALS_API_KEY");
  // intervals.icu convention: literal "API_KEY" as username, actual key as password
  const encoded = Buffer.from(`API_KEY:${key}`).toString("base64");
  return `Basic ${encoded}`;
}

export function isConfigured(): boolean {
  return Boolean(process.env.INTERVALS_ATHLETE_ID && process.env.INTERVALS_API_KEY);
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
  oldestYmd: string,
  newestYmd: string,
): Promise<IntervalsWellness[]> {
  const athleteId = requireEnv("INTERVALS_ATHLETE_ID");
  const url = `${API_BASE}/athlete/${athleteId}/wellness?oldest=${oldestYmd}&newest=${newestYmd}`;
  const res = await fetch(url, { headers: { Authorization: authHeader() } });
  if (!res.ok) {
    throw new Error(`intervals.icu wellness ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export type IntervalsAthlete = {
  id: string;
  name?: string | null;
  city?: string | null;
  timezone?: string | null;
};

export async function getAthlete(): Promise<IntervalsAthlete> {
  const athleteId = requireEnv("INTERVALS_ATHLETE_ID");
  const url = `${API_BASE}/athlete/${athleteId}/profile`;
  const res = await fetch(url, { headers: { Authorization: authHeader() } });
  if (!res.ok) {
    throw new Error(`intervals.icu profile ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as { athlete: IntervalsAthlete };
  return body.athlete;
}
