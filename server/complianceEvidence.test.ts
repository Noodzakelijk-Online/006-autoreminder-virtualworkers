import { describe, expect, it } from "vitest";
import { buildComplianceEvidence } from "./complianceEvidence";

const card = (id: string) => ({ id, name: id, url: `https://trello.example/${id}` });

describe("compliance evidence", () => {
  it("counts only explicitly checked ON-HOLD cards as reviewed", () => {
    const result = buildComplianceEvidence({
      doingCards: [card("doing-updated"), card("doing-missed")],
      onHoldCards: [card("hold-reviewed"), card("hold-missed")],
      commentedCardIds: new Set(["doing-updated"]),
      reviewedOnHoldIds: new Set(["hold-reviewed"]),
    });

    expect(result.doingMissed.map((item) => item.id)).toEqual(["doing-missed"]);
    expect(result.onHoldReviewed.map((item) => item.id)).toEqual(["hold-reviewed"]);
    expect(result.onHoldMissed.map((item) => item.id)).toEqual(["hold-missed"]);
    expect(result.compliancePct).toBe(50);
  });

  it("returns potential review impact without mutating a pay record", () => {
    const result = buildComplianceEvidence({
      doingCards: [card("one"), card("two")],
      onHoldCards: [],
      commentedCardIds: new Set(),
      reviewedOnHoldIds: new Set(),
    });

    expect(result.potentialD1Instances).toBe(2);
    expect(result.estimatedReviewImpact).toBe(10);
  });
});
