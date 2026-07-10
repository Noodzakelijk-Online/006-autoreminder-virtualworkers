import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "http",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("protected mutation gates", () => {
  it("requires authentication before posting Trello comments", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.trello.postComment({ cardId: "card-1", text: "Update ~ Joyce" })).rejects.toThrow("Please login");
  });

  it("requires authentication before changing the Trello comment token", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.trello.setCommentToken({ token: "token" })).rejects.toThrow("Please login");
  });

  it("requires authentication before starting timers", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.timer.start({
      cardId: "card-1",
      cardName: "Client card",
      cardUrl: "https://trello.com/c/card-1",
      boardName: "Joyce",
      listName: "Doing",
    })).rejects.toThrow("Please login");
  });

  it("requires authentication before stopping timers", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.timer.stop({ cardId: "card-1" })).rejects.toThrow("Please login");
  });

  it("requires authentication before deleting timer entries", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.timer.delete({ id: 1 })).rejects.toThrow("Please login");
  });

  it("requires authentication before correcting timer entries", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.timer.updateEntry({ id: 1, durationSeconds: 60 })).rejects.toThrow("Please login");
  });

  it("requires authentication before changing weekly pay logs", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.payLog.upsert({
      weekStart: "2026-07-06",
      weekEnd: "2026-07-12",
      meritM1: 0,
      meritM2: 0,
      meritM3: 0,
      meritStreak: 0,
      demeritD1: 0,
      demeritD2: 0,
      demeritD3: 0,
      demeritD4: 0,
      demeritD5: 0,
      demeritD6: 0,
      demeritD7: 0,
      demeritD8: 0,
      demeritD9: 0,
      demeritD10: 0,
      demeritD11: 0,
      notes: "test",
    })).rejects.toThrow("Please login");
  });

  it("requires authentication before changing triage state", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.triage.upsert({
      triageDate: "2026-07-06",
      step1Done: true,
      focusTasks: "test",
    })).rejects.toThrow("Please login");
  });

  it("requires authentication before changing on-hold checks", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.onHoldChecks.markChecked({
      cardId: "card-1",
      cardName: "Waiting card",
      cardUrl: "https://trello.com/c/card-1",
      date: "2026-07-06",
      checked: true,
    })).rejects.toThrow("Please login");
  });

  it("requires authentication before recording update streaks", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.streak.record({
      streakDate: "2026-07-06",
      completedBeforeDeadline: true,
      doingCardCount: 4,
    })).rejects.toThrow("Please login");
  });

  it("requires authentication before changing the Sunday checklist", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.sunday.upsert({
      sundayDate: "2026-07-05",
      trelloArchived: true,
      weekReviewed: true,
    })).rejects.toThrow("Please login");
  });

  it("requires authentication before recording compliance snapshots", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.compliance.recordNow()).rejects.toThrow("Please login");
  });

  it("requires authentication before upserting compliance snapshots", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.compliance.upsert({
      snapshotDate: "2026-07-06",
      onHoldTotal: 0,
      onHoldReviewed: 0,
      onHoldMissedCards: [],
      doingTotal: 0,
      doingUpdated: 0,
      doingMissedCards: [],
      d1Instances: 0,
      estimatedPenalty: 0,
      source: "test",
      weeklyPayLogId: null,
    })).rejects.toThrow("Please login");
  });

  it("requires authentication before syncing APTLSS check items over tRPC", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.aptlss.syncCheckItem({
      trelloCheckItemId: "check-1",
      state: "complete",
    })).rejects.toThrow("Please login");
  });

  it("requires authentication before running manual APTLSS maintenance", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(caller.aptlss.runMaintenanceNow()).rejects.toThrow("Please login");
  });
});
