import { describe, expect, it } from "vitest";
import { selectWorkQueueNextAction } from "./aptlssWorkQueue";

describe("APTLSS Work Queue next-action selection", () => {
  it("uses the open Robert decision instead of a generic fallback action", () => {
    expect(selectWorkQueueNextAction({
      planAction: "Define the next concrete deliverable from the current Trello context.",
      primaryState: "WAITING_FOR_ROBERT",
      actionability: "decision",
      recommendations: ["Present Robert with one bounded decision."],
      openRobertStep: { title: "Choose travel API", recommendedDecision: "Approve Google Routes API for the first version." },
    })).toBe("Prepare Robert decision: Approve Google Routes API for the first version.");
  });

  it("prefers assessment guidance for blocked and repair states", () => {
    expect(selectWorkQueueNextAction({
      planAction: "Define the next concrete deliverable for the card.",
      primaryState: "BLOCKED_BY_OTHER_CARD",
      actionability: "blocked",
      recommendations: ["Resolve the named dependency before restarting execution."],
    })).toBe("Resolve the named dependency before restarting execution.");
  });

  it("preserves a concrete executable plan action", () => {
    expect(selectWorkQueueNextAction({
      planAction: "Attach the signed contract and mark checklist step 2 complete.",
      primaryState: "IN_PROGRESS",
      actionability: "actionable",
      recommendations: ["Continue execution."],
    })).toBe("Attach the signed contract and mark checklist step 2 complete.");
  });
});
