import { describe, expect, it } from "vitest";
import { buildAptlssRuntimeAnalysis, calculateEffortCalibration } from "./aptlssRuntime";

const NOW = Date.parse("2026-07-11T12:00:00.000Z");

describe("APTLSS runtime intelligence", () => {
  it("calibrates estimates from completed cards using a robust median", () => {
    const calibration = calculateEffortCalibration(
      [
        { cardId: "a", status: "complete", estimatedMinutes: 60 },
        { cardId: "b", status: "complete", estimatedMinutes: 60 },
        { cardId: "outlier", status: "complete", estimatedMinutes: 10 },
      ],
      [
        { cardId: "a", startedAt: NOW - 1000, stoppedAt: NOW, durationSeconds: 5_400 },
        { cardId: "b", startedAt: NOW - 1000, stoppedAt: NOW, durationSeconds: 5_400 },
        { cardId: "outlier", startedAt: NOW - 1000, stoppedAt: NOW, durationSeconds: 100_000 },
      ],
    );
    expect(calibration.factor).toBe(1.5);
    expect(calibration.sampleSize).toBe(2);
  });

  it("prefers direct APTLSS step links over card-level allocation", () => {
    const calibration = calculateEffortCalibration(
      [
        { id: 11, cardId: "a", status: "complete", estimatedMinutes: 30 },
        { id: 12, cardId: "a", status: "open", estimatedMinutes: 90 },
      ],
      [
        { cardId: "a", aptlssStepId: 11, startedAt: NOW - 3_600_000, stoppedAt: NOW, durationSeconds: 2_700 },
        { cardId: "a", startedAt: NOW - 10_000, stoppedAt: NOW, durationSeconds: 18_000 },
      ],
    );
    expect(calibration).toMatchObject({ factor: 1.5, sampleSize: 1 });
  });

  it("combines timer, reply, decision, schedule, overrun, and forecast evidence", () => {
    const result = buildAptlssRuntimeAnalysis({
      cardIds: ["a"],
      nowMs: NOW,
      steps: [
        { cardId: "a", status: "complete", estimatedMinutes: 30 },
        { cardId: "a", status: "open", estimatedMinutes: 60, requiresRobert: true, createdAt: NOW - 30 * 3_600_000 },
        { cardId: "sample", status: "complete", estimatedMinutes: 30 },
      ],
      timeEntries: [
        { cardId: "a", startedAt: NOW - 2 * 3_600_000, stoppedAt: NOW - 3_600_000, durationSeconds: 9_000 },
        { cardId: "sample", startedAt: NOW - 3_600_000, stoppedAt: NOW, durationSeconds: 2_700 },
      ],
      activeTimers: [{ cardId: "a", startedAt: NOW - 20 * 60_000, stoppedAt: null }],
      replyThreads: [{ cardId: "a", status: "pending", lastNonJoyceMsgAt: NOW - 25 * 3_600_000 }],
      scheduleBlocks: [{ cardId: "a", startTime: "09:00", endTime: "10:30", status: "planned" }],
    });
    const card = result.byCard.get("a")!;
    expect(result.calibration).toMatchObject({ sampleSize: 1, factor: 1.5 });
    expect(card.runtime).toMatchObject({
      activeTimer: true,
      replyOverdue: true,
      decisionStale: true,
      scheduledToday: true,
      scheduledMinutes: 90,
      estimateOverrun: true,
    });
    expect(card.forecast.calibratedP90Minutes).toBeGreaterThan(card.forecast.calibratedP50Minutes);
  });
});
