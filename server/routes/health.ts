/**
 * Health Check Endpoint
 * Used by Docker healthcheck and monitoring systems
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../db';
import { isRedisAvailable } from '../services/redis';

const router = Router();

/**
 * GET /api/health
 * Basic health check
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Check database connection
    const db = await getDb();
    const dbHealthy = db !== null;

    // Check Redis connection (optional)
    const redisHealthy = isRedisAvailable();

    const health = {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealthy ? 'connected' : 'disconnected',
      redis: redisHealthy ? 'connected' : 'not configured',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
    };

    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/health/ready
 * Readiness check (for Kubernetes)
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(503).json({
        ready: false,
        reason: 'Database not available',
      });
    }

    res.json({
      ready: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/health/live
 * Liveness check (for Kubernetes)
 */
router.get('/live', (req: Request, res: Response) => {
  res.json({
    alive: true,
    timestamp: new Date().toISOString(),
  });
});

export default router;
