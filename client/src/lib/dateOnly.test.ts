import { describe, expect, it } from "vitest";
import { formatShortDate, formatWeekChartLabel, toDateOnlyKey } from "./dateOnly";

describe("date-only formatting", () => {
  it("normalizes database strings and Date values", () => {
    expect(toDateOnlyKey("2026-07-06T00:00:00.000Z")).toBe("2026-07-06");
    expect(toDateOnlyKey(new Date("2026-07-06T00:00:00.000Z"))).toBe("2026-07-06");
  });

  it("never emits Invalid Date labels", () => {
    expect(formatShortDate("not-a-date")).toBe("-");
    expect(formatWeekChartLabel(undefined)).toBe("Week unknown");
    expect(formatWeekChartLabel("2026-07-06")).toMatch(/^Wk \w+ 6$/);
  });
});
