import { beforeEach, describe, expect, it, vi } from "vitest";

const whereMock = vi.fn().mockResolvedValue(undefined);
const setMock = vi.fn(() => ({ where: whereMock }));
const updateMock = vi.fn(() => ({ set: setMock }));
const dbMock = { update: updateMock };

vi.mock("./db", () => ({
  getDb: vi.fn(async () => dbMock),
}));

import { getDb } from "./db";
import { completeStepsByIds } from "./aptlssStepsDb";

describe("completeStepsByIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue(dbMock as never);
    setMock.mockReturnValue({ where: whereMock });
    whereMock.mockResolvedValue(undefined);
  });

  it("marks unique positive step IDs complete", async () => {
    const completed = await completeStepsByIds([12, 12, 0, -4, 18, 4.2, Number.NaN]);

    expect(completed).toBe(2);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "complete",
        completedAt: expect.any(Date),
      }),
    );
    expect(whereMock).toHaveBeenCalledTimes(1);
  });

  it("skips empty and invalid ID batches", async () => {
    const completed = await completeStepsByIds([0, -1, 1.5, Number.NaN]);

    expect(completed).toBe(0);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("degrades safely when the database is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null);

    await expect(completeStepsByIds([1, 2])).resolves.toBe(0);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
