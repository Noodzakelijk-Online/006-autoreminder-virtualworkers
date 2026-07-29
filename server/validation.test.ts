import { describe, expect, it } from "vitest";
import {
  dateKeySchema,
  payWeekRangeSchema,
  sundayDateKeySchema,
  timerStartInputSchema,
  weekDateRangeSchema,
} from "./validation";

describe("server input validation", () => {
  it("accepts valid calendar dates and rejects impossible ones", () => {
    expect(dateKeySchema.parse("2028-02-29")).toBe("2028-02-29");
    expect(() => dateKeySchema.parse("2026-02-29")).toThrow();
  });

  it("requires weekly reset dates to be Sundays", () => {
    expect(sundayDateKeySchema.parse("2026-07-12")).toBe("2026-07-12");
    expect(() => sundayDateKeySchema.parse("2026-07-13")).toThrow("Sunday");
  });

  it("requires an exact EAT Monday-through-Sunday range", () => {
    expect(weekDateRangeSchema.parse({ startDate: "2026-07-06", endDate: "2026-07-12" })).toBeTruthy();
    expect(() => weekDateRangeSchema.parse({ startDate: "2026-07-06", endDate: "2026-07-19" })).toThrow("one Monday-through-Sunday week");
    expect(() => payWeekRangeSchema.parse({ weekStart: "2026-07-07", weekEnd: "2026-07-12" })).toThrow("Monday");
  });

  it("bounds timer card metadata and validates its URL", () => {
    expect(timerStartInputSchema.parse({ cardId: "card-1", cardName: "Task", cardUrl: "https://trello.com/c/card-1" })).toMatchObject({ boardName: "Unknown Board", listName: "Unknown" });
    expect(() => timerStartInputSchema.parse({ cardId: "card-1", cardName: "Task", cardUrl: "not-a-url" })).toThrow();
  });
});
