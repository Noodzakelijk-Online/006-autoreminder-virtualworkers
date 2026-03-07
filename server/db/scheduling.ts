/**
 * Raw SQL Helper Module for Advanced Scheduling Tables
 * 
 * This module isolates raw SQL queries for the new scheduling tables:
 * - task_schedule_history
 * - batch_operations
 * - keyboard_shortcuts
 * 
 * Uses raw MySQL2 connection pool to bypass Drizzle ORM type issues.
 * TODO: Refactor to Drizzle ORM after schema migration
 */

import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

let pool: mysql.Pool | null = null;

async function getPool(): Promise<mysql.Pool | null> {
  if (pool) return pool;
  
  if (!process.env.DATABASE_URL) {
    console.warn('[SchedulingDB] DATABASE_URL not set');
    return null;
  }

  try {
    pool = mysql.createPool(process.env.DATABASE_URL);
    console.log('[SchedulingDB] Connection pool created');
    return pool;
  } catch (error) {
    console.error('[SchedulingDB] Failed to create pool:', error);
    return null;
  }
}

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
  const pool = await getPool();
  if (!pool) throw new Error('Database not available');

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

  const connection = await pool.getConnection();
  try {
    await connection.execute(query, values);
    return id;
  } finally {
    connection.release();
  }
}

export async function getScheduleHistory(taskId: string, limit: number = 50): Promise<ScheduleHistoryRecord[]> {
  const pool = await getPool();
  if (!pool) return [];

  const query = `
    SELECT * FROM task_schedule_history 
    WHERE taskId = ? 
    ORDER BY createdAt DESC 
    LIMIT ?
  `;

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(query, [taskId, limit]);
    return (rows as any[]).map(row => ({
      ...row,
      hadConflicts: Boolean(row.hadConflicts)
    }));
  } finally {
    connection.release();
  }
}

// ============================================
// BATCH OPERATIONS
// ============================================

export interface BatchOperationRecord {
  id: string;
  userId: string;
  operationType: 're_analyze' | 'reschedule' | 'conflict_resolution' | 'optimization';
  taskIds: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  completedTasks: number;
  failedTasks: number;
  currentTaskIndex: number;
  currentTaskName?: string;
  results?: Record<string, any>;
  errorLog?: string[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  elapsedTimeSeconds?: number;
}

export async function createBatchOperation(record: Omit<BatchOperationRecord, 'id' | 'createdAt' | 'status' | 'progress' | 'completedTasks' | 'failedTasks' | 'currentTaskIndex'>): Promise<string> {
  const pool = await getPool();
  if (!pool) throw new Error('Database not available');

  const id = uuidv4();
  const query = `
    INSERT INTO batch_operations (
      id, userId, operationType, taskIds, status, progress,
      completedTasks, failedTasks, currentTaskIndex, createdAt
    ) VALUES (?, ?, ?, ?, 'pending', 0, 0, 0, 0, NOW())
  `;

  const values = [
    id,
    record.userId,
    record.operationType,
    JSON.stringify(record.taskIds)
  ];

  const connection = await pool.getConnection();
  try {
    await connection.execute(query, values);
    return id;
  } finally {
    connection.release();
  }
}

export async function getBatchOperation(jobId: string): Promise<BatchOperationRecord | null> {
  const pool = await getPool();
  if (!pool) return null;

  const query = `SELECT * FROM batch_operations WHERE id = ?`;

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(query, [jobId]);
    const row = (rows as any[])[0];
    if (!row) return null;

    return {
      ...row,
      taskIds: JSON.parse(row.taskIds || '[]'),
      results: row.results ? JSON.parse(row.results) : undefined,
      errorLog: row.errorLog ? JSON.parse(row.errorLog) : undefined
    };
  } finally {
    connection.release();
  }
}

export async function updateBatchOperation(jobId: string, updates: Partial<BatchOperationRecord>): Promise<void> {
  const pool = await getPool();
  if (!pool) throw new Error('Database not available');

  const allowedFields = ['status', 'progress', 'completedTasks', 'failedTasks', 'currentTaskIndex', 'currentTaskName', 'results', 'errorLog', 'startedAt', 'completedAt', 'elapsedTimeSeconds'];
  const setClauses: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      setClauses.push(`${key} = ?`);
      if (key === 'results' || key === 'errorLog') {
        values.push(typeof value === 'string' ? value : JSON.stringify(value));
      } else {
        values.push(value);
      }
    }
  }

  if (setClauses.length === 0) return;

  values.push(jobId);
  const query = `UPDATE batch_operations SET ${setClauses.join(', ')} WHERE id = ?`;

  const connection = await pool.getConnection();
  try {
    await connection.execute(query, values);
  } finally {
    connection.release();
  }
}

export async function cancelBatchOperation(jobId: string): Promise<void> {
  const pool = await getPool();
  if (!pool) throw new Error('Database not available');

  const query = `UPDATE batch_operations SET status = 'cancelled', completedAt = NOW() WHERE id = ?`;

  const connection = await pool.getConnection();
  try {
    await connection.execute(query, [jobId]);
  } finally {
    connection.release();
  }
}

export async function getBatchOperationHistory(userId: string, limit: number = 50): Promise<BatchOperationRecord[]> {
  const pool = await getPool();
  if (!pool) return [];

  const safeLimit = Math.max(1, Math.min(parseInt(String(limit)), 1000));

  const query = `
    SELECT * FROM batch_operations 
    WHERE userId = ? 
    ORDER BY createdAt DESC 
    LIMIT ${safeLimit}
  `;

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(query, [userId]);
    return (rows as any[]).map(row => ({
      ...row,
      taskIds: JSON.parse(row.taskIds || '[]'),
      results: row.results ? JSON.parse(row.results) : undefined,
      errorLog: row.errorLog ? JSON.parse(row.errorLog) : undefined
    }));
  } finally {
    connection.release();
  }
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

export async function createKeyboardShortcut(record: Omit<KeyboardShortcutRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const pool = await getPool();
  if (!pool) throw new Error('Database not available');

  const query = `
    INSERT INTO keyboard_shortcuts (
      userId, shortcutKey, action, description, isCustom, isEnabled, createdAt, updatedAt
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

  const connection = await pool.getConnection();
  try {
    const [result] = await connection.execute(query, values);
    return (result as any).insertId || 0;
  } finally {
    connection.release();
  }
}

export async function getKeyboardShortcuts(userId: string): Promise<KeyboardShortcutRecord[]> {
  const pool = await getPool();
  if (!pool) return [];

  const query = `
    SELECT * FROM keyboard_shortcuts 
    WHERE userId = ? 
    ORDER BY shortcutKey
  `;

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(query, [userId]);
    return (rows as any[]).map(row => ({
      ...row,
      isCustom: Boolean(row.isCustom),
      isEnabled: Boolean(row.isEnabled)
    }));
  } finally {
    connection.release();
  }
}

export async function updateKeyboardShortcut(id: number, updates: Partial<KeyboardShortcutRecord>): Promise<void> {
  const pool = await getPool();
  if (!pool) throw new Error('Database not available');

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

  const connection = await pool.getConnection();
  try {
    await connection.execute(query, values);
  } finally {
    connection.release();
  }
}

export async function deleteKeyboardShortcut(id: number): Promise<void> {
  const pool = await getPool();
  if (!pool) throw new Error('Database not available');

  const query = `DELETE FROM keyboard_shortcuts WHERE id = ?`;

  const connection = await pool.getConnection();
  try {
    await connection.execute(query, [id]);
  } finally {
    connection.release();
  }
}

export async function getDefaultKeyboardShortcuts(): Promise<KeyboardShortcutRecord[]> {
  const pool = await getPool();
  if (!pool) return [];

  const query = `
    SELECT * FROM keyboard_shortcuts 
    WHERE isCustom = 0 
    ORDER BY shortcutKey
  `;

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(query, []);
    return (rows as any[]).map(row => ({
      ...row,
      isCustom: Boolean(row.isCustom),
      isEnabled: Boolean(row.isEnabled)
    }));
  } finally {
    connection.release();
  }
}

export async function seedDefaultKeyboardShortcuts(userId: string): Promise<void> {
  const pool = await getPool();
  if (!pool) throw new Error('Database not available');

  const defaults = [
    { key: 'Ctrl+R', action: 'reschedule', description: 'Reschedule selected task' },
    { key: 'Ctrl+B', action: 'batch_reanalyze', description: 'Start batch re-analysis' },
    { key: 'Ctrl+U', action: 'undo_reschedule', description: 'Undo last reschedule' },
    { key: 'Ctrl+H', action: 'show_history', description: 'Show schedule history' },
    { key: 'Ctrl+K', action: 'show_shortcuts', description: 'Show keyboard shortcuts' },
    { key: 'Ctrl+/', action: 'toggle_help', description: 'Toggle help panel' },
    { key: 'Shift+N', action: 'next_task', description: 'Go to next task' },
    { key: 'Shift+P', action: 'previous_task', description: 'Go to previous task' },
    { key: 'Shift+C', action: 'complete_task', description: 'Mark task as complete' },
    { key: 'Shift+S', action: 'skip_task', description: 'Skip to next task' }
  ];

  const query = `
    INSERT INTO keyboard_shortcuts (
      userId, shortcutKey, action, description, isCustom, isEnabled, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, 0, 1, NOW(), NOW())
  `;

  const connection = await pool.getConnection();
  try {
    for (const shortcut of defaults) {
      await connection.execute(query, [userId, shortcut.key, shortcut.action, shortcut.description]);
    }
  } finally {
    connection.release();
  }
}
