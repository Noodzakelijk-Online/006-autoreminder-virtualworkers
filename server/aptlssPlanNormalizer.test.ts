import { describe, expect, it } from "vitest";
import { normalizeGeneratedAptlssPlan } from "./aptlssPlanNormalizer";
import type { AptlssAssessment } from "./aptlssAssessment";

const assessment = {
  engineVersion: "3.0.0",
  cardId: "card-1",
  contextHash: "hash",
  primaryState: "WAITING_FOR_ROBERT",
  stateReason: "Approval required",
  secondarySignals: ["overdue"],
  actionability: "decision",
  priorityScore: 82,
  priorityTier: "CRITICAL",
  priorityBreakdown: {},
  confidenceScore: 55,
  confidenceBand: "low",
  confidenceReason: "Limited evidence",
  evidenceCoverage: {},
  evidence: [],
  uncertainties: ["Missing due evidence"],
  recommendations: ["Ask Robert"],
  lastMeaningfulProgressAt: null,
  daysSinceMeaningfulProgress: 2,
  nextAssessmentAt: "2026-07-10T13:00:00.000Z",
  assessedAt: "2026-07-10T12:00:00.000Z",
  trigger: "generation",
} satisfies AptlssAssessment;

describe("APTLSS plan normalization", () => {
  it("caps model confidence to evidence confidence", () => {
    const result = normalizeGeneratedAptlssPlan({ confidenceScore: 95, steps: [] }, assessment, "ai");
    expect(result.confidenceScore).toBe(60);
    expect(result.escalationCategory).toBeNull();
    expect(result.generation.warnings).toContain("Model confidence was capped by available evidence.");
  });

  it("forces approval-sensitive steps behind Robert", () => {
    const result = normalizeGeneratedAptlssPlan({
      steps: [{ text: "Approve the client payment", estimatedMinutes: 1, category: "internal_work", requiresRobert: false }],
    }, assessment, "ai");
    expect(result.steps[0]).toMatchObject({ requiresRobert: true, category: "robert_decision", estimatedMinutes: 5 });
    expect(result.robertDecision).not.toBeUndefined();
  });

  it("deduplicates steps and adds a verification gate", () => {
    const result = normalizeGeneratedAptlssPlan({
      steps: [
        { text: "Draft update", category: "internal_work" },
        { text: "Draft   update", category: "internal_work" },
      ],
    }, { ...assessment, actionability: "actionable", primaryState: "READY_TO_START" }, "deterministic");
    expect(result.steps.filter((step) => step.text.startsWith("Draft"))).toHaveLength(1);
    expect(result.steps.some((step) => step.category === "verification")).toBe(true);
  });
});
