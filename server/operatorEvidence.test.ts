import { describe, expect, it } from "vitest";
import { buildOperatorEvidenceSummary } from "./operatorEvidence";

const forecast = {
  forecast: {
    calibratedP50Minutes: 480,
    calibratedP90Minutes: 864,
    calibrationSampleSize: 0,
    uncertainty: "high",
  },
  confidenceProfile: {
    targetScore: 99,
    ceiling: 88,
    gapToTarget: 11,
    blockers: ["Complete two timed cards."],
  },
};

describe("buildOperatorEvidenceSummary", () => {
  it("separates live Trello evidence from missing cross-source corroboration", () => {
    const result = buildOperatorEvidenceSummary({
      rawUncertainties: ["No Gmail, Drive, communication, or retained Trello evidence is linked to this card yet."],
      assessmentEvidence: [{
        key: "due",
        source: "trello",
        value: "2026-06-11",
        quality: "strong",
        detail: "Due date has passed.",
      }],
      intelligence: forecast,
      linkedSourceCounts: {},
      completedTimeSamples: 0,
    });

    expect(result.sources[0]).toMatchObject({ key: "trello", status: "live", count: 1 });
    expect(result.issues[0].detail).toContain("live assessment signal");
    expect(result.issues[0].detail).not.toContain("No Trello evidence");
  });

  it("removes duplicate raw forecast uncertainties and returns one resolution", () => {
    const result = buildOperatorEvidenceSummary({
      rawUncertainties: [
        "No completed-work sample is available to calibrate the remaining-time estimate.",
        "The completion forecast has a wide uncertainty range.",
      ],
      assessmentEvidence: [],
      intelligence: forecast,
      linkedSourceCounts: { gmail: 1, google_drive: 1, communication: 1, trello: 1 },
      completedTimeSamples: 0,
    });

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ id: "forecast-calibration", severity: "high" });
    expect(result.issues[0].detail).toContain("P50 8h");
    expect(result.issues[0].detail).toContain("P90 14h 24m");
  });

  it("reports complete source coverage and calibrated time without issues", () => {
    const result = buildOperatorEvidenceSummary({
      rawUncertainties: [],
      assessmentEvidence: [],
      intelligence: {
        forecast: {
          calibratedP50Minutes: 60,
          calibratedP90Minutes: 75,
          calibrationSampleSize: 3,
          uncertainty: "low",
        },
      },
      linkedSourceCounts: { gmail: 1, google_drive: 2, communication: 3, trello: 1 },
      completedTimeSamples: 3,
    });

    expect(result.sources.every((source) => source.status === "linked")).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
