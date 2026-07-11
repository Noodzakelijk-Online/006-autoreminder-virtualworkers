import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { getDb } from "./db";
import { AssessmentFeedbackError, recordAssessmentFeedback, summarizeAssessmentCalibration } from "./aptlssFeedbackDb";

describe("APTLSS assessment feedback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calculates weighted accuracy and confidence calibration", () => {
    const result = summarizeAssessmentCalibration([
      { cardId: "a", engineVersion: "4.0.0", predictedState: "READY_TO_START", predictedConfidence: 90, verdict: "accurate" },
      { cardId: "b", engineVersion: "4.0.0", predictedState: "READY_TO_START", predictedConfidence: 80, verdict: "partial", correctedState: "NEEDS_RESTRUCTURING" },
      { cardId: "c", engineVersion: "4.0.0", predictedState: "OVERDUE", predictedConfidence: 85, verdict: "inaccurate", correctedState: "WAITING_FOR_ROBERT" },
    ]);

    expect(result).toMatchObject({
      sampleSize: 3,
      sampleStatus: "insufficient",
      accuracyScore: 50,
      highConfidenceMisses: 1,
      verdictCounts: { accurate: 1, partial: 1, inaccurate: 1 },
    });
    expect(result.byState.READY_TO_START).toMatchObject({ samples: 2, accuracyScore: 75 });
  });

  it("requires a corrected state for inaccurate feedback", async () => {
    vi.mocked(getDb).mockResolvedValue({} as never);
    await expect(recordAssessmentFeedback({
      assessmentId: 1,
      verdict: "inaccurate",
      createdBy: "owner",
    })).rejects.toThrow("corrected state");
  });

  it("rejects corrected states outside the APTLSS state machine", async () => {
    vi.mocked(getDb).mockResolvedValue({} as never);
    await expect(recordAssessmentFeedback({
      assessmentId: 1,
      verdict: "inaccurate",
      correctedState: "SOMETHING_ELSE",
      createdBy: "owner",
    })).rejects.toThrow("valid APTLSS state");
  });

  it("reports a clear database-unavailable error", async () => {
    vi.mocked(getDb).mockResolvedValue(null);
    await expect(recordAssessmentFeedback({
      assessmentId: 1,
      verdict: "accurate",
      createdBy: "owner",
    })).rejects.toBeInstanceOf(AssessmentFeedbackError);
  });
});
