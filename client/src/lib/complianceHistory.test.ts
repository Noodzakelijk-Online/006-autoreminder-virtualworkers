import { describe, expect, it } from "vitest";
import {
  buildComplianceChartBuckets,
  buildEvidenceSlides,
  complianceRangeAverage,
  selectComplianceRange,
  summarizeComplianceRange,
} from "./complianceHistory";

const row = (snapshotDate: string, compliancePct: number, required = true) => ({ snapshotDate, compliancePct, required });

describe("compliance history ranges", () => {
  const history = [
    row("2026-07-13", 100),
    row("2026-07-12", 100, false),
    row("2026-07-11", 50),
    row("2026-06-20", 80),
  ];

  it("selects an exact rolling calendar horizon", () => {
    expect(selectComplianceRange(history, 7).map((item) => item.snapshotDate)).toEqual([
      "2026-07-13",
      "2026-07-12",
      "2026-07-11",
    ]);
  });

  it("excludes protected days from averages", () => {
    expect(complianceRangeAverage(history.slice(0, 3))).toBe(75);
  });

  it("aggregates quarter charts by week", () => {
    const buckets = buildComplianceChartBuckets(history, "week");
    expect(buckets.at(-1)).toMatchObject({ id: "2026-07-13", pct: 100, days: 1 });
  });

  it("creates newest-first month slides while preserving every daily row", () => {
    const slides = buildEvidenceSlides(history, "month");
    expect(slides.map((slide) => slide.id)).toEqual(["2026-07", "2026-06"]);
    expect(slides.flatMap((slide) => slide.rows)).toHaveLength(history.length);
    expect(slides[0]).toMatchObject({ average: 75, verifiedDays: 3, requiredDays: 2 });
  });

  it("builds reconciled performance signals from verified daily facts", () => {
    const communication = {
      messageTotal: 0,
      messageReplied: 0,
      messageNeedsClarification: 0,
      emailTotal: 0,
      emailCompleted: 0,
      emailNeedsClarification: 0,
      clarificationOpen: 0,
      trackedSeconds: 0,
      scheduledTargetSeconds: 0,
      overtimeSeconds: 0,
      timeEntryCount: 0,
    };
    const summary = summarizeComplianceRange([
      { ...row("2026-07-13", 75), ...communication, messageTotal: 2, messageReplied: 1, messageNeedsClarification: 1, clarificationOpen: 1, trackedSeconds: 36_000, scheduledTargetSeconds: 32_400, overtimeSeconds: 3_600, timeEntryCount: 4, onHoldTotal: 2, onHoldReviewed: 1, doingTotal: 2, doingUpdated: 2, evidenceCount: 10, verificationStatus: "needs_clarification" },
      { ...row("2026-07-12", 100, false), ...communication, onHoldTotal: 0, onHoldReviewed: 0, doingTotal: 0, doingUpdated: 0, evidenceCount: 0, verificationStatus: "verified_protected" },
      { ...row("2026-07-11", 100), ...communication, emailTotal: 1, emailCompleted: 1, onHoldTotal: 1, onHoldReviewed: 1, doingTotal: 1, doingUpdated: 1, evidenceCount: 3, verificationStatus: "verified" },
    ]);

    expect(summary).toEqual({
      average: 88,
      verifiedDays: 2,
      requiredDays: 2,
      protectedDays: 1,
      fullyCompliantDays: 1,
      expectedChecks: 8,
      passedChecks: 7,
      missingEvidence: 1,
      evidenceRecords: 13,
      openClarifications: 1,
      messageResponseRate: 100,
      messagesReplied: 1,
      messagesExpected: 1,
      emailCompletionRate: 100,
      emailsCompleted: 1,
      emailsExpected: 1,
      trackedSeconds: 36_000,
      scheduledTargetSeconds: 32_400,
      overtimeSeconds: 3_600,
      overtimeDays: 1,
      timeEntryCount: 4,
    });
  });
});
