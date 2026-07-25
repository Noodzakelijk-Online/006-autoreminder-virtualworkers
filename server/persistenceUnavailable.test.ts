import { afterEach, describe, expect, it, vi } from "vitest";

describe("persistence unavailable behavior", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  }, 30_000);

  it("fails closed before pretending a daily plan can load", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.resetModules();
    const { getSavedDailyPlan } = await import("./dailyPlan");
    await expect(getSavedDailyPlan("2026-07-04")).rejects.toThrow(
      "Database not available; daily plan persistence is disabled",
    );
  }, 30_000);

  it("fails closed before verifying processed Gmail tasks", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.resetModules();
    const { verifyProcessedEmailOutcomes } = await import("./emailOutcomeVerification");
    await expect(verifyProcessedEmailOutcomes()).rejects.toThrow("Database not available");
  }, 30_000);
});
