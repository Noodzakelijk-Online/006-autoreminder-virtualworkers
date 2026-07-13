import { afterEach, describe, expect, it, vi } from "vitest";
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

function createContext(): TrpcContext {
  return {
    user: {
      openId: "joyce-single-user",
      name: "Joyce",
      email: null,
      role: "admin",
      loginMethod: "single-user",
    },
    req: {
      protocol: "http",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("manual APTLSS maintenance mutation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("runs the shared maintenance job with manual source", async () => {
    const caller = appRouter.createCaller(createContext());

    const result = await caller.aptlss.runMaintenanceNow();

    expect(runAptlssMaintenance).toHaveBeenCalledWith("manual");
    expect(result).toMatchObject({
      success: true,
      refreshed: 2,
      total: 2,
    });
  });

});
