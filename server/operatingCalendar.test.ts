import { describe, expect, it } from "vitest";
import { DEFAULT_OPERATING_PROFILE, resolveOperatingDay } from "./operatingCalendar";

describe("operating calendar", () => {
  it("protects configured weekly non-working days", () => {
    expect(resolveOperatingDay("2026-07-19", DEFAULT_OPERATING_PROFILE, [])).toEqual({
      isWorkday: false,
      reason: "Sunday is Joyce's protected day off.",
      source: "weekly_schedule",
    });
  });

  it("protects a holiday that falls on a normal working day", () => {
    expect(resolveOperatingDay("2026-07-20", DEFAULT_OPERATING_PROFILE, [{
      dateKey: "2026-07-20",
      name: "Public holiday",
      kind: "holiday",
      source: "manual",
      active: true,
    }])).toMatchObject({ isWorkday: false, reason: "Public holiday", source: "holiday" });
  });

  it("allows an explicitly configured exceptional workday", () => {
    expect(resolveOperatingDay("2026-07-19", DEFAULT_OPERATING_PROFILE, [{
      dateKey: "2026-07-19",
      name: "Approved launch coverage",
      kind: "exceptional_workday",
      source: "policy",
      active: true,
    }])).toMatchObject({
      isWorkday: true,
      reason: "Approved launch coverage",
      source: "exceptional_workday",
    });
  });
});
