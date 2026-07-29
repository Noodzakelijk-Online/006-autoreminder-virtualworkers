import { describe, expect, it } from "vitest";
import { formatEtaDuration, formatEtaRange } from "./OperationProgress";

describe("operation progress ETA formatting", () => {
  it("keeps short countdowns precise", () => {
    expect(formatEtaDuration(75)).toBe("1m 15s");
    expect(formatEtaDuration(3_900)).toBe("1h 5m");
    expect(formatEtaDuration(601_200)).toBe("6d 23h");
    expect(formatEtaRange(30, 45)).toBe("30s-45s remaining");
  });

  it("handles learning and nearly complete states", () => {
    expect(formatEtaRange(null, null)).toBe("Estimating completion time");
    expect(formatEtaRange(0, 8)).toBe("Under 10s remaining");
  });
});
