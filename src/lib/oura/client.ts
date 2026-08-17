/**
 * Oura Ring API v2 OAuth client. Mirrors the Strava client shape so the
 * routes + return page can follow the same pattern.
 *
 * Docs: https://cloud.ouraring.com/docs/authentication
 *       https://cloud.ouraring.com/v2/docs
 */

const AUTH_URL = "https://cloud.ouraring.com/oauth/authorize";
const TOKEN_URL = "https://api.ouraring.com/oauth/token";
const API_BASE = "https://api.ouraring.com/v2";

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} not set`);
  return v;
}

export function isConfigured(): boolean {
  return Boolean(
    process.env.OURA_CLIENT_ID && process.env.OURA_CLIENT_SECRET,
  );
}

// Scopes: personal (basic profile), daily (readiness/sleep/activity),
// heartrate (HR series), workout (workout events).
const DEFAULT_SCOPES = "personal daily heartrate workout";

export function authorizeUrl(redirectUri: string, state?: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("OURA_CLIENT_ID"),
    response_type: "code",
    redirect_uri: redirectUri,
    scope: DEFAULT_SCOPES,
  });
  if (state) params.set("state", state);
  return `${AUTH_URL}?${params.toString()}`;
}

export type OuraTokenResponse = {
  token_type: string; // "Bearer"
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
};

async function tokenRequest(
  params: Record<string, string>,
): Promise<OuraTokenResponse> {
  const body = new URLSearchParams({
    client_id: requireEnv("OURA_CLIENT_ID"),
    client_secret: requireEnv("OURA_CLIENT_SECRET"),
    ...params,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Oura token endpoint ${res.status}: ${text}`);
  }
  return (await res.json()) as OuraTokenResponse;
}

export function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<OuraTokenResponse> {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
}

export function refreshTokens(
  refreshToken: string,
): Promise<OuraTokenResponse> {
  return tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

// GET helper — the caller supplies the /v2 sub-path.
export async function apiGet<T>(
  accessToken: string,
  path: string,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Oura ${path} ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export type OuraPersonalInfo = {
  id: string;
  age?: number;
  weight?: number; // kg
  height?: number; // meters
  biological_sex?: string;
  email?: string;
};

export function getPersonalInfo(
  accessToken: string,
): Promise<OuraPersonalInfo> {
  return apiGet<OuraPersonalInfo>(accessToken, "/usercollection/personal_info");
}
