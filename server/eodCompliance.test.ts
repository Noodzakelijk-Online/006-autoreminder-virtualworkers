import { afterEach, describe, expect, it, vi } from "vitest";
import { runEODComplianceSnapshot } from "./cronJobs";

describe("EOD compliance", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("records a protected-day skip on Sunday", async () => {
    const result = await runEODComplianceSnapshot(new Date("2026-07-12T12:00:00.000Z"));

    expect(result).toMatchObject({
      status: "skipped",
      dateKey: "2026-07-12",
      recordsProcessed: 0,
    });
    expect(result.detail).toContain("protected day");
  });

  it("fails closed when a working-day snapshot has no Trello credentials", async () => {
    vi.stubEnv("TrelloAPIKey", "");
    vi.stubEnv("TrelloAPIToken", "");

    await expect(runEODComplianceSnapshot(new Date("2026-07-13T12:00:00.000Z"))).rejects.toThrow(
      "Trello credentials are required",
    );
  });
});
