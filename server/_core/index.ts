import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerSseRoute } from "../sse";
import { registerTrelloWebhookRoute } from "../trelloWebhook";
import { registerTrelloWebhooksForAllBoards } from "../trelloWebhookRegister";
import { registerScheduledDailySummaryRoute } from "../scheduledDailySummary";
import { registerScheduledAutoStopTimersRoute } from "../scheduledAutoStopTimers";
import { registerScheduledGmailScanRoute } from "../scheduledGmailScan";
import { registerScheduledAptlssMaintenanceRoute } from "../scheduledAptlssMaintenance";
import { registerScheduledWeeklyAnalysisRoute } from "../scheduledWeeklyAnalysis";
import { startCronJobs } from "../cronJobs";
import { getSystemHealth } from "./systemRouter";
import { isOwnerLoginDisabled } from "./localAuthUser";
import { assertOwnerBypassHost, displayServerHost, resolveServerHost } from "./serverBinding";

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
  app.use(express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      const expressReq = req as express.Request & { rawBody?: string };
      if (expressReq.originalUrl?.startsWith("/api/trello/webhook")) {
        expressReq.rawBody = buf.toString("utf8");
      }
    },
  }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", async (_req, res) => {
    try {
      const health = await getSystemHealth({ probeDatabase: true, probeTrello: true });
      res.status(health.ok ? 200 : 503).json(health);
    } catch (error) {
      res.status(503).json({
        ok: false,
        status: "blocked",
        summary: error instanceof Error ? error.message : "Health check failed.",
        checkedAt: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        nodeEnv: process.env.NODE_ENV || "development",
        counts: { ready: 0, warning: 0, blocked: 1 },
      });
    }
  });
  app.get("/api/powerup/key", (_req, res) => {
    const appKey = process.env.TRELLO_POWERUP_API_KEY ?? "";
    if (!appKey) {
      res.status(503).type("text/plain").send("TRELLO_POWERUP_API_KEY is not configured");
      return;
    }

    res.set("Cache-Control", "no-store");
    res.type("text/plain").send(appKey);
  });
  app.get("/api/powerup/config.js", (_req, res) => {
    const appKey = process.env.TRELLO_POWERUP_API_KEY ?? "";
    res.set("Cache-Control", "no-store");
    res.type("application/javascript").send(
      `window.JOYCE_POWERUP_CONFIG=${JSON.stringify({ appKey, configured: Boolean(appKey) })};\n`,
    );
  });
  app.get("/api/trello/authorize", (_req, res) => {
    const apiKey = process.env.TrelloAPIKey ?? "";
    if (!apiKey) {
      res.status(503).type("text/plain").send("TrelloAPIKey is not configured");
      return;
    }

    const authorizeUrl = new URL("https://trello.com/1/authorize");
    authorizeUrl.searchParams.set("expiration", "never");
    authorizeUrl.searchParams.set("scope", "read,write");
    authorizeUrl.searchParams.set("response_type", "token");
    authorizeUrl.searchParams.set("key", apiKey);
    res.redirect(authorizeUrl.toString());
  });
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Server-Sent Events — frontend subscribes for instant Trello invalidation
  registerSseRoute(app);

  // Trello Webhook — receives push events from Trello and broadcasts SSE
  registerTrelloWebhookRoute(app);
  // Scheduled task endpoints
  registerScheduledDailySummaryRoute(app);
  registerScheduledAutoStopTimersRoute(app);
  registerScheduledGmailScanRoute(app);
  registerScheduledAptlssMaintenanceRoute(app);
  registerScheduledWeeklyAnalysisRoute(app);

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

  const host = resolveServerHost(process.env.HOST, process.env.NODE_ENV);
  assertOwnerBypassHost(host, isOwnerLoginDisabled());

  server.listen(port, host, () => {
    const displayHost = displayServerHost(host);
    console.log(`Server running on http://${displayHost}:${port}/`);
    // Auto-register Trello webhooks for all boards Joyce is a member of
    registerTrelloWebhooksForAllBoards().catch(console.error);
    // Start server-side cron jobs (midnight auto-stop, etc.)
    startCronJobs();
  });
}

startServer().catch(console.error);
