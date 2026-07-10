import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./scheduledAptlssMaintenance", () => ({
  runAptlssMaintenance: vi.fn().mockResolvedValue({
    success: true,
    total: 2,
    refreshed: 2,
    failed: 0,
    followUpDraftsGenerated: 0,
    duplicatesDetected: 0,
    noNextActionCount: 0,
    dailyPlanGenerated: false,
    robertQueueCount: 1,
    timestamp: "2026-07-05T00:00:00.000Z",
  }),
}));

const { runAptlssMaintenance } = await import("./scheduledAptlssMaintenance");
const { appRouter } = await import("./routers");

function createContext(role: "admin" | "user"): TrpcContext {
  return {
    user: {
      openId: role === "admin" ? "owner-open-id" : "joyce-open-id",
      name: role,
      email: `${role}@example.test`,
      role,
      loginMethod: "local",
    },
    req: {
      protocol: "http",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("manual APTLSS maintenance mutation", () => {
  beforeEach(() => {
    vi.stubEnv("OWNER_OPEN_ID", "owner-open-id");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("runs the shared maintenance job with manual source for admin users", async () => {
    const caller = appRouter.createCaller(createContext("admin"));

    const result = await caller.aptlss.runMaintenanceNow();

    expect(runAptlssMaintenance).toHaveBeenCalledWith("manual");
    expect(result).toMatchObject({
      success: true,
      refreshed: 2,
      total: 2,
    });
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(caller.aptlss.runMaintenanceNow()).rejects.toThrow("Manual APTLSS maintenance is restricted");
  });
});
