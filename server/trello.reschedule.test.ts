import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the trello-cache service
vi.mock("./services/trello-cache", () => ({
  invalidateCache: vi.fn().mockResolvedValue(undefined),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("trello.reschedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully reschedules by invalidating cache", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    const { invalidateCache } = await import("./services/trello-cache");

    const result = await caller.trello.reschedule();

    expect(result.success).toBe(true);
    expect(result.message).toContain("Cache cleared");
    expect(invalidateCache).toHaveBeenCalledWith(1, "sample-user", "tasks");
  });

  it("returns helpful message about rescheduling", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.trello.reschedule();

    expect(result.success).toBe(true);
    expect(result.note).toContain("APTLSS");
  });

  it("throws error when user is not authenticated", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    // The protectedProcedure should throw before reaching our code
    await expect(caller.trello.reschedule()).rejects.toThrow();
  });
});
