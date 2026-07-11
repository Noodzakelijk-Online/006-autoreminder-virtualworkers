import { describe, expect, it } from "vitest";
import { evaluateAptlssPlanQuality } from "./aptlssPlanQuality";

describe("APTLSS plan quality critic", () => {
  it("passes an executable, measurable, approval-safe plan", () => {
    const result = evaluateAptlssPlanQuality({
      action: "Draft the first three launch-email sections",
      steps: [
        { number: 1, text: "Draft the first three launch-email sections", estimatedMinutes: 45, category: "internal_work", requiresRobert: false, completionCriteria: "Three draft sections are saved in the linked document.", riskIfSkipped: "The client review cannot begin." },
        { number: 2, text: "Verify every link and acceptance requirement", estimatedMinutes: 15, category: "verification", requiresRobert: false, completionCriteria: "All links pass and requirements have recorded evidence.", riskIfSkipped: "A broken launch email may reach the client." },
      ],
    });
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("hard-fails a vague plan with no executable or verification step", () => {
    const result = evaluateAptlssPlanQuality({
      action: "Review",
      steps: [{ number: 1, text: "Review", estimatedMinutes: 15, category: "robert_decision", requiresRobert: true }],
    });
    expect(result.hardGateFailed).toBe(true);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["vague_next_action", "no_executable_step", "missing_verification"]));
  });

  it("detects an approval boundary violation", () => {
    const result = evaluateAptlssPlanQuality({
      action: "Approve the client payment",
      steps: [
        { number: 1, text: "Approve the client payment", estimatedMinutes: 10, category: "internal_work", requiresRobert: false, completionCriteria: "Payment is approved by the owner.", riskIfSkipped: "The invoice remains unpaid." },
        { number: 2, text: "Verify the approval record", estimatedMinutes: 5, category: "verification", requiresRobert: false, completionCriteria: "Approval evidence is stored with the card.", riskIfSkipped: "The audit trail is incomplete." },
      ],
    });
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "approval_boundary", severity: "error" }));
  });
});
