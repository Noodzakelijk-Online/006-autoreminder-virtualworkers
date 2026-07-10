import { afterEach, describe, expect, it, vi } from "vitest";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

vi.mock("./sdk", () => ({
  sdk: {
    authenticateRequest: vi.fn(),
  },
}));

import { createContext } from "./context";
import { sdk } from "./sdk";

function createContextOptions(): CreateExpressContextOptions {
  return {
    req: {
      headers: {},
    } as CreateExpressContextOptions["req"],
    res: {} as CreateExpressContextOptions["res"],
  };
}

describe("createContext auth bypass", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("creates a temporary admin user when local owner login is disabled", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JOYCE_DISABLE_OWNER_LOGIN", "true");
    vi.stubEnv("LOCAL_AUTH_OPEN_ID", "joyce-local");
    vi.stubEnv("LOCAL_AUTH_NAME", "Joyce");
    vi.stubEnv("LOCAL_AUTH_EMAIL", "joyce@example.test");

    const ctx = await createContext(createContextOptions());

    expect(sdk.authenticateRequest).not.toHaveBeenCalled();
    expect(ctx.user).toMatchObject({
      id: 0,
      openId: "joyce-local",
      name: "Joyce",
      email: "joyce@example.test",
      role: "admin",
      loginMethod: "local-token",
    });
  });

  it("does not bypass auth in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JOYCE_DISABLE_OWNER_LOGIN", "true");
    vi.mocked(sdk.authenticateRequest).mockRejectedValueOnce(new Error("no session"));

    const ctx = await createContext(createContextOptions());

    expect(sdk.authenticateRequest).toHaveBeenCalledTimes(1);
    expect(ctx.user).toBeNull();
  });
});
