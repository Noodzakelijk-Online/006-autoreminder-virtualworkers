import { describe, expect, it } from "vitest";
import { inferNonRobertStepCategory, stepRequiresRobertApproval } from "./aptlssApproval";

describe("APTLSS Robert approval boundaries", () => {
  it("does not turn every step into a decision because the card title contains budget", () => {
    expect(stepRequiresRobertApproval({
      title: "Verify Budget repair explainer against the acceptance criteria.",
      category: "verification",
      requiresRobert: false,
      completionCriteria: "A QA note confirms the result.",
    })).toBe(false);
    expect(stepRequiresRobertApproval({
      title: "Verify Ask permission fiscal reduction against the acceptance criteria.",
      category: "verification",
      requiresRobert: false,
    }, { explicitFalseWins: true })).toBe(false);
  });

  it("accepts explicit decision metadata and a recommended outcome", () => {
    expect(stepRequiresRobertApproval({ category: "robert_decision", requiresRobert: false })).toBe(true);
    expect(stepRequiresRobertApproval({ title: "Get Robert decision for the contract.", recommendedDecision: "Approve option A." })).toBe(true);
  });

  it("strictly repairs legacy false positives without trusting their corrupted flags", () => {
    expect(stepRequiresRobertApproval({
      title: "Post the next status update for the budget card.",
      category: "robert_decision",
      requiresRobert: true,
    }, { trustCategory: false, trustExplicit: false })).toBe(false);
    expect(stepRequiresRobertApproval({
      title: "Get Robert decision for the budget card.",
      category: "robert_decision",
      requiresRobert: true,
    }, { trustCategory: false, trustExplicit: false })).toBe(true);
  });

  it("restores useful non-decision categories during repair", () => {
    expect(inferNonRobertStepCategory("Verify the result against acceptance criteria")).toBe("verification");
    expect(inferNonRobertStepCategory("Post the next status update")).toBe("communication");
    expect(inferNonRobertStepCategory("Complete the smallest useful progress step")).toBe("internal_work");
  });
});
