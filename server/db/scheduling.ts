/**
 * Raw SQL Helper Module for Advanced Scheduling Tables
 * 
 * This module isolates raw SQL queries for the new scheduling tables:
 * - task_schedule_history
 * - batch_operations
 * - keyboard_shortcuts
 * 
 * Once Drizzle ORM regenerates types for these tables, this can be refactored
 * to use Drizzle ORM like the rest of the codebase.
 * 
 * TODO: Refactor to Drizzle ORM after schema migration
 */

import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// TASK SCHEDULE HISTORY
// ============================================

export interface ScheduleHistoryRecord {
  id: string;
  taskId: string;
  cardTrelloId?: string;
  previousStartTime?: Date;
  previousEndTime?: Date;
  newStartTime: Date;
  newEndTime: Date;
  changedBy: string;
  reason?: string;
  source: 'manual' | 'auto' | 'batch' | 'conflict_resolution';
  hadConflicts: boolean;
  conflictDetails?: string;
  createdAt: Date;
}

export async function insertScheduleHistory(record: Omit<ScheduleHistoryRecord, 'id' | 'createdAt'>): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const id = uuidv4();
  const query = `
    INSERT INTO task_schedule_history (
      id, taskId, cardTrelloId, previousStartTime, previousEndTime,
      newStartTime, newEndTime, changedBy, reason, source,
      hadConflicts, conflictDetails, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  const values = [
    id,
    record.taskId,
    record.cardTrelloId || null,
    record.previousStartTime || null,
    record.previousEndTime || null,
    record.newStartTime,
    record.newEndTime,
    record.changedBy,
    record.reason || null,
    record.source,
    record.hadConflicts ? 1 : 0,
    record.conflictDetails || null
  ];

  await db.execute(query, values);
  return id;
}

export async function getScheduleHistory(taskId: string): Promise<ScheduleHistoryRecord[]> {
  const db = await getDb();
  if (!db) return [];

  const query = `
    SELECT * FROM task_schedule_history 
    WHERE taskId = ? 
    ORDER BY createdAt DESC
  `;

  const result = await db.execute(query, [taskId]);
  const rows = Array.isArray(result) ? result[0] : result;
  return (rows as any[]).map(row => ({
    ...row,
    hadConflicts: Boolean(row.hadConflicts),
    conflictDetails: row.conflictDetails ? JSON.parse(row.conflictDetails) : undefined
  }));
}

export async function getLatestScheduleHistory(taskId: string): Promise<ScheduleHistoryRecord | null> {
  const db = await getDb();
  if (!db) return null;

  const query = `
    SELECT * FROM task_schedule_history 
    WHERE taskId = ? 
    ORDER BY createdAt DESC 
    LIMIT 1
  `;

  const result = await db.execute(query, [taskId]);
  const rows = Array.isArray(result) ? result[0] : result;
  if ((rows as any[]).length === 0) return null;

  const row = (rows as any[])[0];
  return {
    ...row,
    hadConflicts: Boolean(row.hadConflicts),
    conflictDetails: row.conflictDetails ? JSON.parse(row.conflictDetails) : undefined
  };
}

// ============================================
// BATCH OPERATIONS
// ============================================

export interface BatchOperationRecord {
  id: string;
  userId: string;
  operationType: 're_analyze' | 'reschedule' | 'conflict_resolution' | 'optimization';
  description?: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentTaskIndex: number;
  currentTaskName?: string;
  estimatedTimeSeconds?: number;
  elapsedTimeSeconds: number;
  results?: string;
  errorLog?: string;
  parameters?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export async function insertBatchOperation(record: Omit<BatchOperationRecord, 'id' | 'createdAt' | 'updatedAt' | 'elapsedTimeSeconds'>): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const id = uuidv4();
  const query = `
    INSERT INTO batch_operations (
      id, userId, operationType, description, totalTasks, completedTasks,
      failedTasks, status, progress, currentTaskIndex, currentTaskName,
      estimatedTimeSeconds, elapsedTimeSeconds, results, errorLog, parameters,
      startedAt, completedAt, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `;

  const values = [
    id,
    record.userId,
    record.operationType,
    record.description || null,
    record.totalTasks,
    record.completedTasks,
    record.failedTasks,
    record.status,
    record.progress,
    record.currentTaskIndex,
    record.currentTaskName || null,
    record.estimatedTimeSeconds || null,
    0, // elapsedTimeSeconds starts at 0
    record.results || null,
    record.errorLog || null,
    record.parameters || null,
    record.startedAt || null,
    record.completedAt || null
  ];

  await db.execute(query, values);
  return id;
}

export async function getBatchOperation(jobId: string): Promise<BatchOperationRecord | null> {
  const db = await getDb();
  if (!db) return null;

  const query = `SELECT * FROM batch_operations WHERE id = ?`;
  const result = await db.execute(query, [jobId]);
  const rows = Array.isArray(result) ? result[0] : result;

  if ((rows as any[]).length === 0) return null;

  const row = (rows as any[])[0];
  return {
    ...row,
    progress: Number(row.progress),
    results: row.results ? JSON.parse(row.results) : undefined,
    errorLog: row.errorLog ? JSON.parse(row.errorLog) : undefined,
    parameters: row.parameters ? JSON.parse(row.parameters) : undefined
  };
}

export async function updateBatchOperation(jobId: string, updates: Partial<BatchOperationRecord>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const allowedFields = [
    'completedTasks', 'failedTasks', 'status', 'progress',
    'currentTaskIndex', 'currentTaskName', 'estimatedTimeSeconds',
    'elapsedTimeSeconds', 'results', 'errorLog', 'startedAt', 'completedAt'
  ];

  const setClauses: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      setClauses.push(`${key} = ?`);
      if (typeof value === 'object' && value !== null) {
        values.push(JSON.stringify(value));
      } else {
        values.push(value);
      }
    }
  }

  if (setClauses.length === 0) return;

  setClauses.push('updatedAt = NOW()');
  values.push(jobId);

  const query = `UPDATE batch_operations SET ${setClauses.join(', ')} WHERE id = ?`;
  await db.execute(query, values);
}

export async function getBatchOperationsByUser(userId: string, limit: number = 50): Promise<BatchOperationRecord[]> {
  const db = await getDb();
  if (!db) return [];

  const query = `
    SELECT * FROM batch_operations 
    WHERE userId = ? 
    ORDER BY createdAt DESC 
    LIMIT ?
  `;

  const result = await db.execute(query, [userId, limit]);
  const rows = Array.isArray(result) ? result[0] : result;
  return (rows as any[]).map(row => ({
    ...row,
    progress: Number(row.progress),
    results: row.results ? JSON.parse(row.results) : undefined,
    errorLog: row.errorLog ? JSON.parse(row.errorLog) : undefined,
    parameters: row.parameters ? JSON.parse(row.parameters) : undefined
  }));
}

export async function cancelBatchOperation(jobId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const query = `UPDATE batch_operations SET status = ?, updatedAt = NOW() WHERE id = ?`;
  await db.execute(query, ['cancelled', jobId]);
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

export interface KeyboardShortcutRecord {
  id: number;
  userId: string;
  shortcutKey: string;
  action: string;
  description?: string;
  isCustom: boolean;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function insertKeyboardShortcut(record: Omit<KeyboardShortcutRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const query = `
    INSERT INTO keyboard_shortcuts (
      userId, shortcutKey, action, description, isCustom, isEnabled,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
  `;

  const values = [
    record.userId,
    record.shortcutKey,
    record.action,
    record.description || null,
    record.isCustom ? 1 : 0,
    record.isEnabled ? 1 : 0
  ];

  const result = await db.execute(query, values) as any;
  return result?.insertId || 0;
}

export async function getKeyboardShortcuts(userId: string): Promise<KeyboardShortcutRecord[]> {
  const db = await getDb();
  if (!db) return [];

  const query = `
    SELECT * FROM keyboard_shortcuts 
    WHERE userId = ? 
    ORDER BY shortcutKey
  `;

  const result = await db.execute(query, [userId]);
  const rows = Array.isArray(result) ? result[0] : result;
  return (rows as any[]).map(row => ({
    ...row,
    isCustom: Boolean(row.isCustom),
    isEnabled: Boolean(row.isEnabled)
  }));
}

export async function updateKeyboardShortcut(id: number, updates: Partial<KeyboardShortcutRecord>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const allowedFields = ['action', 'description', 'isEnabled'];
  const setClauses: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      setClauses.push(`${key} = ?`);
      if (typeof value === 'boolean') {
        values.push(value ? 1 : 0);
      } else {
        values.push(value);
      }
    }
  }

  if (setClauses.length === 0) return;

  setClauses.push('updatedAt = NOW()');
  values.push(id);

  const query = `UPDATE keyboard_shortcuts SET ${setClauses.join(', ')} WHERE id = ?`;
  await db.execute(query, values) as any;
}

export async function deleteKeyboardShortcut(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const query = `DELETE FROM keyboard_shortcuts WHERE id = ?`;
  await db.execute(query, [id]) as any;
}

export async function getDefaultKeyboardShortcuts(): Promise<KeyboardShortcutRecord[]> {
  const db = await getDb();
  if (!db) return [];

  const query = `
    SELECT * FROM keyboard_shortcuts 
    WHERE isCustom = 0 
    ORDER BY shortcutKey
  `;

  const result = await db.execute(query) as any;
  const rows = Array.isArray(result) && result.length > 0 ? result[0] : result;
  return (rows as any[]).map(row => ({
    ...row,
    isCustom: Boolean(row.isCustom),
    isEnabled: Boolean(row.isEnabled)
  }));
}
