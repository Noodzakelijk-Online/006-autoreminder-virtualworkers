import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeDailyPlanGeneration,
  failDailyPlanGeneration,
  getDailyPlanGenerationProgress,
  resetDailyPlanGenerationProgressForTests,
  startDailyPlanGeneration,
  updateDailyPlanGeneration,
} from "./dailyPlanGenerationProgress";

describe("daily plan generation progress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T08:00:00.000Z"));
    resetDailyPlanGenerationProgressForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports real planner phases with elapsed time and an ETA range", () => {
    const started = startDailyPlanGeneration("2026-07-29");
    expect(started).toMatchObject({
      status: "running",
      phase: "preflight",
      currentStep: 1,
      totalSteps: 8,
      percent: 4,
    });

    vi.advanceTimersByTime(5_000);
    updateDailyPlanGeneration("2026-07-29", started.runId!, "ai_planning");
    vi.advanceTimersByTime(12_000);

    const progress = getDailyPlanGenerationProgress("2026-07-29");
    expect(progress).toMatchObject({
      status: "running",
      phase: "ai_planning",
      currentStep: 5,
      percent: 52,
      elapsedSeconds: 17,
      etaLowerSeconds: 9,
      etaUpperSeconds: 157,
      isTakingLongerThanExpected: false,
    });
  });

  it("ignores updates from a superseded run", () => {
    const first = startDailyPlanGeneration("2026-07-29");
    const second = startDailyPlanGeneration("2026-07-29");

    expect(updateDailyPlanGeneration("2026-07-29", first.runId!, "persisting")).toBeNull();
    expect(getDailyPlanGenerationProgress("2026-07-29").runId).toBe(second.runId);
    expect(getDailyPlanGenerationProgress("2026-07-29").phase).toBe("preflight");
  });

  it("records successful completion", () => {
    const started = startDailyPlanGeneration("2026-07-29");
    updateDailyPlanGeneration("2026-07-29", started.runId!, "persisting");
    const completed = completeDailyPlanGeneration("2026-07-29", started.runId!);

    expect(completed).toMatchObject({
      status: "completed",
      phase: "complete",
      percent: 100,
      currentStep: 8,
      etaUpperSeconds: 0,
    });
  });

  it("records a failed run without exposing it as active", () => {
    const started = startDailyPlanGeneration("2026-07-29");
    const failed = failDailyPlanGeneration("2026-07-29", started.runId!, new Error("Trello unavailable"));

    expect(failed).toMatchObject({
      status: "failed",
      phase: "failed",
      errorMessage: "Trello unavailable",
      etaUpperSeconds: 0,
    });
  });
});
