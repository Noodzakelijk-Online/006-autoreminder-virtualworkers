import { randomBytes } from "crypto";
import type { Express, Request } from "express";
import {
  buildGmailOauthCallbackUrl,
  consumePendingGmailOauthState,
  getGmailOauthClientCredentials,
  getGmailOauthConnection,
  saveGmailOauthConnection,
  savePendingGmailOauthState,
} from "./gmailIngestionSettings";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";
export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const GOOGLE_DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

function firstForwardedValue(value: string | string[] | undefined): string | null {
  const item = Array.isArray(value) ? value[0] : value;
  return item?.split(",")[0]?.trim() || null;
}

export function requestOrigin(req: Request): string {
  const protocol = firstForwardedValue(req.headers["x-forwarded-proto"]) || req.protocol || "http";
  const host = firstForwardedValue(req.headers["x-forwarded-host"]) || req.get("host");
  if (!host) throw new Error("Request host is unavailable");
  const origin = new URL(`${protocol}://${host}`);
  if (origin.protocol !== "http:" && origin.protocol !== "https:") throw new Error("Unsupported request protocol");
  return origin.origin;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 20_000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Google OAuth request timed out");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createGmailOauthAuthorizationUrl(origin: string): Promise<{ authUrl: string; callbackUrl: string }> {
  const client = await getGmailOauthClientCredentials();
  if (!client) throw new Error("Configure a Google OAuth client before connecting Google Workspace");
  const callbackUrl = buildGmailOauthCallbackUrl(origin);
  const state = randomBytes(32).toString("base64url");
  await savePendingGmailOauthState(state, callbackUrl);

  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("client_id", client.clientId);
  authUrl.searchParams.set("redirect_uri", callbackUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", `openid email ${GMAIL_READONLY_SCOPE} ${GOOGLE_DRIVE_READONLY_SCOPE}`);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("state", state);
  return { authUrl: authUrl.toString(), callbackUrl };
}

export async function refreshGoogleAccessToken(): Promise<{ accessToken: string; expiresIn: number }> {
  const [client, connection] = await Promise.all([
    getGmailOauthClientCredentials(),
    getGmailOauthConnection(),
  ]);
  if (!client) throw new Error("Google OAuth client is not configured");
  if (!connection) throw new Error("Google Workspace is not connected");

  const body = new URLSearchParams({
    client_id: client.clientId,
    client_secret: client.clientSecret,
    refresh_token: connection.refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json() as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    const detail = payload.error_description || payload.error || `${response.status} ${response.statusText}`;
    throw new Error(`Google access token refresh failed: ${detail}`);
  }
  return { accessToken: payload.access_token, expiresIn: payload.expires_in ?? 3_600 };
}

export const refreshGmailAccessToken = refreshGoogleAccessToken;

async function completeGmailOauth(code: string, state: string): Promise<{ email: string; redirectOrigin: string }> {
  const pending = await consumePendingGmailOauthState(state);
  const client = await getGmailOauthClientCredentials();
  if (!client) throw new Error("Google OAuth client is no longer configured");

  const body = new URLSearchParams({
    client_id: client.clientId,
    client_secret: client.clientSecret,
    code,
    redirect_uri: pending.redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json() as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    const detail = payload.error_description || payload.error || `${response.status} ${response.statusText}`;
    throw new Error(`Google rejected the Workspace connection: ${detail}`);
  }

  const existing = await getGmailOauthConnection();
  const refreshToken = payload.refresh_token || existing?.refreshToken;
  if (!refreshToken) throw new Error("Google did not return an offline refresh token; reconnect and approve offline access");

  const profileResponse = await fetchWithTimeout(GMAIL_PROFILE_URL, {
    headers: { authorization: `Bearer ${payload.access_token}` },
  });
  const profile = await profileResponse.json() as { emailAddress?: string };
  if (!profileResponse.ok || !profile.emailAddress) {
    throw new Error("Gmail connected, but the account profile could not be verified");
  }

  const scopes = Array.from(new Set([
    ...(existing?.scopes ?? []),
    ...(payload.scope ?? "").split(/\s+/).filter(Boolean),
  ]));
  await saveGmailOauthConnection(refreshToken, profile.emailAddress, scopes);
  return { email: profile.emailAddress, redirectOrigin: new URL(pending.redirectUri).origin };
}

function oauthRedirect(origin: string, params: Record<string, string>): string {
  const target = new URL("/", origin);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return target.toString();
}

export function registerGmailOauthRoutes(app: Express): void {
  app.get("/api/integrations/gmail/callback", async (req, res) => {
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const providerError = typeof req.query.error === "string" ? req.query.error : "";
    let redirectOrigin = `${req.protocol}://${req.get("host")}`;

    try {
      if (providerError) throw new Error(`Google authorization was not completed: ${providerError}`);
      if (!state || !code) throw new Error("Google callback is missing its authorization code or state");
      const completed = await completeGmailOauth(code, state);
      redirectOrigin = completed.redirectOrigin;
      res.redirect(oauthRedirect(redirectOrigin, { gmail: "connected", account: completed.email }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gmail connection failed";
      res.redirect(oauthRedirect(redirectOrigin, { gmail: "error", gmail_message: message.slice(0, 240) }));
    }
  });
}
