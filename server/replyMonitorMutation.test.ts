import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./cronJobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./cronJobs")>()),
  runReplyMonitorScan: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./replyMonitorDb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./replyMonitorDb")>()),
  getReplyMonitorStatus: vi.fn(),
}));

const { runReplyMonitorScan } = await import("./cronJobs");
const { getReplyMonitorStatus } = await import("./replyMonitorDb");
const { appRouter } = await import("./routers");

function createContext(): TrpcContext {
  return {
    user: {
      openId: "joyce-local",
      name: "Joyce",
      email: "joyce@example.test",
      role: "admin",
      loginMethod: "local-token",
    },
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("manual Reply Monitor scan", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("waits for scan completion and returns the persisted result", async () => {
    vi.mocked(getReplyMonitorStatus).mockResolvedValue({
      id: 1,
      state: "success",
      lastStartedAt: new Date("2026-07-10T10:00:00.000Z"),
      lastCompletedAt: new Date("2026-07-10T10:00:04.000Z"),
      lastSuccessfulAt: new Date("2026-07-10T10:00:04.000Z"),
      threadsScanned: 12,
      errorMessage: null,
      updatedAt: new Date("2026-07-10T10:00:04.000Z"),
    });

    const result = await appRouter.createCaller(createContext()).replyMonitor.triggerScan();

    expect(runReplyMonitorScan).toHaveBeenCalledWith({ sendNotifications: false });
    expect(result).toMatchObject({ success: true, message: "Scan completed", threadsScanned: 12 });
  });

  it("surfaces the persisted scan failure instead of reporting that it started", async () => {
    vi.mocked(getReplyMonitorStatus).mockResolvedValue({
      id: 1,
      state: "error",
      lastStartedAt: new Date("2026-07-10T10:00:00.000Z"),
      lastCompletedAt: new Date("2026-07-10T10:00:01.000Z"),
      lastSuccessfulAt: null,
      threadsScanned: 0,
      errorMessage: "Trello unavailable",
      updatedAt: new Date("2026-07-10T10:00:01.000Z"),
    });

    await expect(appRouter.createCaller(createContext()).replyMonitor.triggerScan()).rejects.toThrow("Trello unavailable");
  });
});
