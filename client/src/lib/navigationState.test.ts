import { describe, expect, it } from "vitest";
import { readTodayMode, serializeTodayMode } from "./navigationState";

describe("Today mode persistence", () => {
  it("restores a mode only for the same EAT date", () => {
    expect(readTodayMode("2026-07-13:plan", "2026-07-13", false)).toBe("plan");
    expect(readTodayMode("2026-07-12:plan", "2026-07-13", false)).toBe("queue");
    expect(readTodayMode("plan", "2026-07-13", false)).toBe("queue");
  });

  it("keeps Sunday protected and serializes the scoped value", () => {
    expect(readTodayMode("2026-07-13:queue", "2026-07-13", true)).toBe("plan");
    expect(serializeTodayMode("2026-07-13", "queue")).toBe("2026-07-13:queue");
  });
});
