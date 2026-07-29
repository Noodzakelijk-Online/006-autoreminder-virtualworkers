import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { getDb } from "./db";
import { DecisionOutcomeError, getDecisionHistory, recordDecisionOutcome } from "./decisionOutcomesDb";

function createTransactionDb(step: Record<string, unknown> | undefined) {
  const stepLimit = vi.fn().mockResolvedValue(step ? [step] : []);
  const planLimit = vi.fn().mockResolvedValue([{
    cardId: "card-1",
    cardName: "Prepare launch update",
    cardUrl: "https://trello.com/c/card-1",
    boardName: "Operations",
    listName: "Doing",
  }]);
  const select = vi.fn()
    .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: stepLimit }) }) })
    .mockReturnValueOnce({ from: () => ({ where: () => ({ orderBy: () => ({ limit: planLimit }) }) }) });
  const returningId = vi.fn().mockResolvedValue([{ id: 41 }]);
  const values = vi.fn(() => ({ $returningId: returningId }));
  const insert = vi.fn(() => ({ values }));
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));
  const tx = { select, insert, update };
  const db = { transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
  return { db, values, set, insert, update };
}

describe("decision outcomes persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects recording when the database is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null);

    await expect(recordDecisionOutcome({ stepId: 1, outcome: "Approved", resolvedBy: "owner" }))
      .rejects.toThrow("Database unavailable");
  });

  it("stores the card snapshot and closes an open Robert step atomically", async () => {
    const harness = createTransactionDb({
      id: 7,
      cardId: "card-1",
      title: "Choose the launch date",
      recommendedDecision: "Launch on Monday",
      requiresRobert: true,
      status: "open",
    });
    vi.mocked(getDb).mockResolvedValue(harness.db as never);

    const result = await recordDecisionOutcome({ stepId: 7, outcome: "Launch Monday morning", resolvedBy: "owner" });

    expect(result).toEqual({ id: 41, cardId: "card-1", resolvedAt: expect.any(Date) });
    expect(harness.values).toHaveBeenCalledWith(expect.objectContaining({
      stepId: 7,
      cardName: "Prepare launch update",
      decisionPrompt: "Choose the launch date",
      recommendedDecision: "Launch on Monday",
      outcome: "Launch Monday morning",
      resolvedBy: "owner",
    }));
    expect(harness.set).toHaveBeenCalledWith(expect.objectContaining({
      requiresRobert: false,
      status: "complete",
      completedAt: expect.any(Date),
    }));
  });

  it("rejects a duplicate or already closed step without inserting history", async () => {
    const harness = createTransactionDb(undefined);
    vi.mocked(getDb).mockResolvedValue(harness.db as never);

    await expect(recordDecisionOutcome({ stepId: 7, outcome: "Approved", resolvedBy: "owner" }))
      .rejects.toBeInstanceOf(DecisionOutcomeError);
    expect(harness.insert).not.toHaveBeenCalled();
    expect(harness.update).not.toHaveBeenCalled();
  });

  it("returns recent outcomes from the database query", async () => {
    const history = [{ id: 2, outcome: "Use option B" }, { id: 1, outcome: "Use option A" }];
    const limit = vi.fn().mockResolvedValue(history);
    const db = { select: vi.fn(() => ({ from: () => ({ orderBy: () => ({ limit }) }) })) };
    vi.mocked(getDb).mockResolvedValue(db as never);

    await expect(getDecisionHistory(2)).resolves.toEqual(history);
    expect(limit).toHaveBeenCalledWith(2);
  });
});
