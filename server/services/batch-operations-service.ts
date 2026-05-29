/**
 * Batch Operations Service
 * Handles bulk task operations with progress tracking
 */

import { nanoid } from 'nanoid';
import { getDb } from '../db';
import { batchOperations, taskAssignments } from '../../drizzle/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { websocketService } from './websocket';
import { invalidateCache } from './trello-cache';
import { log } from '../utils/logger';

export type BatchOperationType = 're_analyze' | 'reschedule' | 'conflict_resolution' | 'optimization';
export type BatchOperationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface BatchOperationParams {
  userId: string;
  userOpenId: string;
  operationType: BatchOperationType;
  taskIds: string[];
  description?: string;
  parameters?: Record<string, any>;
}

export interface BatchOperationResult {
  operationId: string;
  status: BatchOperationStatus;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  progress: number;
  results?: any[];
  errors?: string[];
}

/**
 * Create a new batch operation
 */
export async function createBatchOperation(params: BatchOperationParams): Promise<string> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  const operationId = nanoid();
  const now = new Date();

  await db.insert(batchOperations).values({
    id: operationId,
    userId: params.userOpenId,
    operationType: params.operationType,
    description: params.description || `Batch ${params.operationType}`,
    totalTasks: params.taskIds.length,
    completedTasks: 0,
    failedTasks: 0,
    status: 'pending',
    progress: '0.00',
    currentTaskIndex: 0,
    estimatedTimeSeconds: params.taskIds.length * 5, // Estimate 5 seconds per task
    elapsedTimeSeconds: 0,
    parameters: JSON.stringify(params.parameters || {}),
    createdAt: now,
    updatedAt: now,
  });

  log.info('Batch operation created', {
    operationId,
    operationType: params.operationType,
    totalTasks: params.taskIds.length,
    userId: params.userOpenId,
  });

  return operationId;
}

/**
 * Update batch operation progress
 */
async function updateBatchProgress(
  operationId: string,
  updates: {
    completedTasks?: number;
    failedTasks?: number;
    currentTaskIndex?: number;
    currentTaskName?: string;
    status?: BatchOperationStatus;
    results?: any;
    errorLog?: any;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const operation = await db
    .select()
    .from(batchOperations)
    .where(eq(batchOperations.id, operationId))
    .limit(1);

  if (operation.length === 0) return;

  const current = operation[0];
  const totalTasks = current.totalTasks;
  const completedTasks = updates.completedTasks ?? current.completedTasks;
  const failedTasks = updates.failedTasks ?? current.failedTasks;
  const progress = ((completedTasks + failedTasks) / totalTasks) * 100;

  const updateData: any = {
    ...updates,
    progress: progress.toFixed(2),
    updatedAt: new Date(),
  };

  if (updates.status === 'completed' || updates.status === 'failed') {
    updateData.completedAt = new Date();
  }

  if (updates.results) {
    updateData.results = JSON.stringify(updates.results);
  }

  if (updates.errorLog) {
    updateData.errorLog = JSON.stringify(updates.errorLog);
  }

  await db
    .update(batchOperations)
    .set(updateData)
    .where(eq(batchOperations.id, operationId));

  // Emit progress update via WebSocket
  websocketService.emitToUser(current.userId, 'batch:progress', {
    operationId,
    status: updates.status || current.status,
    progress: parseFloat(progress.toFixed(2)),
    completedTasks,
    failedTasks,
    totalTasks,
    currentTaskName: updates.currentTaskName,
  });
}

/**
 * Execute batch re-analysis operation
 */
async function executeBatchReAnalysis(
  operationId: string,
  taskIds: string[],
  userId: string,
  userOpenId: string
): Promise<void> {
  const results: any[] = [];
  const errors: string[] = [];
  let completed = 0;
  let failed = 0;

  for (let i = 0; i < taskIds.length; i++) {
    const taskId = taskIds[i];

    try {
      await updateBatchProgress(operationId, {
        currentTaskIndex: i,
        currentTaskName: `Task ${taskId}`,
      });

      // Import ATIS service dynamically to avoid circular dependencies
      const { runAllPhases } = await import('./atis-phases-service');
      const { createAnalysisSession } = await import('../db/atis-phases');

      // Create analysis session
      const sessionId = await createAnalysisSession(taskId, userId);

      // Run analysis (this will take time)
      const result = await runAllPhases(taskId, userId, `Re-analysis of task ${taskId}`, sessionId);

      results.push({ taskId, success: true, sessionId, result });
      completed++;

      await updateBatchProgress(operationId, {
        completedTasks: completed,
        failedTasks: failed,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Task ${taskId}: ${errorMessage}`);
      failed++;

      log.error('Batch re-analysis failed for task', error as Error, {
        operationId,
        taskId,
      });

      await updateBatchProgress(operationId, {
        completedTasks: completed,
        failedTasks: failed,
      });
    }
  }

  await updateBatchProgress(operationId, {
    status: failed === taskIds.length ? 'failed' : 'completed',
    results,
    errorLog: errors,
  });
}

/**
 * Execute batch reschedule operation
 */
async function executeBatchReschedule(
  operationId: string,
  taskIds: string[],
  userId: number,
  userOpenId: string
): Promise<void> {
  try {
    // Invalidate cache to trigger rescheduling
    await invalidateCache(userId, userOpenId, 'tasks');

    await updateBatchProgress(operationId, {
      status: 'completed',
      completedTasks: taskIds.length,
      results: { message: 'Cache invalidated, tasks will be rescheduled on next fetch' },
    });

    log.info('Batch reschedule completed', {
      operationId,
      taskCount: taskIds.length,
    });
  } catch (error) {
    log.error('Batch reschedule failed', error as Error, { operationId });

    await updateBatchProgress(operationId, {
      status: 'failed',
      failedTasks: taskIds.length,
      errorLog: { error: error instanceof Error ? error.message : String(error) },
    });
  }
}

/**
 * Execute batch conflict resolution operation
 */
async function executeBatchConflictResolution(
  operationId: string,
  taskIds: string[],
  userId: number,
  userOpenId: string,
  parameters: Record<string, any>
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  const results: any[] = [];
  const errors: string[] = [];
  let completed = 0;
  let failed = 0;

  // Get all task assignments
  const assignments = await db
    .select()
    .from(taskAssignments)
    .where(
      and(
        eq(taskAssignments.founderId, userId),
        inArray(taskAssignments.taskId, taskIds)
      )
    );

  // TODO: Implement actual conflict resolution logic
  // For now, just mark as completed
  for (let i = 0; i < assignments.length; i++) {
    const assignment = assignments[i];

    try {
      await updateBatchProgress(operationId, {
        currentTaskIndex: i,
        currentTaskName: assignment.taskId,
      });

      // Placeholder: Actual conflict resolution would go here
      results.push({
        taskId: assignment.taskId,
        success: true,
        message: 'Conflict resolution placeholder',
      });
      completed++;

      await updateBatchProgress(operationId, {
        completedTasks: completed,
        failedTasks: failed,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Task ${assignment.taskId}: ${errorMessage}`);
      failed++;

      await updateBatchProgress(operationId, {
        completedTasks: completed,
        failedTasks: failed,
      });
    }
  }

  await updateBatchProgress(operationId, {
    status: failed === assignments.length ? 'failed' : 'completed',
    results,
    errorLog: errors,
  });
}

/**
 * Execute batch optimization operation
 */
async function executeBatchOptimization(
  operationId: string,
  taskIds: string[],
  userId: number,
  userOpenId: string
): Promise<void> {
  // TODO: Implement optimization logic
  await updateBatchProgress(operationId, {
    status: 'completed',
    completedTasks: taskIds.length,
    results: { message: 'Optimization placeholder' },
  });
}

/**
 * Execute a batch operation
 */
export async function executeBatchOperation(
  operationId: string,
  params: BatchOperationParams
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  try {
    // Mark as running
    await updateBatchProgress(operationId, {
      status: 'running',
    });

    const userId = parseInt(params.userId, 10);
    if (!Number.isFinite(userId)) {
      throw new Error('Invalid user ID');
    }

    // Execute based on operation type
    switch (params.operationType) {
      case 're_analyze':
        await executeBatchReAnalysis(operationId, params.taskIds, params.userId, params.userOpenId);
        break;

      case 'reschedule':
        await executeBatchReschedule(operationId, params.taskIds, userId, params.userOpenId);
        break;

      case 'conflict_resolution':
        await executeBatchConflictResolution(
          operationId,
          params.taskIds,
          userId,
          params.userOpenId,
          params.parameters || {}
        );
        break;

      case 'optimization':
        await executeBatchOptimization(operationId, params.taskIds, userId, params.userOpenId);
        break;

      default:
        throw new Error(`Unknown operation type: ${params.operationType}`);
    }

    log.info('Batch operation completed', {
      operationId,
      operationType: params.operationType,
    });
  } catch (error) {
    log.error('Batch operation failed', error as Error, {
      operationId,
      operationType: params.operationType,
    });

    await updateBatchProgress(operationId, {
      status: 'failed',
      errorLog: { error: error instanceof Error ? error.message : String(error) },
    });

    throw error;
  }
}

/**
 * Get batch operation status
 */
export async function getBatchOperationStatus(operationId: string): Promise<BatchOperationResult | null> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  const operations = await db
    .select()
    .from(batchOperations)
    .where(eq(batchOperations.id, operationId))
    .limit(1);

  if (operations.length === 0) {
    return null;
  }

  const operation = operations[0];

  return {
    operationId: operation.id,
    status: operation.status as BatchOperationStatus,
    totalTasks: operation.totalTasks,
    completedTasks: operation.completedTasks,
    failedTasks: operation.failedTasks,
    progress: parseFloat(operation.progress),
    results: operation.results ? JSON.parse(operation.results) : undefined,
    errors: operation.errorLog ? JSON.parse(operation.errorLog) : undefined,
  };
}

/**
 * Cancel a batch operation
 */
export async function cancelBatchOperation(operationId: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  await db
    .update(batchOperations)
    .set({
      status: 'cancelled',
      updatedAt: new Date(),
    })
    .where(eq(batchOperations.id, operationId));

  log.info('Batch operation cancelled', { operationId });
}
