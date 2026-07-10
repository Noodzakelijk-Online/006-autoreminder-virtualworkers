import { describe, expect, it } from "vitest";
import {
  buildEmptyPlan,
  durationMinutes,
  formatDuration,
  isPlannerAuthError,
  plannerErrorMessage,
  todayInEat,
  type DailyPlanBlock,
} from "./planMyDayModel";

const block: DailyPlanBlock = {
  id: "block-1",
  startTime: "09:15",
  endTime: "10:45",
  cardId: "card-1",
  cardName: "Prepare client update",
  cardUrl: null,
  boardName: "Operations",
  listName: "Doing",
  action: "Draft and review the update",
  stepIds: [],
  priority: "high",
  score: 90,
  state: "doing",
  status: "planned",
  notes: "",
  flags: [],
};

describe("Plan My Day model", () => {
  it("uses EAT when deriving the active date", () => {
    expect(todayInEat(Date.parse("2026-07-10T22:30:00.000Z"))).toBe("2026-07-11");
  });

  it("calculates block and display durations", () => {
    expect(durationMinutes(block)).toBe(90);
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(Number.NaN)).toBe("-");
  });

  it("creates an explicitly untrusted empty plan", () => {
    const plan = buildEmptyPlan("2026-07-10");
    expect(plan.blocks).toEqual([]);
    expect(plan.planHealth.status).toBe("warning");
    expect(plan.planHealth.confidence).toBe(0);
  });

  it("maps planner failures to actionable operator messages", () => {
    expect(plannerErrorMessage("Database not available")).toContain("DATABASE_URL");
    expect(plannerErrorMessage("Trello API credentials missing")).toContain("TrelloAPIKey");
    expect(plannerErrorMessage("No APTLSS plans")).toContain("generate card plans first");
  });

  it("recognizes both local and tRPC authentication failures", () => {
    expect(isPlannerAuthError("Please login")).toBe(true);
    expect(isPlannerAuthError("UNAUTHORIZED")).toBe(true);
    expect(isPlannerAuthError("Database unavailable")).toBe(false);
  });
});
