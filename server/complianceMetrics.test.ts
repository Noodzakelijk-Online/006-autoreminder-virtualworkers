import { describe, expect, it } from "vitest";
import { calculateCompliancePercentage, calculateScheduledTargetSeconds } from "./complianceMetrics";

describe("compliance metrics", () => {
  it("combines Trello, communication, and email completion", () => {
    expect(calculateCompliancePercentage({
      onHoldTotal: 2,
      onHoldReviewed: 1,
      doingTotal: 2,
      doingUpdated: 2,
      messageTotal: 3,
      messageReplied: 2,
      emailTotal: 1,
      emailCompleted: 1,
    })).toBe(75);
  });

  it("calculates a worker target after protected breaks", () => {
    expect(calculateScheduledTargetSeconds({
      workStartTime: "08:00",
      workEndTime: "17:00",
      workingDays: [1, 2, 3, 4, 5],
      breaks: [
        { startTime: "12:00", durationMinutes: 60 },
        { startTime: "18:00", durationMinutes: 30 },
      ],
    }, "2026-07-30")).toBe(8 * 3600);
  });

  it("returns no target on a protected day", () => {
    expect(calculateScheduledTargetSeconds({
      workStartTime: "08:00",
      workEndTime: "17:00",
      workingDays: [1, 2, 3, 4, 5],
      breaks: [],
    }, "2026-08-02")).toBe(0);
  });
});
