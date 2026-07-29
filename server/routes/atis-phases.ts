/**
 * ATIS Phases 3-10 API Routes
 * Endpoints for advanced task analysis
 */

import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  analyzePhase3Decomposition,
  analyzePhase4RiskAssessment,
  analyzePhase5ResourceEstimation,
  analyzePhase6TimelineOptimization,
  analyzePhase7QAStrategy,
  analyzePhase8Documentation,
  analyzePhase9Dependencies,
  analyzePhase10Finalization,
  runAllPhases,
} from '../services/atis-phases-service';
import * as atisDb from '../db/atis-phases';

const router = express.Router();

/**
 * POST /api/atis/phases/start
 * Start a new ATIS analysis session
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { taskId, taskDescription } = req.body;
    const userId = (req as any).user?.openId;

    if (!taskId || !taskDescription || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: taskId, taskDescription, userId',
      });
    }

    // Run all phases
    const result = await runAllPhases(taskId, userId, taskDescription);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[ATIS Phases] Error starting analysis:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * POST /api/atis/phases/phase3
 * Run Phase 3: Task Decomposition
 */
router.post('/phase3', async (req: Request, res: Response) => {
  try {
    const { taskId, taskDescription } = req.body;
    const userId = (req as any).user?.openId;

    if (!taskId || !taskDescription || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const result = await analyzePhase3Decomposition(taskId, userId, taskDescription);
    res.json(result);
  } catch (error) {
    console.error('[ATIS Phase 3] Error:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * POST /api/atis/phases/phase4
 * Run Phase 4: Risk Assessment
 */
router.post('/phase4', async (req: Request, res: Response) => {
  try {
    const { taskId, taskDescription } = req.body;
    const userId = (req as any).user?.openId;

    if (!taskId || !taskDescription || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const result = await analyzePhase4RiskAssessment(taskId, userId, taskDescription);
    res.json(result);
  } catch (error) {
    console.error('[ATIS Phase 4] Error:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * POST /api/atis/phases/phase5
 * Run Phase 5: Resource Estimation
 */
router.post('/phase5', async (req: Request, res: Response) => {
  try {
    const { taskId, taskDescription } = req.body;
    const userId = (req as any).user?.openId;

    if (!taskId || !taskDescription || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const result = await analyzePhase5ResourceEstimation(taskId, userId, taskDescription);
    res.json(result);
  } catch (error) {
    console.error('[ATIS Phase 5] Error:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * POST /api/atis/phases/phase6
 * Run Phase 6: Timeline Optimization
 */
router.post('/phase6', async (req: Request, res: Response) => {
  try {
    const { taskId, taskDescription } = req.body;
    const userId = (req as any).user?.openId;

    if (!taskId || !taskDescription || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const result = await analyzePhase6TimelineOptimization(taskId, userId, taskDescription);
    res.json(result);
  } catch (error) {
    console.error('[ATIS Phase 6] Error:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * POST /api/atis/phases/phase7
 * Run Phase 7: QA Strategy
 */
router.post('/phase7', async (req: Request, res: Response) => {
  try {
    const { taskId, taskDescription } = req.body;
    const userId = (req as any).user?.openId;

    if (!taskId || !taskDescription || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const result = await analyzePhase7QAStrategy(taskId, userId, taskDescription);
    res.json(result);
  } catch (error) {
    console.error('[ATIS Phase 7] Error:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * POST /api/atis/phases/phase8
 * Run Phase 8: Documentation Requirements
 */
router.post('/phase8', async (req: Request, res: Response) => {
  try {
    const { taskId, taskDescription } = req.body;
    const userId = (req as any).user?.openId;

    if (!taskId || !taskDescription || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const result = await analyzePhase8Documentation(taskId, userId, taskDescription);
    res.json(result);
  } catch (error) {
    console.error('[ATIS Phase 8] Error:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * POST /api/atis/phases/phase9
 * Run Phase 9: External Dependencies
 */
router.post('/phase9', async (req: Request, res: Response) => {
  try {
    const { taskId, taskDescription } = req.body;
    const userId = (req as any).user?.openId;

    if (!taskId || !taskDescription || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const result = await analyzePhase9Dependencies(taskId, userId, taskDescription);
    res.json(result);
  } catch (error) {
    console.error('[ATIS Phase 9] Error:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * POST /api/atis/phases/phase10
 * Run Phase 10: Finalization & Execution Plan
 */
router.post('/phase10', async (req: Request, res: Response) => {
  try {
    const { taskId, taskDescription } = req.body;
    const userId = (req as any).user?.openId;

    if (!taskId || !taskDescription || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const result = await analyzePhase10Finalization(taskId, userId, taskDescription);
    res.json(result);
  } catch (error) {
    console.error('[ATIS Phase 10] Error:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * GET /api/atis/phases/session/:sessionId
 * Get analysis session details
 */
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await atisDb.getAnalysisSession(sessionId);

    if (!session || session.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    res.json({
      success: true,
      data: session[0],
    });
  } catch (error) {
    console.error('[ATIS] Error fetching session:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * GET /api/atis/phases/task/:taskId
 * Get all analysis data for a task
 */
router.get('/task/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const data = await atisDb.getAllAnalysisData(taskId);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[ATIS] Error fetching task analysis:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * GET /api/atis/phases/subtasks/:taskId
 * Get subtasks for a task
 */
router.get('/subtasks/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const subtasks = await atisDb.getSubtasks(taskId);

    res.json({
      success: true,
      data: subtasks,
    });
  } catch (error) {
    console.error('[ATIS] Error fetching subtasks:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * GET /api/atis/phases/risks/:taskId
 * Get risks for a task
 */
router.get('/risks/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const risks = await atisDb.getRisks(taskId);

    res.json({
      success: true,
      data: risks,
    });
  } catch (error) {
    console.error('[ATIS] Error fetching risks:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * GET /api/atis/phases/resources/:taskId
 * Get resource requirements for a task
 */
router.get('/resources/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const resources = await atisDb.getResourceRequirements(taskId);

    res.json({
      success: true,
      data: resources,
    });
  } catch (error) {
    console.error('[ATIS] Error fetching resources:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

export default router;
