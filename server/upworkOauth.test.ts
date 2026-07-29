import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./gmailOauth", () => ({
  requestOrigin: vi.fn(() => "http://127.0.0.1:3025"),
}));

vi.mock("./upworkIntegrationSettings", () => ({
  buildUpworkOauthCallbackUrl: vi.fn(() => "http://127.0.0.1:3025/api/integrations/upwork/callback"),
  consumePendingUpworkOauthState: vi.fn(),
  getUpworkOauthClientCredentials: vi.fn(async () => ({
    clientId: "client-id-123",
    clientSecret: "client-secret-123",
    source: "database",
  })),
  getUpworkOauthConnection: vi.fn(async () => ({
    refreshToken: "refresh-old",
    userId: "owner-1",
    userName: "Owner",
    organizationId: "org-1",
    connectedAt: "2026-07-15T10:00:00.000Z",
    source: "database",
  })),
  savePendingUpworkOauthState: vi.fn(),
  saveUpworkOauthConnection: vi.fn(),
}));

import {
  getUpworkOauthClientCredentials,
  savePendingUpworkOauthState,
  saveUpworkOauthConnection,
} from "./upworkIntegrationSettings";
import { createUpworkOauthAuthorizationUrl, refreshUpworkAccessToken } from "./upworkOauth";

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Upwork OAuth", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("creates an authorization URL with a one-time state and exact callback", async () => {
    const result = await createUpworkOauthAuthorizationUrl("http://127.0.0.1:3025");
    const url = new URL(result.authUrl);

    expect(url.origin + url.pathname).toBe("https://www.upwork.com/ab/account-security/oauth2/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-id-123");
    expect(url.searchParams.get("redirect_uri")).toBe(result.callbackUrl);
    expect(url.searchParams.get("state")).toHaveLength(43);
    expect(savePendingUpworkOauthState).toHaveBeenCalledWith(url.searchParams.get("state"), result.callbackUrl);
  });

  it("refreshes the access token and persists refresh-token rotation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      access_token: "access-new",
      refresh_token: "refresh-new",
      expires_in: 86_400,
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(refreshUpworkAccessToken()).resolves.toEqual({ accessToken: "access-new", expiresIn: 86_400 });
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(String(request.body)).toContain("grant_type=refresh_token");
    expect(String(request.body)).toContain("refresh_token=refresh-old");
    expect(saveUpworkOauthConnection).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: "refresh-new", userId: "owner-1" }));
  });

  it("fails closed when the approved OAuth client is missing", async () => {
    vi.mocked(getUpworkOauthClientCredentials).mockResolvedValueOnce(null);
    await expect(refreshUpworkAccessToken()).rejects.toThrow("client is not configured");
  });

  it("surfaces provider token errors without accepting an empty token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
      error: "invalid_grant",
      error_description: "Refresh token expired",
    }, 401)));

    await expect(refreshUpworkAccessToken()).rejects.toThrow("Refresh token expired");
  });
});
