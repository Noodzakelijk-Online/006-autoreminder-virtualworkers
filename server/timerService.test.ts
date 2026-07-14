import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  autoStopAllRunningTimers: vi.fn(),
  startTimer: vi.fn(),
  stopTimer: vi.fn(),
  deleteTimeEntry: vi.fn(),
  updateTimeEntry: vi.fn(),
}));
vi.mock("./aptlssReassessment", () => ({ queueCardReassessment: vi.fn() }));
vi.mock("./sse", () => ({ broadcast: vi.fn() }));
vi.mock("./timeEvidence", () => ({ refreshStoredComplianceTimeEvidence: vi.fn().mockResolvedValue({ daysCalculated: 1 }) }));

const db = await import("./db");
const { queueCardReassessment } = await import("./aptlssReassessment");
const { broadcast } = await import("./sse");
const { refreshStoredComplianceTimeEvidence } = await import("./timeEvidence");
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
    expect(refreshStoredComplianceTimeEvidence).toHaveBeenCalledWith(expect.any(String), expect.any(String));
    expect(broadcast).toHaveBeenCalledWith("timer-invalidate");
  });

  it("does not emit a change for a stop request with no running timer", async () => {
    vi.mocked(db.stopTimer).mockResolvedValue(null);
    await expect(stopManagedTimer("card-1")).resolves.toBeNull();
    expect(queueCardReassessment).not.toHaveBeenCalled();
    expect(broadcast).not.toHaveBeenCalled();
  });

  it("invalidates and reassesses after a successful stop", async () => {
    vi.mocked(db.stopTimer).mockResolvedValue({ cardId: "card-1" } as Awaited<ReturnType<typeof db.stopTimer>>);
    await stopManagedTimer("card-1");
    expect(queueCardReassessment).toHaveBeenCalledWith("card-1", "timer");
    expect(broadcast).toHaveBeenCalledWith("timer-invalidate");
  });

  it("invalidates and reassesses after timer corrections", async () => {
    vi.mocked(db.updateTimeEntry).mockResolvedValue({ success: true, id: 2, cardId: "card-2", durationSeconds: 90, stoppedAt: new Date() });
    vi.mocked(db.deleteTimeEntry).mockResolvedValue({ success: true, id: 3, cardId: "card-3" });

    await updateManagedTimeEntry(2, 90);
    await deleteManagedTimeEntry(3);

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
