import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
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
import { websocketService } from "../services/websocket.js";
import { startDigestScheduler } from "../services/digest-scheduler.js";
import { initializeWebhookAutoRegister } from "../services/webhook-auto-register.js";

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

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
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

  // DISABLED: Digest scheduler for daily email summaries
  // startDigestScheduler();
  console.log('[Server] Digest scheduler DISABLED - notifications turned off');

  server.listen(port, async () => {
    console.log(`Server running on http://localhost:${port}/`);
    
    // DISABLED: Webhook auto-registration for chatbot
    // const publicUrl = process.env.PUBLIC_URL || `http://localhost:${port}`;
    // try {
    //   await initializeWebhookAutoRegister(publicUrl);
    //   console.log('[Server] Webhook auto-register initialized');
    // } catch (error) {
    //   console.error('[Server] Failed to initialize webhook auto-register:', error);
    // }
    console.log('[Server] Webhook auto-register DISABLED - notifications turned off');
  });
}

startServer().catch(console.error);
