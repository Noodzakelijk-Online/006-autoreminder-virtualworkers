import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./aptlssDb", () => ({
  getAllAptlssPlans: vi.fn(),
}));

vi.mock("./aptlssLlmRouter", () => ({
  invokeAptlssLLM: vi.fn(),
}));

vi.mock("./aptlssPoliciesDb", () => ({
  getLatestWeeklyAnalysis: vi.fn(),
  getWeeklyAnalysisByKey: vi.fn(),
  upsertWeeklyAnalysis: vi.fn(),
}));

vi.mock("./aptlssStepsDb", () => ({
  getAllCardStates: vi.fn(),
  getAllPriorityScores: vi.fn(),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn(),
}));

vi.mock("./scheduledJobsDb", () => ({
  runTrackedJob: vi.fn(async ({ run }) => run()),
}));

vi.mock("./sse", () => ({
  broadcast: vi.fn(),
}));

const { getAllAptlssPlans } = await import("./aptlssDb");
const { invokeAptlssLLM } = await import("./aptlssLlmRouter");
const { getWeeklyAnalysisByKey, upsertWeeklyAnalysis } = await import("./aptlssPoliciesDb");
const { getAllCardStates, getAllPriorityScores } = await import("./aptlssStepsDb");
const { broadcast } = await import("./sse");
const { runWeeklyAnalysis } = await import("./weeklyAnalysisService");

describe("weekly analysis service", () => {
  afterEach(() => vi.clearAllMocks());

  it("persists deterministic improvements when the model cascade is unavailable", async () => {
    vi.mocked(getWeeklyAnalysisByKey).mockResolvedValue(null);
    vi.mocked(getAllAptlssPlans).mockResolvedValue([
      {
        id: 1,
        cardId: "card-1",
        cardName: "Overdue delivery",
        cardUrl: "https://trello.com/c/card-1",
        boardName: "Client",
        listName: "Doing",
        planJson: JSON.stringify({ isBlocked: false }),
        contextSnapshot: null,
        generatedAt: new Date(),
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    vi.mocked(getAllCardStates).mockResolvedValue([
      {
        id: 1,
        cardId: "card-1",
        state: "OVERDUE",
        stateReason: "Due date passed",
        confidenceScore: 90,
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    vi.mocked(getAllPriorityScores).mockResolvedValue([]);
    vi.mocked(invokeAptlssLLM).mockRejectedValue(new Error("No provider configured"));

    const result = await runWeeklyAnalysis("manual", { force: true, notify: false });

    expect(result).toMatchObject({ success: true, reused: false, estimateDrift: 1 });
    expect(upsertWeeklyAnalysis).toHaveBeenCalledWith(expect.objectContaining({
      processImprovements: expect.stringContaining("overdue due dates"),
      summary: expect.stringContaining("1 overdue"),
    }));
    expect(broadcast).toHaveBeenCalledWith("aptlss-invalidate");
  });

  it("reuses a recent weekly snapshot without loading cards or invoking a model", async () => {
    vi.mocked(getWeeklyAnalysisByKey).mockResolvedValue({
      id: 7,
      weekKey: "2026-W29",
      noProgressCards: "[]",
      recurringBlockers: "[]",
      estimateDrift: "[]",
      underperformingWorkers: "[]",
      listHoppers: "[]",
      unclearScopeProjects: "[]",
      processImprovements: JSON.stringify(["Keep current evidence fresh."]),
      summary: "Current snapshot",
      generatedAt: new Date(),
      createdAt: new Date(),
    });

    const result = await runWeeklyAnalysis("cron", { force: false, notify: true });

    expect(result).toMatchObject({ success: true, reused: true, summary: "Current snapshot" });
    expect(getAllCardStates).not.toHaveBeenCalled();
    expect(invokeAptlssLLM).not.toHaveBeenCalled();
    expect(upsertWeeklyAnalysis).not.toHaveBeenCalled();
  });
});
