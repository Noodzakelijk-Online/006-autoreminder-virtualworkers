import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calibrateMaintenanceProgressEta,
  completeMaintenanceJobProgress,
  estimateTypicalDurationMs,
  failMaintenanceJobProgress,
  getMaintenanceJobProgress,
  resetMaintenanceJobProgressForTests,
  startMaintenanceJobProgress,
  trackMaintenanceJobProgress,
  updateMaintenanceJobProgress,
} from "./maintenanceJobProgress";

describe("maintenance job progress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T18:00:00.000Z"));
    resetMaintenanceJobProgressForTests();
  });

  afterEach(() => vi.useRealTimers());

  it("tracks EOD evidence phases and ETA", () => {
    const started = startMaintenanceJobProgress("eod_compliance");
    updateMaintenanceJobProgress("eod_compliance", started.runId!, "fact_check");
    vi.advanceTimersByTime(15_000);

    expect(getMaintenanceJobProgress().eodCompliance).toMatchObject({
      status: "running",
      phase: "fact_check",
      percent: 18,
      currentStep: 2,
      totalSteps: 5,
      elapsedSeconds: 15,
      etaUpperSeconds: 150,
    });
  });

  it("tracks weekly analysis independently from EOD", () => {
    const eod = startMaintenanceJobProgress("eod_compliance");
    const weekly = startMaintenanceJobProgress("weekly_analysis");
    updateMaintenanceJobProgress("weekly_analysis", weekly.runId!, "ai_review");
    completeMaintenanceJobProgress("eod_compliance", eod.runId!);

    const progress = getMaintenanceJobProgress();
    expect(progress.eodCompliance.status).toBe("completed");
    expect(progress.weeklyAnalysis).toMatchObject({
      status: "running",
      phase: "ai_review",
      percent: 55,
      currentStep: 4,
      totalSteps: 6,
    });
  });

  it("tracks the full lifecycle for an interval-started run", async () => {
    await trackMaintenanceJobProgress("reply_monitor", async (report) => {
      report("collecting");
      report("analyzing", "Checked 12 threads.");
    });

    expect(getMaintenanceJobProgress().replyMonitor).toMatchObject({
      status: "completed",
      phase: "complete",
      percent: 100,
      errorMessage: null,
    });
  });

  it("does not replace a running job's progress", async () => {
    const started = startMaintenanceJobProgress("weekly_analysis");

    await expect(trackMaintenanceJobProgress("weekly_analysis", async () => undefined))
      .rejects.toThrow("weekly analysis is already running");
    expect(getMaintenanceJobProgress().weeklyAnalysis.runId).toBe(started.runId);

    failMaintenanceJobProgress("weekly_analysis", started.runId!, new Error("stopped for test"));
  });

  it("calibrates a running ETA from successful historical durations", () => {
    const started = startMaintenanceJobProgress("reply_monitor");
    vi.advanceTimersByTime(15_000);
    const running = getMaintenanceJobProgress().replyMonitor;

    expect(calibrateMaintenanceProgressEta(running, 20_000)).toMatchObject({
      etaLowerSeconds: 0,
      etaUpperSeconds: 10,
      isTakingLongerThanExpected: false,
    });
    expect(calibrateMaintenanceProgressEta(running, 8_000)).toMatchObject({
      etaLowerSeconds: 0,
      etaUpperSeconds: 0,
      isTakingLongerThanExpected: true,
    });
    expect(calibrateMaintenanceProgressEta(started, null)).toEqual(started);
  });

  it("uses the median successful duration so outliers do not distort the ETA", () => {
    expect(estimateTypicalDurationMs([1_000, 1_100, 1_200, 90_000])).toBe(1_150);
    expect(estimateTypicalDurationMs([1_000, Number.NaN, -1, 2_000, 3_000])).toBe(2_000);
    expect(estimateTypicalDurationMs([])).toBeNull();
  });
});
