import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
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
import trelloConfigRoutes from "../routes/trello-config.js";
import interviewEnhancedRoutes from "../routes/interview-enhanced.js";
import performanceOptimizationRoutes from "../routes/performance-optimization.js";
import advancedSchedulingRoutes from "../routes/advanced-scheduling.js";
import { websocketService } from "../services/websocket.js";
import { startDigestScheduler } from "../services/digest-scheduler.js";
import { initializeWebhookAutoRegister } from "../services/webhook-auto-register.js";
import { warmUpCache, scheduleCacheRefresh } from "../services/cache-warming.js";

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

let activeConnections = 0;
const MAX_CONNECTIONS = 100;

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Connection tracking middleware
  app.use((req, res, next) => {
    activeConnections++;
    if (activeConnections > MAX_CONNECTIONS) {
      console.warn(`[Server] Too many connections: ${activeConnections}`);
      res.status(503).json({ error: 'Server overloaded' });
      return;
    }
    res.on('finish', () => {
      activeConnections--;
    });
    next();
  });
  
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
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // APTLSS Management API
  app.use("/api", aptlssRoutes);
  // Working Hours Settings API
  app.use("/api", workingHoursRoutes);
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
  // Trello Webhook API (for chatbot)
  app.use("/api/trello-webhook", trelloWebhookRoutes);
  // Trello Configuration API
  app.use("/api/trello", trelloConfigRoutes);
  // Enhanced Interview System API
  app.use("/api/interview", interviewEnhancedRoutes);
  // Performance Optimization API
  app.use("/api/performance", performanceOptimizationRoutes);
  // Advanced Scheduling API
  app.use("/api/scheduling", advancedSchedulingRoutes);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
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
