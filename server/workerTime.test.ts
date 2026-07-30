import { describe, expect, it } from "vitest";
import { dateKeyInTimeZone, dayOfWeekInTimeZone, formatWorkerDate, timeKeyInTimeZone } from "../shared/workerTime";

describe("worker-local time", () => {
  const instant = new Date("2026-07-30T22:30:00.000Z");

  it("uses each worker's timezone for date, time, and weekday", () => {
    expect(dateKeyInTimeZone(instant, "Africa/Nairobi")).toBe("2026-07-31");
    expect(timeKeyInTimeZone(instant, "Africa/Nairobi")).toBe("01:30");
    expect(dayOfWeekInTimeZone(instant, "Africa/Nairobi")).toBe(5);
    expect(dateKeyInTimeZone(instant, "America/New_York")).toBe("2026-07-30");
  });

  it("falls back to UTC for an invalid timezone", () => {
    expect(dateKeyInTimeZone(instant, "Not/AZone")).toBe("2026-07-30");
    expect(formatWorkerDate(instant, "Not/AZone")).toContain("30");
  });
});
