import { describe, expect, it } from "vitest";
import { getOperationalExceptionCounts } from "./operationalContext";

describe("operational exception counts", () => {
  it("uses live Trello as the shared cross-workspace truth", () => {
    expect(getOperationalExceptionCounts(
      {
        overdueCards: [{ id: "overdue" }, { id: "shared-doing" }],
        doingCards: [
          { id: "doing", updatedToday: false },
          { id: "shared-doing", updatedToday: false },
          { id: "updated", updatedToday: true },
        ],
        onHoldCards: [{ id: "on-hold" }, { id: "overdue" }],
      },
      { criticalToday: [1, 2, 3], waitingExternal: [1, 2, 3], onHoldCards: [{ onHoldClassification: "needs_escalation" }, { onHoldClassification: "needs_escalation" }] },
    )).toEqual({ critical: 2, waiting: 1, blocked: 1, source: "live" });
  });

  it("falls back to APTLSS only when live Trello is unavailable", () => {
    expect(getOperationalExceptionCounts(undefined, {
      criticalToday: [1],
      waitingExternal: [1, 2],
      onHoldCards: [{ onHoldClassification: "needs_escalation" }, { onHoldClassification: "waiting" }],
    })).toEqual({ critical: 1, waiting: 2, blocked: 1, source: "aptlss_fallback" });
  });
});
