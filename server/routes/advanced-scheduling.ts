import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as schedulingDb from '../db/scheduling';

const router = Router();

/**
 * Advanced Scheduling Routes
 * Handles drag-and-drop rescheduling, batch operations, and conflict detection
 */

// ============================================
// RESCHEDULE ENDPOINTS
// ============================================

/**
 * POST /api/scheduling/reschedule
 * Reschedule a single task with conflict detection
 */
router.post('/reschedule', async (req: Request, res: Response) => {
  try {
    const { taskId, cardTrelloId, newStartTime, newEndTime, reason } = req.body;
    const userOpenId = (req as any).user?.openId;

    if (!userOpenId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate input
    if (!taskId || !newStartTime || !newEndTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const startTime = new Date(newStartTime);
    const endTime = new Date(newEndTime);

    if (startTime >= endTime) {
      return res.status(400).json({ error: 'Start time must be before end time' });
    }

    // Record the reschedule event
    const historyId = await schedulingDb.insertScheduleHistory({
      taskId,
      cardTrelloId,
      newStartTime: startTime,
      newEndTime: endTime,
      changedBy: userOpenId,
      reason: reason || 'Manual reschedule',
      source: 'manual',
      hadConflicts: false // TODO: Implement conflict detection
    });

    res.json({
      success: true,
      taskId,
      historyId,
      newStartTime: startTime,
      newEndTime: endTime,
      message: 'Task rescheduled successfully'
    });
  } catch (error) {
    console.error('[AdvancedScheduling] Error rescheduling task:', error);
    res.status(500).json({ error: 'Failed to reschedule task' });
  }
});

/**
 * POST /api/scheduling/undo/:taskId
 * Undo the last reschedule for a task
 */
router.post('/undo/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const userOpenId = (req as any).user?.openId;

    if (!userOpenId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the last reschedule event
    const history = await schedulingDb.getScheduleHistory(taskId, 1);
    const lastReschedule = history[0];

    if (!lastReschedule || !lastReschedule.previousStartTime || !lastReschedule.previousEndTime) {
      return res.status(404).json({ error: 'No previous schedule found' });
    }

    // Create a new reschedule record to restore the previous schedule
    const historyId = await schedulingDb.insertScheduleHistory({
      taskId,
      cardTrelloId: lastReschedule.cardTrelloId,
      newStartTime: lastReschedule.previousStartTime,
      newEndTime: lastReschedule.previousEndTime,
      changedBy: userOpenId,
      reason: 'Undo reschedule',
      source: 'manual',
      hadConflicts: false
    });

    res.json({
      success: true,
      taskId,
      historyId,
      restoredStartTime: lastReschedule.previousStartTime,
      restoredEndTime: lastReschedule.previousEndTime,
      message: 'Previous schedule restored'
    });
  } catch (error) {
    console.error('[AdvancedScheduling] Error undoing reschedule:', error);
    res.status(500).json({ error: 'Failed to undo reschedule' });
  }
});

/**
 * GET /api/scheduling/history/:taskId
 * Get schedule history for a task
 */
router.get('/history/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const history = await schedulingDb.getScheduleHistory(taskId);

    res.json({
      success: true,
      taskId,
      history,
      count: history.length
    });
  } catch (error) {
    console.error('[AdvancedScheduling] Error getting schedule history:', error);
    res.status(500).json({ error: 'Failed to get schedule history' });
  }
});

// ============================================
// BATCH OPERATIONS ENDPOINTS
// ============================================

/**
 * POST /api/scheduling/batch-start
 * Start a batch operation (re-analyze, reschedule, etc.)
 */
router.post('/batch-start', async (req: Request, res: Response) => {
  try {
    const { operationType, taskIds, description, parameters } = req.body;
    const userOpenId = (req as any).user?.openId;

    if (!userOpenId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!operationType || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create batch operation record
    const jobId = await schedulingDb.createBatchOperation({
      userId: userOpenId,
      operationType,
      taskIds
    });

    // TODO: Queue the batch operation for processing
    // This would typically involve:
    // 1. Sending to a job queue (Redis, Bull, etc.)
    // 2. Or spawning a background worker
    // 3. Updating progress as tasks complete

    res.json({
      success: true,
      jobId,
      status: 'pending',
      progress: 0,
      totalTasks: taskIds.length,
      completedTasks: 0,
      failedTasks: 0,
      message: 'Batch operation started'
    });
  } catch (error) {
    console.error('[AdvancedScheduling] Error starting batch operation:', error);
    res.status(500).json({ error: 'Failed to start batch operation' });
  }
});

/**
 * GET /api/scheduling/batch/:jobId
 * Get batch operation progress
 */
router.get('/batch/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const operation = await schedulingDb.getBatchOperation(jobId);

    if (!operation) {
      return res.status(404).json({ error: 'Batch operation not found' });
    }

    const elapsedSeconds = operation.startedAt
      ? Math.floor((Date.now() - operation.startedAt.getTime()) / 1000)
      : 0;

    res.json({
      success: true,
      jobId,
      status: operation.status,
      progress: operation.progress,
      totalTasks: operation.taskIds?.length || 0,
      completedTasks: operation.completedTasks,
      failedTasks: operation.failedTasks,
      currentTaskName: operation.currentTaskName,
      elapsedSeconds,
      elapsedTimeSeconds: operation.elapsedTimeSeconds
    });
  } catch (error) {
    console.error('[AdvancedScheduling] Error getting batch progress:', error);
    res.status(500).json({ error: 'Failed to get batch progress' });
  }
});

/**
 * POST /api/scheduling/batch/:jobId/cancel
 * Cancel a batch operation
 */
router.post('/batch/:jobId/cancel', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userOpenId = (req as any).user?.openId;

    if (!userOpenId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify the job belongs to the user
    const operation = await schedulingDb.getBatchOperation(jobId);
    if (!operation) {
      return res.status(404).json({ error: 'Batch operation not found' });
    }

    if (operation.userId !== userOpenId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await schedulingDb.cancelBatchOperation(jobId);

    res.json({
      success: true,
      jobId,
      message: 'Batch operation cancelled'
    });
  } catch (error) {
    console.error('[AdvancedScheduling] Error cancelling batch operation:', error);
    res.status(500).json({ error: 'Failed to cancel batch operation' });
  }
});

/**
 * GET /api/scheduling/batch-history
 * Get user's batch operation history
 */
router.get('/batch-history', async (req: Request, res: Response) => {
  try {
    const userOpenId = (req as any).user?.openId;

    if (!userOpenId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const operations = await schedulingDb.getBatchOperationHistory(userOpenId, limit);

    res.json({
      success: true,
      operations,
      count: operations.length
    });
  } catch (error) {
    console.error('[AdvancedScheduling] Error getting batch history:', error);
    res.status(500).json({ error: 'Failed to get batch history' });
  }
});

// ============================================
// KEYBOARD SHORTCUTS ENDPOINTS
// ============================================

/**
 * GET /api/scheduling/shortcuts
 * Get user's keyboard shortcuts
 */
router.get('/shortcuts', async (req: Request, res: Response) => {
  try {
    const userOpenId = (req as any).user?.openId;

    if (!userOpenId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const shortcuts = await schedulingDb.getKeyboardShortcuts(userOpenId);

    res.json({
      success: true,
      shortcuts,
      count: shortcuts.length
    });
  } catch (error) {
    console.error('[AdvancedScheduling] Error getting shortcuts:', error);
    res.status(500).json({ error: 'Failed to get shortcuts' });
  }
});

/**
 * POST /api/scheduling/shortcuts
 * Create a new keyboard shortcut
 */
router.post('/shortcuts', async (req: Request, res: Response) => {
  try {
    const { shortcutKey, action, description, isCustom } = req.body;
    const userOpenId = (req as any).user?.openId;

    if (!userOpenId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!shortcutKey || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const id = await schedulingDb.createKeyboardShortcut({
      userId: userOpenId,
      shortcutKey,
      action,
      description,
      isCustom: isCustom || false,
      isEnabled: true
    });

    res.json({
      success: true,
      id,
      shortcutKey,
      action,
      message: 'Shortcut created'
    });
  } catch (error) {
    console.error('[AdvancedScheduling] Error creating shortcut:', error);
    res.status(500).json({ error: 'Failed to create shortcut' });
  }
});

/**
 * PUT /api/scheduling/shortcuts/:id
 * Update a keyboard shortcut
 */
router.put('/shortcuts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action, description, isEnabled } = req.body;
    const userOpenId = (req as any).user?.openId;

    if (!userOpenId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const shortcutId = parseInt(id);
    if (isNaN(shortcutId)) {
      return res.status(400).json({ error: 'Invalid shortcut ID' });
    }

    await schedulingDb.updateKeyboardShortcut(shortcutId, {
      action,
      description,
      isEnabled
    });

    res.json({
      success: true,
      id: shortcutId,
      message: 'Shortcut updated'
    });
  } catch (error) {
    console.error('[AdvancedScheduling] Error updating shortcut:', error);
    res.status(500).json({ error: 'Failed to update shortcut' });
  }
});

/**
 * DELETE /api/scheduling/shortcuts/:id
 * Delete a keyboard shortcut
 */
router.delete('/shortcuts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userOpenId = (req as any).user?.openId;

    if (!userOpenId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const shortcutId = parseInt(id);
    if (isNaN(shortcutId)) {
      return res.status(400).json({ error: 'Invalid shortcut ID' });
    }

    await schedulingDb.deleteKeyboardShortcut(shortcutId);

    res.json({
      success: true,
      id: shortcutId,
      message: 'Shortcut deleted'
    });
  } catch (error) {
    console.error('[AdvancedScheduling] Error deleting shortcut:', error);
    res.status(500).json({ error: 'Failed to delete shortcut' });
  }
});

/**
 * GET /api/scheduling/shortcuts/default
 * Get default keyboard shortcuts
 */
router.get('/shortcuts/default', async (req: Request, res: Response) => {
  try {
    const shortcuts = await schedulingDb.getDefaultKeyboardShortcuts();

    res.json({
      success: true,
      shortcuts,
      count: shortcuts.length
    });
  } catch (error) {
    console.error('[AdvancedScheduling] Error getting default shortcuts:', error);
    res.status(500).json({ error: 'Failed to get default shortcuts' });
  }
});

export default router;
