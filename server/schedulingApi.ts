import type {
  BatchOperationRecord,
  KeyboardShortcutRecord,
} from "./db/scheduling";

export function normalizeHistoryLimit(value: unknown, fallback = 50): number {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, 200));
}

export function toBatchOperationResponse(operation: BatchOperationRecord) {
  return {
    jobId: operation.id,
    operationType: operation.operationType,
    status: operation.status,
    progress: Number(operation.progress || 0),
    totalTasks: operation.taskIds.length,
    completedTasks: operation.completedTasks,
    failedTasks: operation.failedTasks,
    currentTaskIndex: operation.currentTaskIndex,
    currentTaskName: operation.currentTaskName,
    estimatedTimeSeconds: operation.estimatedTimeSeconds,
    elapsedTimeSeconds: operation.elapsedTimeSeconds,
    errorLog: operation.errorLog,
    results: operation.results,
    createdAt: operation.createdAt,
    startedAt: operation.startedAt,
    completedAt: operation.completedAt,
  };
}

export function toShortcutMap(shortcuts: KeyboardShortcutRecord[]): Record<string, string> {
  return Object.fromEntries(
    shortcuts
      .filter(shortcut => shortcut.isEnabled)
      .map(shortcut => [shortcut.action, shortcut.shortcutKey])
  );
}

export function buildSchedulingMetrics(operations: BatchOperationRecord[]) {
  const completed = operations.filter(operation => operation.status === "completed");
  const failed = operations.filter(operation => operation.status === "failed");
  const elapsed = completed
    .map(operation => Number(operation.elapsedTimeSeconds || 0))
    .filter(seconds => seconds > 0);
  const averageExecutionTime = elapsed.length
    ? elapsed.reduce((sum, seconds) => sum + seconds, 0) / elapsed.length
    : 0;
  const totalTasks = operations.reduce((sum, operation) => sum + operation.taskIds.length, 0);
  const successRate = operations.length ? (completed.length / operations.length) * 100 : 0;

  return {
    totalOperations: operations.length,
    successfulOperations: completed.length,
    failedOperations: failed.length,
    averageExecutionTime,
    averageTasksPerOperation: operations.length ? totalTasks / operations.length : 0,
    conflictsDetected: 0,
    conflictsResolved: 0,
    lastUpdated: new Date().toISOString(),
    trend: {
      successRate,
      executionTimeTrend: "stable" as const,
      operationsTrend: "stable" as const,
    },
  };
}
