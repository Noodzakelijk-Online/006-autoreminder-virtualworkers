import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { getDb } from "./db";
import { interpretWaitingReason } from "./aptlssWaitingReason";
import {
  WaitingReasonError,
  recordAptlssWaitingReason,
  resolveAptlssWaitingReason,
  toAptlssWaitingSignal,
} from "./aptlssWaitingReasonDb";

function transactionHarness() {
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));
  const returningId = vi.fn().mockResolvedValue([{ id: 73 }]);
  const insertValues = vi.fn(() => ({ $returningId: returningId }));
  const insert = vi.fn(() => ({ values: insertValues }));
  const tx = { update, insert };
  const db = { transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
  return { db, updateSet, insertValues };
}

describe("APTLSS waiting reason persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects persistence when the database is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null);
    const interpretation = interpretWaitingReason("Waiting for Robert to approve the budget.");

    await expect(recordAptlssWaitingReason({
      cardId: "card-1",
      cardName: "Budget",
      cardUrl: "https://trello.com/c/card-1",
      boardName: "Ops",
      listName: "On Hold",
      interpretation,
      recordedBy: "joyce",
    })).rejects.toBeInstanceOf(WaitingReasonError);
  });

  it("supersedes prior evidence and stores the exact reason atomically", async () => {
    const harness = transactionHarness();
    vi.mocked(getDb).mockResolvedValue(harness.db as never);
    const interpretation = interpretWaitingReason("Waiting for Robert to approve the budget.", { nowMs: Date.parse("2026-07-11T07:00:00Z") });

    const row = await recordAptlssWaitingReason({
      cardId: "card-1",
      cardName: "Budget",
      cardUrl: "https://trello.com/c/card-1",
      boardName: "Ops",
      listName: "On Hold",
      interpretation,
      recordedBy: "joyce",
    });

    expect(harness.updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "superseded" }));
    expect(harness.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      cardId: "card-1",
      rawReason: "Waiting for Robert to approve the budget.",
      waitingOn: "robert",
      status: "active",
      recordedBy: "joyce",
    }));
    expect(row).toMatchObject({ id: 73, status: "active", interpretationValue: interpretation });
    expect(toAptlssWaitingSignal(row)).toMatchObject({ reasonId: 73, waitingOn: "robert" });
  });

  it("resolves active waiting evidence without touching Trello", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn(() => ({ where }));
    const db = { update: vi.fn(() => ({ set })) };
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await resolveAptlssWaitingReason("card-1");

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "resolved", resolvedAt: expect.any(Date) }));
    expect(result).toMatchObject({ cardId: "card-1", resolvedAt: expect.any(Date) });
  });
});
