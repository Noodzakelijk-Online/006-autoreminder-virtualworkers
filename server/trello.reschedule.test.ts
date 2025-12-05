import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the entire routers module to intercept execAsync
vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
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

describe("trello.reschedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully reschedules and returns task count", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Mock exec to return a promise (since we use promisify)
    const { exec } = await import("child_process");
    const { readFile } = await import("fs/promises");
    
    vi.mocked(exec).mockImplementation(((cmd: string, opts: any, callback: any) => {
      // Simulate successful execution
      callback(null, { stdout: "Success", stderr: "" });
      return {} as any;
    }) as any);

    // Mock readFile to return sample tasks
    const mockTasks = [
      { id: "1", cardName: "Test", date: "Dec 05, 2025", durationHours: 1 },
      { id: "2", cardName: "Test 2", date: "Dec 06, 2025", durationHours: 1 },
    ];
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockTasks));

    const result = await caller.trello.reschedule();

    expect(result.success).toBe(true);
    expect(result.tasksCount).toBe(2);
    expect(result.message).toContain("successfully");
  });

  it("throws error when script fails", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Mock exec to simulate failure
    const { exec } = await import("child_process");
    
    vi.mocked(exec).mockImplementation(((cmd: string, opts: any, callback: any) => {
      callback(new Error("Script failed"), { stdout: "", stderr: "Error" });
      return {} as any;
    }) as any);

    await expect(caller.trello.reschedule()).rejects.toThrow("Rescheduling failed");
  });
});
