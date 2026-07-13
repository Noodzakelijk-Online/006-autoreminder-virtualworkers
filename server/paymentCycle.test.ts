import { describe, expect, it } from "vitest";
import { buildCurrentPaymentCycleRange, buildNextPaymentCycleRange } from "./db";

describe("payment cycle bootstrap", () => {
  it("builds a fourteen-day cycle ending on the current Friday", () => {
    expect(buildCurrentPaymentCycleRange("2026-07-12")).toEqual({
      cycleStart: "2026-07-04",
      cycleEnd: "2026-07-17",
    });
  });

  it("uses today when initialization occurs on Friday", () => {
    expect(buildCurrentPaymentCycleRange("2026-07-17")).toEqual({
      cycleStart: "2026-07-04",
      cycleEnd: "2026-07-17",
    });
  });

  it("starts the next cycle after the prior pay date and ends on Friday", () => {
    expect(buildNextPaymentCycleRange("2026-07-17")).toEqual({
      cycleStart: "2026-07-18",
      cycleEnd: "2026-07-31",
    });
  });
});
