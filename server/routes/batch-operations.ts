/**
 * Batch Operations API Routes
 * Handles bulk task operations with progress tracking
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  createBatchOperation,
  executeBatchOperation,
  getBatchOperationStatus,
  cancelBatchOperation,
  type BatchOperationParams,
} from '../services/batch-operations-service';
import { log } from '../utils/logger';
import { expensiveOperationRateLimiter } from '../middleware/rate-limiter';

const router = Router();

/**
 * POST /api/batch-operations/start
 * Start a new batch operation
 */
router.post('/start', expensiveOperationRateLimiter, async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { operationType, taskIds, description, parameters } = req.body;

    if (!operationType) {
      return res.status(400).json({ error: 'Operation type is required' });
    }

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: 'Task IDs array is required and must not be empty' });
    }

    const validOperationTypes = ['re_analyze', 'reschedule', 'conflict_resolution', 'optimization'];
    if (!validOperationTypes.includes(operationType)) {
      return res.status(400).json({
        error: `Invalid operation type. Must be one of: ${validOperationTypes.join(', ')}`,
      });
    }

    const params: BatchOperationParams = {
      userId: String(user.id),
      userOpenId: user.openId,
      operationType,
      taskIds,
      description,
      parameters,
    };

    const operationId = await createBatchOperation(params);

    // Execute in background
    setImmediate(() => {
      executeBatchOperation(operationId, params).catch((error) => {
        log.error('Background batch operation failed', error, {
          operationId,
          operationType,
        });
      });
    });

    res.json({
      success: true,
      operationId,
      message: 'Batch operation started',
    });
  } catch (error) {
    log.error('Failed to start batch operation', error as Error, {
      userId: req.user?.openId,
    });
    res.status(500).json({ error: 'Failed to start batch operation' });
  }
});

/**
 * GET /api/batch-operations/:operationId/status
 * Get batch operation status
 */
router.get('/:operationId/status', async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;

    if (!operationId) {
      return res.status(400).json({ error: 'Operation ID is required' });
    }

    const status = await getBatchOperationStatus(operationId);

    if (!status) {
      return res.status(404).json({ error: 'Batch operation not found' });
    }

    res.json({
      success: true,
      operation: status,
    });
  } catch (error) {
    log.error('Failed to get batch operation status', error as Error, {
      operationId: req.params.operationId,
    });
    res.status(500).json({ error: 'Failed to get operation status' });
  }
});

/**
 * POST /api/batch-operations/:operationId/cancel
 * Cancel a batch operation
 */
router.post('/:operationId/cancel', async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;

    if (!operationId) {
      return res.status(400).json({ error: 'Operation ID is required' });
    }

    await cancelBatchOperation(operationId);

    res.json({
      success: true,
      message: 'Batch operation cancelled',
    });
  } catch (error) {
    log.error('Failed to cancel batch operation', error as Error, {
      operationId: req.params.operationId,
    });
    res.status(500).json({ error: 'Failed to cancel operation' });
  }
});

export default router;
