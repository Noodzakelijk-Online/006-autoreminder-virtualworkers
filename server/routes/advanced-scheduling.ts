import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as schedulingDb from '../db/scheduling';
import { batchQueueProcessor } from '../services/batch-queue-processor.js';

const router = Router();

/**
 * Advanced Scheduling Routes
 * Handles drag-and-drop rescheduling, batch operations, and conflict detection
 */

// ============================================
// CONFLICT DETECTION HELPERS
// ============================================

/**
 * Detect time overlaps between tasks
 */
async function detectTimeConflicts(
  taskId: string,
  newStartTime: Date,
  newEndTime: Date,
  userId: string
) {
  try {
    // Get all tasks for the user
    const userTasks: any[] = await (schedulingDb as any).getUserTasks?.(userId) || [];
    
    const conflicts = userTasks.filter((task: any) => {
      // Skip the task being rescheduled
      if (task.id === taskId) return false;
      
      // Skip tasks without schedule
      if (!task.startTime || !task.endTime) return false;
      
      const taskStart = new Date(task.startTime);
      const taskEnd = new Date(task.endTime);
      
      // Check for time overlap
      return newStartTime < taskEnd && newEndTime > taskStart;
    });
    
    return conflicts;
  } catch (error) {
    console.error('[ConflictDetection] Error detecting time conflicts:', error);
    return [];
  }
}

/**
 * Detect resource conflicts (same person assigned to multiple tasks)
 */
async function detectResourceConflicts(
  taskId: string,
  assignedTo: string,
  newStartTime: Date,
  newEndTime: Date
) {
  try {
    // Get all tasks assigned to this person
    const assignedTasks: any[] = await (schedulingDb as any).getTasksByAssignee?.(assignedTo) || [];
    
    const conflicts = assignedTasks.filter((task: any) => {
      // Skip the task being rescheduled
      if (task.id === taskId) return false;
      
      // Skip tasks without schedule
      if (!task.startTime || !task.endTime) return false;
      
      const taskStart = new Date(task.startTime);
      const taskEnd = new Date(task.endTime);
      
      // Check for time overlap
      return newStartTime < taskEnd && newEndTime > taskStart;
    });
    
    return conflicts;
  } catch (error) {
    console.error('[ConflictDetection] Error detecting resource conflicts:', error);
    return [];
  }
}

/**
 * Generate conflict resolution suggestions
 */
function generateResolutionSuggestions(
  conflicts: any[],
  newStartTime: Date,
  newEndTime: Date
): any[] {
  const suggestions: any[] = [];
  
  if (conflicts.length === 0) {
    return suggestions;
  }
  
  // Suggestion 1: Reschedule to earlier time
  const earlierTime = new Date(newStartTime.getTime() - 2 * 60 * 60 * 1000); // 2 hours earlier
  suggestions.push({
    type: 'reschedule_earlier',
    description: 'Reschedule 2 hours earlier',
    newStartTime: earlierTime,
    newEndTime: new Date(earlierTime.getTime() + (newEndTime.getTime() - newStartTime.getTime()))
  });
  
  // Suggestion 2: Reschedule to later time
  const laterTime = new Date(newEndTime.getTime() + 1 * 60 * 60 * 1000); // 1 hour after conflict ends
  suggestions.push({
    type: 'reschedule_later',
    description: 'Reschedule 1 hour after conflict',
    newStartTime: laterTime,
    newEndTime: new Date(laterTime.getTime() + (newEndTime.getTime() - newStartTime.getTime()))
  });
  
  // Suggestion 3: Split task into smaller chunks
  suggestions.push({
    type: 'split_task',
    description: 'Split task into smaller chunks',
    recommendation: 'Consider breaking this task into smaller subtasks to avoid conflicts'
  });
  
  return suggestions;
}

// ============================================
// RESCHEDULE ENDPOINTS
// ============================================

/**
 * POST /api/scheduling/reschedule
 * Reschedule a single task with conflict detection
 */
router.post('/reschedule', async (req: Request, res: Response) => {
  try {
    const { taskId, cardTrelloId, newStartTime, newEndTime, reason, assignedTo } = req.body;
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

    // Detect conflicts
    const timeConflicts = await detectTimeConflicts(taskId, startTime, endTime, userOpenId);
    const resourceConflicts = assignedTo 
      ? await detectResourceConflicts(taskId, assignedTo, startTime, endTime)
      : [];
    
    const allConflicts = [...timeConflicts, ...resourceConflicts];
    const hadConflicts = allConflicts.length > 0;
    
    // Generate resolution suggestions if conflicts exist
    const suggestions = hadConflicts ? generateResolutionSuggestions(allConflicts, startTime, endTime) : [];

    // Record the reschedule event
    const historyId = await schedulingDb.insertScheduleHistory({
      taskId,
      cardTrelloId,
      newStartTime: startTime,
      newEndTime: endTime,
      changedBy: userOpenId,
      reason: reason || 'Manual reschedule',
      source: 'manual',
      hadConflicts
    });

    res.json({
      success: true,
      taskId,
      historyId,
      newStartTime: startTime,
      newEndTime: endTime,
      hadConflicts,
      conflictCount: allConflicts.length,
      conflicts: hadConflicts ? allConflicts.map((c: any) => ({
        id: c.id,
        title: c.title || c.name,
        startTime: c.startTime,
        endTime: c.endTime,
        type: c.assignedTo === assignedTo ? 'resource' : 'time'
      })) : [],
      suggestions,
      message: hadConflicts 
        ? `Task rescheduled with ${allConflicts.length} conflict(s) detected`
        : 'Task rescheduled successfully'
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

/**
 * POST /api/scheduling/detect-conflicts
 * Detect conflicts for a proposed schedule
 */
router.post('/detect-conflicts', async (req: Request, res: Response) => {
  try {
    const { taskId, newStartTime, newEndTime, assignedTo } = req.body;
    const userOpenId = (req as any).user?.openId;

    if (!userOpenId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!taskId || !newStartTime || !newEndTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const startTime = new Date(newStartTime);
    const endTime = new Date(newEndTime);

    // Detect conflicts
    const timeConflicts = await detectTimeConflicts(taskId, startTime, endTime, userOpenId);
    const resourceConflicts = assignedTo
      ? await detectResourceConflicts(taskId, assignedTo, startTime, endTime)
      : [];

    const allConflicts = [...timeConflicts, ...resourceConflicts];
    const suggestions = allConflicts.length > 0 
      ? generateResolutionSuggestions(allConflicts, startTime, endTime)
      : [];

    res.json({
      success: true,
      taskId,
      hasConflicts: allConflicts.length > 0,
      conflictCount: allConflicts.length,
      conflicts: allConflicts.map((c: any) => ({
        id: c.id,
        title: c.title || c.name,
        startTime: c.startTime,
        endTime: c.endTime,
        type: c.assignedTo === assignedTo ? 'resource' : 'time'
      })),
      suggestions
    });
  } catch (error) {
    console.error('[AdvancedScheduling] Error detecting conflicts:', error);
    res.status(500).json({ error: 'Failed to detect conflicts' });
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

    void batchQueueProcessor.enqueueJob(jobId, userOpenId, operationType, taskIds, {
      description,
      parameters,
    });

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
    const liveProgress = batchQueueProcessor.getJobProgress(jobId);
    const operation = await schedulingDb.getBatchOperation(jobId);

    if (!operation && !liveProgress) {
      return res.status(404).json({ error: 'Batch operation not found' });
    }

    const elapsedSeconds = liveProgress?.elapsedSeconds
      ?? (operation?.startedAt
        ? Math.floor((Date.now() - operation.startedAt.getTime()) / 1000)
        : 0);

    const status = liveProgress?.status ?? operation?.status ?? 'pending';
    const progressValue = liveProgress?.progress ?? operation?.progress ?? 0;
    const totalTasks = liveProgress?.totalTasks ?? operation?.taskIds?.length ?? 0;
    const completedTasks = liveProgress?.completedTasks ?? operation?.completedTasks ?? 0;
    const failedTasks = liveProgress?.failedTasks ?? operation?.failedTasks ?? 0;
    const currentTaskName = liveProgress?.currentTaskName ?? operation?.currentTaskName;
    const elapsedTimeSeconds = liveProgress?.elapsedSeconds ?? operation?.elapsedTimeSeconds;
    const isPaused = liveProgress?.isPaused ?? false;
    const pausedAt = liveProgress?.pausedAt ? new Date(liveProgress.pausedAt) : undefined;

    res.json({
      success: true,
      jobId,
      status,
      progress: progressValue,
      totalTasks,
      completedTasks,
      failedTasks,
      currentTaskName,
      elapsedSeconds,
      elapsedTimeSeconds,
      isPaused,
      pausedAt
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

    await batchQueueProcessor.cancelJob(jobId);
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
 * POST /api/scheduling/batch/:jobId/pause
 * Pause a running batch operation
 */
router.post('/batch/:jobId/pause', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userOpenId = (req as any).user?.openId;

    if (!userOpenId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const operation = await schedulingDb.getBatchOperation(jobId);
    if (!operation) {
      return res.status(404).json({ error: 'Batch operation not found' });
    }

    if (operation.userId !== userOpenId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await batchQueueProcessor.pauseJob(jobId);

    res.json({
      success: true,
      jobId,
      message: 'Batch operation paused'
    });
  } catch (error) {
    console.error('[AdvancedScheduling] Error pausing batch operation:', error);
    res.status(500).json({ error: 'Failed to pause batch operation' });
  }
});

/**
 * POST /api/scheduling/batch/:jobId/resume
 * Resume a paused batch operation
 */
router.post('/batch/:jobId/resume', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userOpenId = (req as any).user?.openId;

    if (!userOpenId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const operation = await schedulingDb.getBatchOperation(jobId);
    if (!operation) {
      return res.status(404).json({ error: 'Batch operation not found' });
    }

    if (operation.userId !== userOpenId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await batchQueueProcessor.resumeJob(jobId);

    res.json({
      success: true,
      jobId,
      message: 'Batch operation resumed'
    });
  } catch (error) {
    console.error('[AdvancedScheduling] Error resuming batch operation:', error);
    res.status(500).json({ error: 'Failed to resume batch operation' });
  }
});

export default router;
