import { afterEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { getSystemHealth, getSystemReadiness } from "./systemRouter";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    isAxiosError: vi.fn((error) => Boolean(error?.isAxiosError)),
  },
  get: vi.fn(),
  isAxiosError: vi.fn((error) => Boolean(error?.isAxiosError)),
}));

describe("system readiness", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("reports production blockers without exposing secret values", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("TrelloAPIKey", "");
    vi.stubEnv("TrelloAPIToken", "");
    vi.stubEnv("JWT_SECRET", "");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "");
    vi.stubEnv("OWNER_OPEN_ID", "");
    vi.stubEnv("OAUTH_SERVER_URL", "");
    vi.stubEnv("LOCAL_AUTH_TOKEN", "");
    vi.stubEnv("LOCAL_AUTH_OPEN_ID", "");
    vi.stubEnv("SCHEDULED_TASK_SECRET", "");
    vi.stubEnv("TRELLO_POWERUP_API_KEY", "");
    vi.stubEnv("TRELLO_POWERUP_SECRET", "");
    vi.stubEnv("TRELLO_WEBHOOK_CALLBACK_URL", "");
    vi.stubEnv("TRELLO_WEBHOOK_SECRET", "");

    const readiness = await getSystemReadiness({ probeDatabase: false, probeTrello: false });

    expect(readiness.ok).toBe(false);
    expect(readiness.status).toBe("blocked");
    expect(readiness.counts.blocked).toBeGreaterThanOrEqual(4);
    expect(readiness.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "database",
          status: "blocked",
          action: expect.stringContaining("DATABASE_URL"),
        }),
        expect.objectContaining({
          id: "trello-api-key",
          status: "blocked",
          action: expect.stringContaining("TrelloAPIKey"),
        }),
        expect.objectContaining({
          id: "trello-api-access",
          status: "blocked",
          action: expect.stringContaining("TrelloAPIKey"),
        }),
        expect.objectContaining({
          id: "ai-planner-key",
          status: "warning",
          action: expect.stringContaining("BUILT_IN_FORGE_API_KEY"),
        }),
        expect.objectContaining({
          id: "trello-powerup-api-key",
          status: "warning",
          action: expect.stringContaining("TRELLO_POWERUP_API_KEY"),
        }),
        expect.objectContaining({
          id: "owner-open-id",
          status: "warning",
          message: expect.stringContaining("locked closed"),
        }),
        expect.objectContaining({
          id: "scheduled-task-secret",
          status: "warning",
          action: expect.stringContaining("SCHEDULED_TASK_SECRET"),
        }),
        expect.objectContaining({
          id: "trello-webhook-callback-url",
          status: "warning",
          action: expect.stringContaining("/api/trello/webhook"),
        }),
        expect.objectContaining({
          id: "trello-webhook-secret",
          status: "warning",
          action: expect.stringContaining("TRELLO_POWERUP_SECRET"),
        }),
      ]),
    );
    expect(JSON.stringify(readiness)).not.toContain("secret-value");
  });

  it("treats configured core services as ready while preserving advisory warnings", async () => {
    vi.stubEnv("DATABASE_URL", "mysql://user:pass@example.test/db");
    vi.stubEnv("TrelloAPIKey", "secret-value");
    vi.stubEnv("TrelloAPIToken", "secret-value");
    vi.stubEnv("JWT_SECRET", "secret-value");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "secret-value");
    vi.stubEnv("OWNER_OPEN_ID", "");
    vi.stubEnv("OAUTH_SERVER_URL", "");
    vi.stubEnv("LOCAL_AUTH_TOKEN", "secret-value");
    vi.stubEnv("LOCAL_AUTH_OPEN_ID", "joyce-local");
    vi.stubEnv("SCHEDULED_TASK_SECRET", "secret-value");
    vi.stubEnv("TRELLO_POWERUP_API_KEY", "secret-value");
    vi.stubEnv("TRELLO_POWERUP_SECRET", "secret-value");
    vi.stubEnv("TRELLO_WEBHOOK_CALLBACK_URL", "");
    vi.stubEnv("TRELLO_WEBHOOK_SECRET", "");

    const readiness = await getSystemReadiness({ probeDatabase: false, probeTrello: false });

    expect(readiness.ok).toBe(true);
    expect(readiness.status).toBe("warning");
    expect(readiness.counts.blocked).toBe(0);
    expect(readiness.items.find((item) => item.id === "database")).toMatchObject({
      status: "ready",
    });
    expect(readiness.items.find((item) => item.id === "trello-powerup-api-key")).toMatchObject({
      status: "ready",
    });
    expect(readiness.items.find((item) => item.id === "trello-api-access")).toMatchObject({
      status: "ready",
      message: expect.stringContaining("skipped"),
    });
    expect(readiness.items.find((item) => item.id === "ai-planner-key")).toMatchObject({
      status: "ready",
    });
    expect(readiness.items.find((item) => item.id === "oauth-server")).toMatchObject({
      status: "ready",
      message: expect.stringContaining("Local owner login"),
    });
    expect(readiness.items.find((item) => item.id === "scheduled-task-secret")).toMatchObject({
      status: "ready",
    });
    expect(readiness.items.find((item) => item.id === "trello-webhook-callback-url")).toMatchObject({
      status: "warning",
      action: expect.stringContaining("/api/trello/webhook"),
    });
    expect(readiness.items.find((item) => item.id === "trello-webhook-secret")).toMatchObject({
      status: "ready",
      message: expect.stringContaining("TRELLO_POWERUP_SECRET"),
    });
    expect(JSON.stringify(readiness)).not.toContain("secret-value");
  });

  it("reports the temporary local login bypass as intentional development access", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", "mysql://user:pass@example.test/db");
    vi.stubEnv("TrelloAPIKey", "secret-value");
    vi.stubEnv("TrelloAPIToken", "secret-value");
    vi.stubEnv("JWT_SECRET", "secret-value");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "secret-value");
    vi.stubEnv("OWNER_OPEN_ID", "");
    vi.stubEnv("OAUTH_SERVER_URL", "");
    vi.stubEnv("LOCAL_AUTH_TOKEN", "");
    vi.stubEnv("LOCAL_AUTH_OPEN_ID", "");
    vi.stubEnv("JOYCE_DISABLE_OWNER_LOGIN", "true");
    vi.stubEnv("SCHEDULED_TASK_SECRET", "secret-value");
    vi.stubEnv("TRELLO_POWERUP_API_KEY", "secret-value");
    vi.stubEnv("TRELLO_POWERUP_SECRET", "secret-value");
    vi.stubEnv("TRELLO_WEBHOOK_CALLBACK_URL", "");
    vi.stubEnv("TRELLO_WEBHOOK_SECRET", "");

    const readiness = await getSystemReadiness({ probeDatabase: false, probeTrello: false });

    expect(readiness.ok).toBe(true);
    expect(readiness.items.find((item) => item.id === "owner-open-id")).toMatchObject({
      status: "warning",
      message: expect.stringContaining("JOYCE_DISABLE_OWNER_LOGIN"),
      action: expect.stringContaining("before production"),
    });
    expect(readiness.items.find((item) => item.id === "oauth-server")).toMatchObject({
      status: "warning",
      message: expect.stringContaining("bypassing the owner login"),
      action: expect.stringContaining("restore login"),
    });
    expect(JSON.stringify(readiness)).not.toContain("secret-value");
  });

  it("probes live Trello access when credentials are configured", async () => {
    vi.stubEnv("DATABASE_URL", "mysql://user:pass@example.test/db");
    vi.stubEnv("TrelloAPIKey", "secret-value");
    vi.stubEnv("TrelloAPIToken", "secret-value");
    vi.stubEnv("JWT_SECRET", "secret-value");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "secret-value");
    vi.stubEnv("OWNER_OPEN_ID", "");
    vi.stubEnv("OAUTH_SERVER_URL", "");
    vi.stubEnv("LOCAL_AUTH_TOKEN", "secret-value");
    vi.stubEnv("LOCAL_AUTH_OPEN_ID", "joyce-local");
    vi.stubEnv("SCHEDULED_TASK_SECRET", "secret-value");
    vi.stubEnv("TRELLO_POWERUP_API_KEY", "secret-value");
    vi.stubEnv("TRELLO_POWERUP_SECRET", "secret-value");
    vi.stubEnv("TRELLO_WEBHOOK_CALLBACK_URL", "");
    vi.stubEnv("TRELLO_WEBHOOK_SECRET", "");
    vi.mocked(axios.get).mockResolvedValueOnce({ data: [] });

    const readiness = await getSystemReadiness({ probeDatabase: false, probeTrello: true });

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("/members/joyjemimajj1/cards"),
      expect.objectContaining({
        params: expect.objectContaining({
          key: "secret-value",
          token: "secret-value",
          limit: 1,
        }),
      }),
    );
    expect(readiness.items.find((item) => item.id === "trello-api-access")).toMatchObject({
      status: "ready",
      message: expect.stringContaining("Joyce card access is reachable"),
    });
    expect(JSON.stringify(readiness)).not.toContain("secret-value");
  });

  it("blocks production readiness when Trello rejects configured credentials", async () => {
    vi.stubEnv("DATABASE_URL", "mysql://user:pass@example.test/db");
    vi.stubEnv("TrelloAPIKey", "secret-value");
    vi.stubEnv("TrelloAPIToken", "secret-value");
    vi.stubEnv("JWT_SECRET", "secret-value");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "secret-value");
    vi.stubEnv("OWNER_OPEN_ID", "");
    vi.stubEnv("OAUTH_SERVER_URL", "");
    vi.stubEnv("LOCAL_AUTH_TOKEN", "secret-value");
    vi.stubEnv("LOCAL_AUTH_OPEN_ID", "joyce-local");
    vi.stubEnv("SCHEDULED_TASK_SECRET", "secret-value");
    vi.stubEnv("TRELLO_POWERUP_API_KEY", "secret-value");
    vi.stubEnv("TRELLO_POWERUP_SECRET", "secret-value");
    vi.stubEnv("TRELLO_WEBHOOK_CALLBACK_URL", "https://example.test/api/trello/webhook");
    vi.stubEnv("TRELLO_WEBHOOK_SECRET", "");
    vi.mocked(axios.get).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401 },
    });

    const readiness = await getSystemReadiness({ probeDatabase: false, probeTrello: true });

    expect(readiness.ok).toBe(false);
    expect(readiness.status).toBe("blocked");
    expect(readiness.items.find((item) => item.id === "trello-api-access")).toMatchObject({
      status: "blocked",
      message: expect.stringContaining("Trello rejected"),
      action: expect.stringContaining("Trello API key/token"),
    });
    expect(JSON.stringify(readiness)).not.toContain("secret-value");
  });

  it("treats Trello rate limiting as temporary degradation instead of invalid credentials", async () => {
    vi.stubEnv("DATABASE_URL", "mysql://user:pass@example.test/db");
    vi.stubEnv("TrelloAPIKey", "secret-value");
    vi.stubEnv("TrelloAPIToken", "secret-value");
    vi.stubEnv("JWT_SECRET", "secret-value");
    vi.stubEnv("LOCAL_AUTH_TOKEN", "secret-value");
    vi.stubEnv("LOCAL_AUTH_OPEN_ID", "joyce-local");
    vi.mocked(axios.get).mockRejectedValueOnce({ isAxiosError: true, response: { status: 429 } });

    const readiness = await getSystemReadiness({ probeDatabase: false, probeTrello: true });

    expect(readiness.items.find((item) => item.id === "trello-api-access")).toMatchObject({
      status: "warning",
      message: expect.stringContaining("rate-limited"),
      action: expect.stringContaining("rate-limit window"),
    });
    expect(readiness.counts.blocked).toBe(0);
  });

  it("returns a compact health snapshot without secret-bearing item details", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("TrelloAPIKey", "secret-value");
    vi.stubEnv("TrelloAPIToken", "secret-value");
    vi.stubEnv("JWT_SECRET", "");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "");
    vi.stubEnv("OWNER_OPEN_ID", "");
    vi.stubEnv("OAUTH_SERVER_URL", "");
    vi.stubEnv("LOCAL_AUTH_TOKEN", "");
    vi.stubEnv("LOCAL_AUTH_OPEN_ID", "");
    vi.stubEnv("SCHEDULED_TASK_SECRET", "");
    vi.stubEnv("TRELLO_POWERUP_API_KEY", "");
    vi.stubEnv("TRELLO_POWERUP_SECRET", "");
    vi.stubEnv("TRELLO_WEBHOOK_CALLBACK_URL", "");
    vi.stubEnv("TRELLO_WEBHOOK_SECRET", "");

    const health = await getSystemHealth({ probeDatabase: false, probeTrello: false });

    expect(health.ok).toBe(false);
    expect(health.status).toBe("blocked");
    expect(health.nodeEnv).toBe("production");
    expect(health.counts.blocked).toBeGreaterThan(0);
    expect(health).not.toHaveProperty("items");
    expect(JSON.stringify(health)).not.toContain("secret-value");
  });
});
