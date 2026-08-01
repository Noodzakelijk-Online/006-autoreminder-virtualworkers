import { describe, expect, it } from "vitest";
import {
  buildSchedulingMetrics,
  normalizeHistoryLimit,
  resolveBatchSchedule,
  toBatchOperationResponse,
  toShortcutMap,
} from "./schedulingApi";
import type {
  BatchOperationRecord,
  KeyboardShortcutRecord,
} from "./db/scheduling";

const operation = (
  overrides: Partial<BatchOperationRecord> = {}
): BatchOperationRecord => ({
  id: "job-1",
  userId: "worker-1",
  operationType: "re_analyze",
  taskIds: ["a", "b"],
  status: "completed",
  progress: 100,
  completedTasks: 2,
  failedTasks: 0,
  currentTaskIndex: 2,
  elapsedTimeSeconds: 10,
  createdAt: new Date("2026-07-29T10:00:00Z"),
  ...overrides,
});

describe("advanced scheduling API normalization", () => {
  it("requires explicit and bounded batch reschedule timing", () => {
    expect(resolveBatchSchedule(undefined, "task-1")).toBeNull();
    expect(resolveBatchSchedule({ preferredDate: "invalid", duration: 2 }, "task-1")).toBeNull();
    expect(resolveBatchSchedule({ preferredDate: "2026-08-03T08:00:00.000Z", duration: 48 }, "task-1")).toBeNull();
    expect(resolveBatchSchedule({
      schedules: {
        "task-1": {
          startTime: "2026-08-03T08:00:00.000Z",
          endTime: "2026-08-03T09:30:00.000Z",
        },
      },
    }, "task-1")).toEqual({
      startTime: new Date("2026-08-03T08:00:00.000Z"),
      endTime: new Date("2026-08-03T09:30:00.000Z"),
    });
  });

  it("clamps history limits", () => {
    expect(normalizeHistoryLimit(undefined)).toBe(50);
    expect(normalizeHistoryLimit("0")).toBe(1);
    expect(normalizeHistoryLimit("500")).toBe(200);
  });

  it("maps canonical operations to the client contract", () => {
    expect(toBatchOperationResponse(operation())).toMatchObject({
      jobId: "job-1",
      totalTasks: 2,
      completedTasks: 2,
      progress: 100,
    });
  });

  it("returns enabled shortcuts only", () => {
    const base: KeyboardShortcutRecord = {
      id: 1,
      userId: "worker-1",
      shortcutKey: "Ctrl+1",
      action: "focus-calendar",
      isCustom: false,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(toShortcutMap([base, { ...base, id: 2, action: "disabled", isEnabled: false }]))
      .toEqual({ "focus-calendar": "Ctrl+1" });
  });

  it("derives metrics from persisted operations", () => {
    const metrics = buildSchedulingMetrics([
      operation(),
      operation({
        id: "job-2",
        taskIds: ["c"],
        status: "failed",
        elapsedTimeSeconds: 30,
        completedTasks: 0,
        failedTasks: 1,
      }),
    ]);

    expect(metrics).toMatchObject({
      totalOperations: 2,
      successfulOperations: 1,
      failedOperations: 1,
      averageExecutionTime: 10,
      averageTasksPerOperation: 1.5,
    });
  });
});
