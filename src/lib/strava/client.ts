const AUTH_URL = "https://www.strava.com/oauth/authorize";
const TOKEN_URL = "https://www.strava.com/oauth/token";
const DEAUTH_URL = "https://www.strava.com/oauth/deauthorize";
const API_BASE = "https://www.strava.com/api/v3";

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} not set`);
  return v;
}

export function authorizeUrl(redirectUri: string, state?: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("STRAVA_CLIENT_ID"),
    response_type: "code",
    redirect_uri: redirectUri,
    approval_prompt: "auto",
    scope: "read,activity:read_all",
  });
  if (state) params.set("state", state);
  return `${AUTH_URL}?${params.toString()}`;
}

export type StravaTokenResponse = {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete: {
    id: number;
    username?: string;
    firstname?: string;
    lastname?: string;
  };
};

async function tokenRequest(body: Record<string, string>): Promise<StravaTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("STRAVA_CLIENT_ID"),
      client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
      ...body,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava token endpoint ${res.status}: ${text}`);
  }
  return res.json();
}

export function exchangeCode(code: string) {
  return tokenRequest({ code, grant_type: "authorization_code" });
}

export function refreshTokens(refreshToken: string) {
  return tokenRequest({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
}

export type StravaActivity = {
  id: number;
  external_id?: string | null;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  total_elevation_gain: number;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  average_speed?: number | null;
  description?: string | null;
};

async function apiGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava GET ${path} ${res.status}: ${text}`);
  }
  return res.json();
}

export function getActivity(accessToken: string, activityId: number) {
  return apiGet<StravaActivity>(accessToken, `/activities/${activityId}`);
}

export function listActivitiesSince(
  accessToken: string,
  afterEpochSeconds: number,
  perPage = 50,
) {
  return apiGet<StravaActivity[]>(
    accessToken,
    `/athlete/activities?after=${afterEpochSeconds}&per_page=${perPage}`,
  );
}

export async function deauthorize(accessToken: string): Promise<void> {
  const res = await fetch(DEAUTH_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Strava deauthorize ${res.status}: ${await res.text()}`);
  }
}

export type StravaSubscription = { id: number; callback_url: string };

export async function listSubscriptions(): Promise<StravaSubscription[]> {
  const params = new URLSearchParams({
    client_id: requireEnv("STRAVA_CLIENT_ID"),
    client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
  });
  const res = await fetch(`${API_BASE}/push_subscriptions?${params.toString()}`);
  if (!res.ok) throw new Error(`Strava listSubscriptions ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function createSubscription(
  callbackUrl: string,
  verifyToken: string,
): Promise<{ id: number }> {
  const body = new URLSearchParams({
    client_id: requireEnv("STRAVA_CLIENT_ID"),
    client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
    callback_url: callbackUrl,
    verify_token: verifyToken,
  });
  const res = await fetch(`${API_BASE}/push_subscriptions`, {
    method: "POST",
    body,
  });
  if (!res.ok) throw new Error(`Strava createSubscription ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function deleteSubscription(subscriptionId: number): Promise<void> {
  const params = new URLSearchParams({
    client_id: requireEnv("STRAVA_CLIENT_ID"),
    client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
  });
  const res = await fetch(
    `${API_BASE}/push_subscriptions/${subscriptionId}?${params.toString()}`,
    { method: "DELETE" },
  );
  if (!res.ok && res.status !== 204) {
    throw new Error(`Strava deleteSubscription ${res.status}: ${await res.text()}`);
  }
}
