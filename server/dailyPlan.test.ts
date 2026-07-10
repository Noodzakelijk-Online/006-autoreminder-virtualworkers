import { describe, expect, it } from "vitest";
import { getSavedDailyPlan, parseDailyPlanPayload, summarizeLiveTrelloCards, toLegacyDailySchedule } from "./dailyPlan";

function minutes(time: string) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function overlaps(startA: string, endA: string, startB: string, endB: string) {
  return minutes(startA) < minutes(endB) && minutes(endA) > minutes(startB);
}

describe("daily plan normalization", () => {
  it("turns Sunday generated schedules into a protected off-day plan", () => {
    const payload = parseDailyPlanPayload(
      JSON.stringify({
        schedule: [
          {
            time: "09:00",
            startTime: "09:00",
            endTime: "10:30",
            cardId: "sunday-card",
            cardName: "Client work that should wait",
            action: "Do client work",
            priority: "High",
            notes: "",
          },
        ],
      }),
      "2026-07-05",
    );

    expect(payload).not.toBeNull();
    expect(payload?.constraints).toMatchObject({
      isWorkday: false,
      dayType: "off_day",
      offDayReason: "Sunday is Joyce's protected day off.",
    });
    expect(payload?.totalScheduledMinutes).toBe(0);
    expect(payload?.blocks).toHaveLength(1);
    expect(payload?.blocks[0]).toMatchObject({
      cardId: null,
      cardName: "Sunday Off",
      state: "OFF_DAY",
      flags: ["Off day", "Protected"],
    });
    expect(payload?.unscheduledCards).toEqual([
      expect.objectContaining({
        cardId: "sunday-card",
        cardName: "Client work that should wait",
        reason: expect.stringContaining("Sunday"),
      }),
    ]);
  });

  it("normalizes existing Sunday versioned plans so saved work cannot keep appearing on the day off", () => {
    const payload = parseDailyPlanPayload(
      JSON.stringify({
        version: 1,
        dateKey: "2026-07-05",
        generatedAt: "2026-07-05T06:00:00.000Z",
        generatedBy: "manual",
        blocks: [
          {
            id: "old-work",
            startTime: "08:00",
            endTime: "10:00",
            cardId: "old-card",
            cardName: "Old Sunday work",
            cardUrl: "https://trello.com/c/old-card",
            boardName: "Client",
            listName: "Doing",
            action: "Work",
            stepIds: [],
            priority: "High",
            score: 90,
            state: "READY_TO_WORK",
            status: "planned",
            notes: "",
            flags: [],
          },
        ],
        totalScheduledMinutes: 120,
        dailySummary: "Old Sunday plan",
        topPriority: "Old Sunday work",
        robertItems: [],
        unscheduledCards: [],
        planHealth: {
          workloadMinutes: 120,
          focusMinutes: 120,
          bufferMinutes: 0,
          overlaps: 0,
          gaps: 0,
          confidence: 80,
          status: "good",
        },
        constraints: {
          timezone: "EAT",
          workStart: "08:00",
          workEnd: "23:00",
          breaks: [],
        },
        audit: [],
      }),
      "2026-07-05",
    );

    expect(payload?.totalScheduledMinutes).toBe(0);
    expect(payload?.blocks[0].cardName).toBe("Sunday Off");
    expect(payload?.unscheduledCards[0]).toMatchObject({
      cardId: "old-card",
      reason: expect.stringContaining("Sunday"),
    });
    expect(payload?.audit.some((event) => event.action === "normalized_off_day")).toBe(true);
  });

  it("keeps protected break windows visible and prevents work from overlapping them", () => {
    const payload = parseDailyPlanPayload(
      JSON.stringify({
        schedule: [
          {
            time: "08:00",
            startTime: "08:00",
            endTime: "09:00",
            cardId: null,
            cardName: "Morning Triage",
            action: "Review inbox",
            priority: "Medium",
            notes: "",
          },
          {
            time: "11:30",
            startTime: "11:30",
            endTime: "13:00",
            cardId: "card-lunch-overlap",
            cardName: "Client delivery",
            action: "Finish client pass",
            priority: "High",
            notes: "",
          },
          {
            time: "17:00",
            startTime: "17:00",
            endTime: "18:15",
            cardId: "card-buffer-overlap",
            cardName: "Follow-up sweep",
            action: "Reply to pending messages",
            priority: "Medium",
            notes: "",
          },
        ],
      }),
      "2026-07-04",
    );

    expect(payload).not.toBeNull();
    const blocks = payload?.blocks ?? [];
    expect(blocks.some((block) => block.cardName === "Lunch break" && block.startTime === "12:00" && block.endTime === "13:00")).toBe(true);
    expect(blocks.some((block) => block.cardName === "Buffer / unplanned" && block.startTime === "17:30" && block.endTime === "19:00")).toBe(true);

    const workBlocks = blocks.filter((block) => block.cardId);
    for (const block of workBlocks) {
      expect(overlaps(block.startTime, block.endTime, "12:00", "13:00")).toBe(false);
      expect(overlaps(block.startTime, block.endTime, "17:30", "19:00")).toBe(false);
    }
  });

  it("rejects overlapping generated work blocks by moving later work forward", () => {
    const payload = parseDailyPlanPayload(
      JSON.stringify({
        schedule: [
          {
            time: "09:00",
            startTime: "09:00",
            endTime: "10:30",
            cardId: "card-a",
            cardName: "First client block",
            action: "Work first task",
            priority: "High",
            notes: "",
          },
          {
            time: "09:30",
            startTime: "09:30",
            endTime: "11:00",
            cardId: "card-b",
            cardName: "Second client block",
            action: "Work second task",
            priority: "Medium",
            notes: "",
          },
        ],
      }),
      "2026-07-04",
    );

    const workBlocks = (payload?.blocks ?? []).filter((block) => block.cardId);
    expect(workBlocks).toHaveLength(2);
    expect(minutes(workBlocks[1].startTime)).toBeGreaterThanOrEqual(minutes(workBlocks[0].endTime));
  });
});

describe("live Trello daily plan fallback", () => {
  it("turns live Trello cards into prioritized planner summaries when APTLSS plans are absent", () => {
    const summaries = summarizeLiveTrelloCards([
      {
        id: "todo-card",
        name: "Future admin",
        dateLastActivity: "2026-07-04T08:00:00.000Z",
        due: null,
        url: "https://trello.com/c/todo-card",
        list: { name: "To Do" },
        boardName: "Ops",
      },
      {
        id: "doing-card",
        name: "Critical doing work",
        dateLastActivity: "2026-06-01T08:00:00.000Z",
        due: "2026-07-04T08:00:00.000Z",
        url: "https://trello.com/c/doing-card",
        list: { name: "DOING" },
        boardName: "Client",
      },
      {
        id: "hold-card",
        name: "Blocked item",
        dateLastActivity: "2026-07-01T08:00:00.000Z",
        due: null,
        url: "https://trello.com/c/hold-card",
        list: { name: "ON-HOLD" },
        boardName: "Ops",
      },
    ]);

    expect(summaries).toHaveLength(3);
    expect(summaries[0]).toMatchObject({
      cardId: "doing-card",
      priorityTier: "HIGH",
      cardState: "IN_PROGRESS",
    });
    expect(summaries.find((summary) => summary.cardId === "hold-card")).toMatchObject({
      isBlocked: true,
      cardState: "WAITING_FOR_DEPENDENCY",
    });
  });
});

const itWithoutDb = process.env.DATABASE_URL ? it.skip : it;

describe("daily plan persistence readiness", () => {
  itWithoutDb("reports missing database before pretending a plan can load", async () => {
    await expect(getSavedDailyPlan("2026-07-04")).rejects.toThrow(
      "Database not available; daily plan persistence is disabled",
    );
  });
});

describe("legacy daily schedule compatibility", () => {
  it("adapts the versioned cockpit payload for old planMyDay callers", () => {
    const payload = parseDailyPlanPayload(
      JSON.stringify({
        schedule: [
          {
            time: "09:00",
            startTime: "09:00",
            endTime: "10:30",
            cardId: "card-a",
            cardName: "Client delivery",
            action: "Finish client pass",
            priority: "High",
            notes: "Use latest notes",
          },
        ],
        dailySummary: "Daily summary",
        topPriority: "Client delivery",
        robertItems: [{ cardId: "card-a", cardName: "Client delivery", decision: "Approve copy" }],
        unscheduledCards: [{ cardId: "card-b", cardName: "Admin", reason: "Can wait" }],
      }),
      "2026-07-04",
    );

    expect(payload).not.toBeNull();
    const legacy = toLegacyDailySchedule(payload!);

    expect(legacy.schedule.find((item) => item.cardId === "card-a")).toMatchObject({
      cardId: "card-a",
      cardName: "Client delivery",
      action: "Finish client pass",
      estimatedMinutes: 90,
      priority: "High",
      notes: "Use latest notes",
    });
    expect(legacy.dailySummary).toBe("Daily summary");
    expect(legacy.topPriority).toBe("Client delivery");
    expect(legacy.robertItems).toEqual([{ cardId: "card-a", cardName: "Client delivery", decision: "Approve copy" }]);
    expect(legacy.unscheduledCards).toEqual([{ cardId: "card-b", cardName: "Admin", reason: "Can wait" }]);
  });
});
