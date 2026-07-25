import { randomBytes } from "crypto";
import type { Express } from "express";
import { requestOrigin } from "./gmailOauth";
import {
  buildUpworkOauthCallbackUrl,
  consumePendingUpworkOauthState,
  getUpworkOauthClientCredentials,
  getUpworkOauthConnection,
  savePendingUpworkOauthState,
  saveUpworkOauthConnection,
} from "./upworkIntegrationSettings";

const UPWORK_AUTH_URL = "https://www.upwork.com/ab/account-security/oauth2/authorize";
const UPWORK_TOKEN_URL = "https://www.upwork.com/api/v3/oauth2/token";
export const UPWORK_GRAPHQL_URL = "https://api.upwork.com/graphql";

interface UpworkTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 20_000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Upwork OAuth request timed out");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestToken(body: URLSearchParams): Promise<UpworkTokenResponse> {
  const response = await fetchWithTimeout(UPWORK_TOKEN_URL, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json().catch(() => ({})) as UpworkTokenResponse;
  if (!response.ok || !payload.access_token) {
    const detail = payload.error_description || payload.error || `${response.status} ${response.statusText}`;
    throw new Error(`Upwork token request failed: ${detail}`);
  }
  return payload;
}

export async function createUpworkOauthAuthorizationUrl(origin: string): Promise<{ authUrl: string; callbackUrl: string }> {
  const client = await getUpworkOauthClientCredentials();
  if (!client) throw new Error("Configure an approved Upwork OAuth 2.0 key before connecting messages");
  const callbackUrl = buildUpworkOauthCallbackUrl(origin);
  const state = randomBytes(32).toString("base64url");
  await savePendingUpworkOauthState(state, callbackUrl);
  const authUrl = new URL(UPWORK_AUTH_URL);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", client.clientId);
  authUrl.searchParams.set("redirect_uri", callbackUrl);
  authUrl.searchParams.set("state", state);
  return { authUrl: authUrl.toString(), callbackUrl };
}

export async function refreshUpworkAccessToken(): Promise<{ accessToken: string; expiresIn: number }> {
  const [client, connection] = await Promise.all([
    getUpworkOauthClientCredentials(),
    getUpworkOauthConnection(),
  ]);
  if (!client) throw new Error("Upwork OAuth client is not configured");
  if (!connection) throw new Error("Upwork messages are not connected");
  const payload = await requestToken(new URLSearchParams({
    grant_type: "refresh_token",
    client_id: client.clientId,
    client_secret: client.clientSecret,
    refresh_token: connection.refreshToken,
  }));
  if (payload.refresh_token && payload.refresh_token !== connection.refreshToken && connection.source === "database") {
    await saveUpworkOauthConnection({
      refreshToken: payload.refresh_token,
      userId: connection.userId,
      userName: connection.userName,
      organizationId: connection.organizationId,
    });
  }
  return { accessToken: payload.access_token!, expiresIn: payload.expires_in ?? 86_400 };
}

async function getCurrentUpworkUser(accessToken: string): Promise<{ id: string; name: string }> {
  const response = await fetchWithTimeout(UPWORK_GRAPHQL_URL, {
    method: "POST",
    headers: { accept: "application/json", authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ query: "query ConnectedUpworkUser { user { id name } }" }),
  });
  const payload = await response.json().catch(() => ({})) as {
    data?: { user?: { id?: string; name?: string } };
    errors?: Array<{ message?: string }>;
  };
  if (!response.ok || payload.errors?.length || !payload.data?.user?.id) {
    const detail = payload.errors?.map((error) => error.message).filter(Boolean).join("; ") || `${response.status} ${response.statusText}`;
    throw new Error(`Upwork account verification failed: ${detail}`);
  }
  return { id: String(payload.data.user.id), name: payload.data.user.name?.trim() || "Connected Upwork account" };
}

async function completeUpworkOauth(code: string, state: string): Promise<{ account: string; redirectOrigin: string }> {
  const pending = await consumePendingUpworkOauthState(state);
  const client = await getUpworkOauthClientCredentials();
  if (!client) throw new Error("Upwork OAuth client is no longer configured");
  const payload = await requestToken(new URLSearchParams({
    grant_type: "authorization_code",
    client_id: client.clientId,
    client_secret: client.clientSecret,
    code,
    redirect_uri: pending.redirectUri,
  }));
  const existing = await getUpworkOauthConnection();
  const refreshToken = payload.refresh_token || existing?.refreshToken;
  if (!refreshToken) throw new Error("Upwork did not return a refresh token; reconnect the account");
  const user = await getCurrentUpworkUser(payload.access_token!);
  await saveUpworkOauthConnection({
    refreshToken,
    userId: user.id,
    userName: user.name,
    organizationId: process.env.UPWORK_ORG_ID?.trim() || existing?.organizationId || null,
  });
  return { account: user.name, redirectOrigin: new URL(pending.redirectUri).origin };
}

function oauthRedirect(origin: string, params: Record<string, string>): string {
  const target = new URL("/", origin);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return target.toString();
}

export function registerUpworkOauthRoutes(app: Express): void {
  app.get("/api/integrations/upwork/callback", async (req, res) => {
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const providerError = typeof req.query.error === "string" ? req.query.error : "";
    let redirectOrigin: string;
    try {
      redirectOrigin = requestOrigin(req);
    } catch {
      redirectOrigin = "http://127.0.0.1:3025";
    }
    try {
      if (providerError) throw new Error(`Upwork authorization was not completed: ${providerError}`);
      if (!state || !code) throw new Error("Upwork callback is missing its authorization code or state");
      const completed = await completeUpworkOauth(code, state);
      redirectOrigin = completed.redirectOrigin;
      res.redirect(oauthRedirect(redirectOrigin, { upwork: "connected", account: completed.account }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upwork connection failed";
      res.redirect(oauthRedirect(redirectOrigin, { upwork: "error", upwork_message: message.slice(0, 240) }));
    }
  });
}
