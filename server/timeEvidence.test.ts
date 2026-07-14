import { describe, expect, it } from "vitest";
import { DEFAULT_OPERATING_PROFILE } from "./operatingCalendar";
import { buildDailyTimeEvidence, type TimeEvidenceEntry } from "./timeEvidence";

const policy = { dailyGoalHours: 9, profile: DEFAULT_OPERATING_PROFILE, holidays: [] };

function entry(overrides: Partial<TimeEvidenceEntry> = {}): TimeEvidenceEntry {
  return {
    id: 1,
    cardId: "card-1",
    cardName: "Client work",
    cardUrl: "https://trello.com/c/card-1",
    boardName: "Client",
    listName: "DOING",
    startedAt: new Date("2026-07-13T05:00:00.000Z"),
    stoppedAt: new Date("2026-07-13T15:00:00.000Z"),
    durationSeconds: 10 * 3_600,
    ...overrides,
  };
}

describe("overtime evidence", () => {
  it("tracks daily excess over the configured workday target", () => {
    const result = buildDailyTimeEvidence("2026-07-13", [entry()], policy, new Date("2026-07-14T00:00:00.000Z"));

    expect(result).toMatchObject({ trackedSeconds: 36_000, targetSeconds: 32_400, overtimeSeconds: 3_600, entryCount: 1 });
  });

  it("treats all protected Sunday work as overtime", () => {
    const result = buildDailyTimeEvidence("2026-07-12", [entry({
      startedAt: new Date("2026-07-12T07:00:00.000Z"),
      stoppedAt: new Date("2026-07-12T09:00:00.000Z"),
      durationSeconds: 7_200,
    })], policy, new Date("2026-07-13T00:00:00.000Z"));

    expect(result).toMatchObject({ isWorkday: false, targetSeconds: 0, trackedSeconds: 7_200, overtimeSeconds: 7_200 });
  });

  it("splits a timer at EAT midnight instead of assigning it to its start day", () => {
    const overnight = entry({
      startedAt: new Date("2026-07-13T20:30:00.000Z"),
      stoppedAt: new Date("2026-07-13T22:30:00.000Z"),
      durationSeconds: 7_200,
    });

    expect(buildDailyTimeEvidence("2026-07-13", [overnight], policy, new Date("2026-07-14T22:00:00.000Z")).trackedSeconds).toBe(1_800);
    expect(buildDailyTimeEvidence("2026-07-14", [overnight], policy, new Date("2026-07-14T22:00:00.000Z")).trackedSeconds).toBe(5_400);
  });

  it("honors a capped credited duration when stoppedAt is later", () => {
    const capped = entry({
      startedAt: new Date("2026-07-13T05:00:00.000Z"),
      stoppedAt: new Date("2026-07-13T19:00:00.000Z"),
      durationSeconds: 12 * 3_600,
    });

    expect(buildDailyTimeEvidence("2026-07-13", [capped], policy, new Date("2026-07-14T00:00:00.000Z")).trackedSeconds).toBe(43_200);
  });

  it("caps a running timer at the calculation timestamp", () => {
    const running = entry({ stoppedAt: null, durationSeconds: null });
    const result = buildDailyTimeEvidence("2026-07-13", [running], policy, new Date("2026-07-13T07:00:00.000Z"));

    expect(result.trackedSeconds).toBe(7_200);
    expect(result.entries[0].active).toBe(true);
  });
});
