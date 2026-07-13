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
    const summary = summarizeComplianceRange([
      { ...row("2026-07-13", 75), onHoldTotal: 2, onHoldReviewed: 1, doingTotal: 2, doingUpdated: 2, evidenceCount: 4, verificationStatus: "verified" },
      { ...row("2026-07-12", 100, false), onHoldTotal: 0, onHoldReviewed: 0, doingTotal: 0, doingUpdated: 0, evidenceCount: 0, verificationStatus: "verified_protected" },
      { ...row("2026-07-11", 100), onHoldTotal: 1, onHoldReviewed: 1, doingTotal: 1, doingUpdated: 1, evidenceCount: 2, verificationStatus: "verified" },
    ]);

    expect(summary).toEqual({
      average: 88,
      verifiedDays: 3,
      requiredDays: 2,
      protectedDays: 1,
      fullyCompliantDays: 1,
      expectedChecks: 6,
      passedChecks: 5,
      missingEvidence: 1,
      evidenceRecords: 6,
    });
  });
});
