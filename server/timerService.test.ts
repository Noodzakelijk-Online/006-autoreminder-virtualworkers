import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  autoStopAllRunningTimers: vi.fn(),
  startTimer: vi.fn(),
  stopTimer: vi.fn(),
}));
vi.mock("./aptlssReassessment", () => ({ queueCardReassessment: vi.fn() }));
vi.mock("./sse", () => ({ broadcast: vi.fn() }));
vi.mock("./timeEvidence", () => ({
  refreshStoredComplianceTimeEvidence: vi
    .fn()
    .mockResolvedValue({ daysCalculated: 1 }),
}));
vi.mock("./dailyPlan", () => ({
  getSavedDailyPlan: vi.fn().mockResolvedValue(null),
}));
vi.mock("./timeAccountability", () => ({
  recordTimeEntryEvent: vi.fn().mockResolvedValue(undefined),
  markTimeDayNeedsReview: vi.fn().mockResolvedValue(undefined),
  correctTimeEntry: vi.fn(),
  voidTimeEntry: vi.fn(),
  createManualTimeEntry: vi.fn(),
}));

const db = await import("./db");
const { queueCardReassessment } = await import("./aptlssReassessment");
const { broadcast } = await import("./sse");
const { refreshStoredComplianceTimeEvidence } = await import("./timeEvidence");
const accountability = await import("./timeAccountability");
const dailyPlan = await import("./dailyPlan");
const {
  autoStopManagedTimers,
  deleteManagedTimeEntry,
  startManagedTimer,
  stopManagedTimer,
  updateManagedTimeEntry,
} = await import("./timerService");

describe("managed timer service", () => {
  afterEach(() => vi.clearAllMocks());

  it("invalidates clients and reassesses the new and automatically stopped cards", async () => {
    vi.mocked(db.startTimer).mockResolvedValue({
      id: 4,
      cardId: "new-card",
      cardName: "New card",
      startedAt: new Date("2026-07-12T08:00:00Z"),
      stoppedEntries: [
        {
          id: 3,
          cardId: "old-card",
          startedAt: new Date("2026-07-12T07:00:00Z"),
          stoppedAt: new Date("2026-07-12T08:00:00Z"),
        },
      ],
      stoppedCardIds: ["old-card", "old-card"],
    });

    await startManagedTimer({
      cardId: "new-card",
      cardName: "New card",
      cardUrl: "https://trello.com/c/new-card",
      boardName: "Board",
      listName: "Doing",
    });

    expect(queueCardReassessment).toHaveBeenCalledTimes(2);
    expect(queueCardReassessment).toHaveBeenCalledWith("new-card", "timer");
    expect(queueCardReassessment).toHaveBeenCalledWith("old-card", "timer");
    expect(refreshStoredComplianceTimeEvidence).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String)
    );
    expect(broadcast).toHaveBeenCalledWith("timer-invalidate");
  });

  it("does not emit a change for a stop request with no running timer", async () => {
    vi.mocked(db.stopTimer).mockResolvedValue(null);
    await expect(stopManagedTimer("card-1")).resolves.toBeNull();
    expect(queueCardReassessment).not.toHaveBeenCalled();
    expect(broadcast).not.toHaveBeenCalled();
  });

  it("automatically links starts to the current plan block and APTLSS step", async () => {
    vi.mocked(dailyPlan.getSavedDailyPlan).mockResolvedValue({
      blocks: [
        {
          id: "block-7",
          cardId: "card-7",
          cardName: "Client call",
          action: "Call the client",
          startTime: "00:00",
          endTime: "23:59",
          status: "planned",
          stepIds: [17],
        },
      ],
    } as Awaited<ReturnType<typeof dailyPlan.getSavedDailyPlan>>);
    vi.mocked(db.startTimer).mockResolvedValue({
      id: 7,
      cardId: "card-7",
      cardName: "Client call",
      startedAt: new Date(),
      stoppedEntries: [],
      stoppedCardIds: [],
    });

    await startManagedTimer({
      cardId: "card-7",
      cardName: "Client call",
      cardUrl: "https://trello.com/c/card-7",
      boardName: "Client",
      listName: "Doing",
      source: "work_queue",
    });

    expect(db.startTimer).toHaveBeenCalledWith(
      "card-7",
      "Client call",
      "https://trello.com/c/card-7",
      "Client",
      "Doing",
      expect.objectContaining({ planBlockId: "block-7", aptlssStepId: 17 })
    );
  });

  it("invalidates and reassesses after a successful stop", async () => {
    vi.mocked(db.stopTimer).mockResolvedValue({
      id: 1,
      cardId: "card-1",
      startedAt: new Date("2026-07-12T08:00:00Z"),
      stoppedAt: new Date(),
      durationSeconds: 60,
    } as Awaited<ReturnType<typeof db.stopTimer>>);
    await stopManagedTimer("card-1");
    expect(queueCardReassessment).toHaveBeenCalledWith("card-1", "timer");
    expect(broadcast).toHaveBeenCalledWith("timer-invalidate");
  });

  it("invalidates and reassesses after timer corrections", async () => {
    vi.mocked(accountability.correctTimeEntry).mockResolvedValue({
      id: 2,
      cardId: "card-2",
      startedAt: new Date("2026-07-12T08:00:00Z"),
      durationSeconds: 90,
      stoppedAt: new Date(),
    } as Awaited<ReturnType<typeof accountability.correctTimeEntry>>);
    vi.mocked(accountability.voidTimeEntry).mockResolvedValue({
      id: 3,
      cardId: "card-3",
      startedAt: new Date("2026-07-12T08:00:00Z"),
    } as Awaited<ReturnType<typeof accountability.voidTimeEntry>>);

    await updateManagedTimeEntry(2, 90, "Fix accidental overrun");
    await deleteManagedTimeEntry(3, "Duplicate session");

    expect(queueCardReassessment).toHaveBeenCalledWith("card-2", "timer");
    expect(queueCardReassessment).toHaveBeenCalledWith("card-3", "timer");
    expect(broadcast).toHaveBeenCalledTimes(2);
  });

  it("invalidates all affected cards after the midnight safety stop", async () => {
    vi.mocked(db.autoStopAllRunningTimers).mockResolvedValue([
      { cardId: "card-4" },
      { cardId: "card-5" },
    ] as Awaited<ReturnType<typeof db.autoStopAllRunningTimers>>);

    await autoStopManagedTimers();

    expect(queueCardReassessment).toHaveBeenCalledWith("card-4", "timer");
    expect(queueCardReassessment).toHaveBeenCalledWith("card-5", "timer");
    expect(broadcast).toHaveBeenCalledWith("timer-invalidate");
  });
});
