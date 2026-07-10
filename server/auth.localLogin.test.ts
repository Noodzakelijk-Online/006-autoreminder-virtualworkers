import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    upsertUser: vi.fn(),
    getUserByOpenId: vi.fn(),
  };
});

vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("signed-session"),
  },
}));

import { appRouter } from "./routers";
import { getUserByOpenId, upsertUser } from "./db";
import { COOKIE_NAME } from "../shared/const";

const user = {
  id: 1,
  openId: "joyce-local",
  email: "joyce@example.test",
  name: "Joyce",
  loginMethod: "local-token",
  role: "admin" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function createPublicContext() {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "http",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, cookies };
}

describe("auth.localLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LOCAL_AUTH_TOKEN", "local-secret");
    vi.stubEnv("LOCAL_AUTH_OPEN_ID", "joyce-local");
    vi.stubEnv("LOCAL_AUTH_NAME", "Joyce");
    vi.stubEnv("LOCAL_AUTH_EMAIL", "joyce@example.test");
    vi.stubEnv("OWNER_OPEN_ID", "joyce-local");
  });

  it("rejects local login when the token is wrong", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.auth.localLogin({ token: "wrong" })).rejects.toThrow("Invalid local access token");
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it("creates an owner session cookie when the token matches", async () => {
    vi.mocked(getUserByOpenId).mockResolvedValue(user);
    const { ctx, cookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.localLogin({ token: "local-secret" });

    expect(result.success).toBe(true);
    expect(upsertUser).toHaveBeenCalledWith(expect.objectContaining({
      openId: "joyce-local",
      loginMethod: "local-token",
      role: "admin",
    }));
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.name).toBe(COOKIE_NAME);
    expect(cookies[0]?.value).toBe("signed-session");
    expect(cookies[0]?.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("creates a local owner session when database persistence is unavailable", async () => {
    vi.mocked(upsertUser).mockRejectedValue(new Error("database unavailable"));
    const { ctx, cookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.localLogin({ token: "local-secret" });

    expect(result.success).toBe(true);
    expect(result.user).toMatchObject({
      id: 0,
      openId: "joyce-local",
      name: "Joyce",
      email: "joyce@example.test",
      loginMethod: "local-token",
      role: "admin",
    });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.name).toBe(COOKIE_NAME);
    expect(cookies[0]?.value).toBe("signed-session");
  });
});
