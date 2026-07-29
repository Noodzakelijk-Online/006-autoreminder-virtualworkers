import { describe, expect, it } from "vitest";
import {
  addDaysToDateKey,
  assertDateKey,
  dateKeyInEat,
  dayOfWeekInEat,
  differenceInDateKeys,
  eatDateRangeUtc,
  eatDateSpanUtc,
  relevantSundayDateKey,
  timeKeyInEat,
  weekBoundsFromDateKey,
} from "../shared/eatTime";

describe("EAT calendar utilities", () => {
  it("rolls the EAT date forward three hours ahead of UTC", () => {
    const now = Date.parse("2026-07-12T21:30:00.000Z");
    expect(dateKeyInEat(now)).toBe("2026-07-13");
    expect(timeKeyInEat(now)).toBe("00:30");
    expect(dayOfWeekInEat(now)).toBe(1);
  });

  it("validates real date-only keys", () => {
    expect(assertDateKey("2028-02-29")).toBe("2028-02-29");
    expect(() => assertDateKey("2026-02-29")).toThrow("real calendar date");
    expect(() => assertDateKey("12/07/2026")).toThrow("YYYY-MM-DD");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("compares date-only keys without host timezone drift", () => {
    expect(differenceInDateKeys("2027-01-02", "2026-12-31")).toBe(2);
    expect(differenceInDateKeys("2026-07-10", "2026-07-12")).toBe(-2);
  });

  it("uses Monday through Sunday week bounds", () => {
    expect(weekBoundsFromDateKey("2026-07-12")).toEqual({ startDate: "2026-07-06", endDate: "2026-07-12" });
    expect(weekBoundsFromDateKey("2026-07-13")).toEqual({ startDate: "2026-07-13", endDate: "2026-07-19" });
  });

  it("selects today when it is Sunday and the next Sunday otherwise", () => {
    expect(relevantSundayDateKey(Date.parse("2026-07-12T08:00:00Z"))).toBe("2026-07-12");
    expect(relevantSundayDateKey(Date.parse("2026-07-13T08:00:00Z"))).toBe("2026-07-19");
  });

  it("returns half-open UTC boundaries for an EAT day", () => {
    const range = eatDateRangeUtc("2026-07-12");
    expect(range.startUtc.toISOString()).toBe("2026-07-11T21:00:00.000Z");
    expect(range.endUtc.toISOString()).toBe("2026-07-12T21:00:00.000Z");
  });

  it("returns half-open UTC boundaries for an inclusive EAT span", () => {
    const range = eatDateSpanUtc("2026-07-06", "2026-07-12");
    expect(range.startUtc.toISOString()).toBe("2026-07-05T21:00:00.000Z");
    expect(range.endUtc.toISOString()).toBe("2026-07-12T21:00:00.000Z");
  });

  it("rejects reversed date spans", () => {
    expect(() => eatDateSpanUtc("2026-07-12", "2026-07-06")).toThrow("before start date");
  });
});
