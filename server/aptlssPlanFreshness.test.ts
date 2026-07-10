import { describe, expect, it } from "vitest";
import { canReuseAptlssPlan } from "./aptlssPlanFreshness";

const nowMs = Date.parse("2026-07-10T12:00:00.000Z");
const base = {
  generatedAt: "2026-07-10T11:00:00.000Z",
  currentContextHash: "same",
  assessedContextHash: "same",
  assessedEngineVersion: "3.0.0",
  currentEngineVersion: "3.0.0",
  nextAssessmentAt: "2026-07-10T13:00:00.000Z",
  nowMs,
};

describe("APTLSS plan freshness", () => {
  it("reuses a current plan only when all freshness dimensions agree", () => {
    expect(canReuseAptlssPlan(base)).toBe(true);
  });

  it("invalidates on context, engine, reassessment, or age drift", () => {
    expect(canReuseAptlssPlan({ ...base, currentContextHash: "changed" })).toBe(false);
    expect(canReuseAptlssPlan({ ...base, currentEngineVersion: "3.1.0" })).toBe(false);
    expect(canReuseAptlssPlan({ ...base, nextAssessmentAt: "2026-07-10T12:00:00.000Z" })).toBe(false);
    expect(canReuseAptlssPlan({ ...base, generatedAt: "2026-07-10T07:00:00.000Z" })).toBe(false);
  });
});
