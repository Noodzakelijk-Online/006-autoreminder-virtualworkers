import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import localAuthRoutes from "../routes/local-auth.js";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { sdk } from "./sdk";
import { serveStatic, setupVite } from "./vite";
import aptlssRoutes from "../routes/aptlss.js";
import workingHoursRoutes from "../routes/working-hours.js";
import holidaysRoutes from "../routes/holidays.js";
import rescheduleRoutes from "../routes/reschedule.js";
import cacheRoutes from "../routes/cache.js";
import queueRoutes from "../routes/queue.js";
import metricsRoutes from "../routes/metrics.js";
import vaManagementRoutes from "../routes/va-management.js";
import atisRoutes from "../routes/atis.js";
import notificationPreferencesRoutes from "../routes/notification-preferences.js";
import notificationHistoryRoutes from "../routes/notification-history.js";
import timeTrackingRoutes from "../routes/time-tracking.js";
import trelloWebhookRoutes from "../routes/trello-webhook.js";
import trelloWebhookBulkRoutes from "../routes/trello-webhook-bulk.js";
import trelloConfigRoutes from "../routes/trello-config.js";
import trelloBoardsRoutes from "../routes/trello-boards.js";
import interviewEnhancedRoutes from "../routes/interview-enhanced.js";
import performanceOptimizationRoutes from "../routes/performance-optimization.js";
import advancedSchedulingRoutes from "../routes/advanced-scheduling.js";
import atisPhasesRoutes from "../routes/atis-phases.js";
import { websocketService } from "../services/websocket.js";
import { startDigestScheduler } from "../services/digest-scheduler.js";
import { initializeWebhookAutoRegister } from "../services/webhook-auto-register.js";
import { warmUpCache, scheduleCacheRefresh } from "../services/cache-warming.js";
import { initializeRedis, closeRedis } from "../services/redis.js";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// ---------------------------------------------------------------------------
// Concurrency limiter — replaces the old hard-503 approach.
//
// Instead of immediately rejecting requests over MAX_CONNECTIONS, we queue
// them and process them as slots free up.  Requests that wait longer than
// QUEUE_TIMEOUT_MS are rejected with 503 so the queue never grows unbounded.
// ---------------------------------------------------------------------------
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_REQUESTS ?? '100', 10);
const QUEUE_TIMEOUT_MS = parseInt(process.env.REQUEST_QUEUE_TIMEOUT_MS ?? '30000', 10);

let activeRequests = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (activeRequests < MAX_CONCURRENT) {
      activeRequests++;
      resolve();
      return;
    }

    // Queue the request with a timeout guard
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const idx = waitQueue.indexOf(tryAcquire);
      if (idx !== -1) waitQueue.splice(idx, 1);
      reject(new Error('Request queue timeout'));
    }, QUEUE_TIMEOUT_MS);

    const tryAcquire = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      activeRequests++;
      resolve();
    };

    waitQueue.push(tryAcquire);
  });
}

function releaseSlot(): void {
  activeRequests--;
  const next = waitQueue.shift();
  if (next) next();
}

function concurrencyLimiter(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  acquireSlot()
    .then(() => {
      res.on('finish', releaseSlot);
      res.on('close', releaseSlot);   // handles aborted connections
      next();
    })
    .catch(() => {
      console.warn(`[Server] Request queue full (${waitQueue.length} waiting, ${activeRequests} active)`);
      res.status(503).json({
        error: 'Server busy — please retry in a moment',
        retryAfter: Math.ceil(QUEUE_TIMEOUT_MS / 1000),
      });
    });
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Concurrency limiter — queues excess requests instead of hard-rejecting them
  app.use(concurrencyLimiter);
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // Authentication middleware for all /api routes
  app.use('/api', async (req: any, res, next) => {
    try {
      req.user = await sdk.authenticateRequest(req);
    } catch (error) {
      // Authentication is optional, continue without user
      req.user = null;
    }
    next();
  });
  
  // OAuth callback under /api/oauth/callback (Manus OAuth - kept for compatibility)
  registerOAuthRoutes(app);
  // Local auth routes (username/password login - works without Manus)
  app.use('/api/auth', localAuthRoutes);
  // APTLSS Management API
  app.use("/api", aptlssRoutes);
  // Working Hours Settings API
  app.use("/api/working-hours", workingHoursRoutes);
  // VA Management API
  app.use("/api/va", vaManagementRoutes);
  // Holidays API
  app.use("/api/holidays", holidaysRoutes);
  // Reschedule API
  app.use("/api/reschedule", rescheduleRoutes);
  // Cache Management API
  app.use("/api", cacheRoutes);
  // Queue Metrics API
  app.use("/api", queueRoutes);
  // Performance Metrics API
  app.use("/api", metricsRoutes);
  // ATIS (Adaptive Task Intelligence System) API
  app.use("/api/atis", atisRoutes);
  // Notification Preferences API
  app.use("/api/notification-preferences", notificationPreferencesRoutes);
  // Notification History API
  app.use("/api/notifications", notificationHistoryRoutes);
  // Time Tracking API
  app.use("/api", timeTrackingRoutes);
  // Trello Bulk Webhook API — MUST be mounted before the base trello-webhook
  // router, otherwise Express matches /api/trello-webhook/bulk against the
  // base router first and the bulk route is never reached.
  app.use("/api/trello-webhook/bulk", trelloWebhookBulkRoutes);
  // Trello Webhook API (for chatbot)
  app.use("/api/trello-webhook", trelloWebhookRoutes);
  // Chatbot API (alias for trello-webhook)
  app.use("/api/chatbot", trelloWebhookRoutes);
  // Trello Configuration API
  app.use("/api/trello", trelloConfigRoutes);
  // Trello Boards API (for board selector)
  app.use("/api/trello-boards", trelloBoardsRoutes);
  // Enhanced Interview System API
  app.use("/api/interview", interviewEnhancedRoutes);
  // Performance Optimization API
  app.use("/api/performance", performanceOptimizationRoutes);
  // Advanced Scheduling API
  app.use("/api/scheduling", advancedSchedulingRoutes);
  // ATIS Phases 3-10 API
  app.use("/api/atis/phases", atisPhasesRoutes);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Add 404 handler for unmatched API routes before Vite middleware
  app.use('/api', (req, res) => {
    console.log(`[Server] 404 - Unmatched API route: ${req.method} ${req.path}`);
    res.status(404).json({ error: 'API endpoint not found', path: req.path });
  });
  
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Initialize Redis (must happen before WebSocket so the adapter can be attached)
  await initializeRedis();

  // Initialize WebSocket server
  websocketService.initialize(server);

  // Enable digest scheduler for daily email summaries
  startDigestScheduler();
  console.log('[Server] Digest scheduler ENABLED');

  // Warm up cache on startup
  try {
    await warmUpCache();
    console.log('[Server] Cache warming completed');
    // Schedule periodic cache refresh every 60 minutes
    scheduleCacheRefresh(60);
    console.log('[Server] Periodic cache refresh scheduled');
  } catch (error) {
    console.error('[Server] Cache warming failed:', error);
  }

  server.listen(port, async () => {
    console.log(`Server running on http://localhost:${port}/`);
    
    // Enable webhook auto-registration for chatbot
    const publicUrl = process.env.PUBLIC_URL || `http://localhost:${port}`;
    try {
      await initializeWebhookAutoRegister(publicUrl);
      console.log('[Server] Webhook auto-register initialized');
    } catch (error) {
      console.error('[Server] Failed to initialize webhook auto-register:', error);
    }
  });

  // Graceful shutdown handling
  const gracefulShutdown = async () => {
    console.log('[Server] Shutting down gracefully...');
    
    // Close WebSocket connections
    const io = websocketService.getIO();
    if (io) {
      io.close();
      console.log('[Server] WebSocket server closed');
    }

    // Close Redis connections
    await closeRedis();
    
    // Close HTTP server
    server.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('[Server] Uncaught exception:', error);
    gracefulShutdown();
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Server] Unhandled rejection at:', promise, 'reason:', reason);
  });
}

startServer().catch((error) => {
  console.error('[Server] Failed to start:', error);
  process.exit(1);
});
