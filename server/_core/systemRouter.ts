import { z } from "zod";
import { sql } from "drizzle-orm";
import axios from "axios";
import { getDb, getNavigationCounts } from "../db";
import { getReplyMonitorStatus } from "../replyMonitorDb";
import { getAptlssLlmConfigurationStatus } from "../aptlssLlmRouter";
import { notifyOwner } from "./notification";
import { ownerProcedure, publicProcedure, router } from "./trpc";
import { getLatestJobRuns } from "../scheduledJobsDb";
import { runEodComplianceJob } from "../cronJobs";
import { runWeeklyAnalysis } from "../weeklyAnalysisService";
import {
  getGmailIngestionSettings,
  getGmailOauthClientCredentials,
  getGmailOauthConnection,
} from "../gmailIngestionSettings";
import { hasGoogleDriveReadonlyScope } from "../googleDriveIngestion";

type ReadinessStatus = "ready" | "warning" | "blocked";

type ReadinessItem = {
  id: string;
  label: string;
  status: ReadinessStatus;
  message: string;
  action: string;
};

const hasValue = (value: string | undefined) => Boolean(value?.trim());
const TRELLO_API_BASE = "https://api.trello.com/1";
const JOYCE_MEMBER_ID = "joyjemimajj1";

function trelloProbeFailureMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      return "Trello rejected the configured credentials for Joyce board access.";
    }
    if (status === 404) {
      return "Trello credentials are valid, but Joyce's member account or board access could not be found.";
    }
    if (status) {
      return `Trello API probe failed with HTTP ${status}.`;
    }
    return "Trello API probe failed before a response was received.";
  }
  return error instanceof Error ? error.message : "Trello API probe failed.";
}

function isTrelloRateLimit(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 429;
}

async function probeTrelloAccess(apiKey: string, apiToken: string) {
  await axios.get(`${TRELLO_API_BASE}/members/${JOYCE_MEMBER_ID}/cards`, {
    params: {
      key: apiKey,
      token: apiToken,
      filter: "open",
      fields: "id",
      limit: 1,
    },
    timeout: 10_000,
  });
}

function parseWebhookCallback(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/api/trello/webhook") {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

async function probeWebhookCallback(callbackUrl: string) {
  await axios.head(callbackUrl, {
    timeout: 10_000,
    validateStatus: (status) => status >= 200 && status < 300,
  });
}

export async function getSystemReadiness(options: { probeDatabase?: boolean; probeTrello?: boolean } = {}) {
  const items: ReadinessItem[] = [];
  let gmailJobExpected = false;
  let gmailJobMaxAgeMs = 6 * 60 * 60_000;
  const probeDatabase = options.probeDatabase ?? true;
  const probeTrello = options.probeTrello ?? true;

  if (!hasValue(process.env.DATABASE_URL)) {
    items.push({
      id: "database",
      label: "Database",
      status: "blocked",
      message: "DATABASE_URL is not configured, so persisted plans, timers, settings, and audits are unavailable.",
      action: "Set DATABASE_URL and run the Drizzle migrations before production use.",
    });
  } else if (probeDatabase) {
    try {
      const db = await getDb();
      if (!db) {
        throw new Error("Drizzle client was not created");
      }
      await db.execute(sql`SELECT 1`);
      items.push({
        id: "database",
        label: "Database",
        status: "ready",
        message: "Database connection is configured and accepting read probes.",
        action: "No action needed.",
      });
    } catch (error) {
      items.push({
        id: "database",
        label: "Database",
        status: "blocked",
        message: error instanceof Error ? error.message : "Database probe failed.",
        action: "Check DATABASE_URL, network access, credentials, and applied migrations.",
      });
    }
  } else {
    items.push({
      id: "database",
      label: "Database",
      status: "ready",
      message: "DATABASE_URL is configured.",
      action: "Run a live readiness check before production use.",
    });
  }

  const requiredSecrets = [
    {
      id: "trello-api-key",
      label: "Trello API key",
      env: "TrelloAPIKey",
      message: "TrelloAPIKey is required for board sync, planning, timers, and card actions.",
    },
    {
      id: "trello-api-token",
      label: "Trello API token",
      env: "TrelloAPIToken",
      message: "TrelloAPIToken is required for board sync, planning, timers, and card actions.",
    },
  ];

  for (const check of requiredSecrets) {
    const configured = hasValue(process.env[check.env]);
    items.push({
      id: check.id,
      label: check.label,
      status: configured ? "ready" : "blocked",
      message: configured ? `${check.env} is configured.` : check.message,
      action: configured ? "No action needed." : `Set ${check.env} in the runtime environment.`,
    });
  }

  const trelloApiKey = process.env.TrelloAPIKey;
  const trelloApiToken = process.env.TrelloAPIToken;
  const trelloCredentialsConfigured = hasValue(trelloApiKey) && hasValue(trelloApiToken);
  if (!trelloCredentialsConfigured) {
    items.push({
      id: "trello-api-access",
      label: "Trello live access",
      status: "blocked",
      message: "Trello live access cannot be checked until both TrelloAPIKey and TrelloAPIToken are configured.",
      action: "Set TrelloAPIKey and TrelloAPIToken, then rerun readiness.",
    });
  } else if (!probeTrello) {
    items.push({
      id: "trello-api-access",
      label: "Trello live access",
      status: "ready",
      message: "Trello credentials are configured. Live API probing was skipped for this readiness call.",
      action: "Run readiness with Trello probing enabled before production use.",
    });
  } else {
    try {
      await probeTrelloAccess(trelloApiKey!, trelloApiToken!);
      items.push({
        id: "trello-api-access",
        label: "Trello live access",
        status: "ready",
        message: "Trello API accepted the credentials and Joyce card access is reachable.",
        action: "No action needed.",
      });
    } catch (error) {
      const rateLimited = isTrelloRateLimit(error);
      items.push({
        id: "trello-api-access",
        label: "Trello live access",
        status: rateLimited ? "warning" : "blocked",
        message: rateLimited ? "Trello temporarily rate-limited the live readiness probe (HTTP 429). Configured credentials were not rejected." : trelloProbeFailureMessage(error),
        action: rateLimited ? "Wait for the Trello rate-limit window to reset; polling and cached dashboard data may continue." : "Verify the Trello API key/token pair and make sure it can read Joyce's open cards.",
      });
    }
  }

  const aiPlanner = await getAptlssLlmConfigurationStatus();
  items.push({
    id: "ai-planner-key",
    label: "OpenAI model provider",
    status: aiPlanner.configured ? "ready" : "warning",
    message: aiPlanner.configured
      ? `OpenAI exposes ${aiPlanner.modelCount} compatible model(s) and ${aiPlanner.stageCount} ordered model/effort stage(s); APTLSS assigns them automatically.`
      : "OPENAI_API_KEY is not configured; deterministic planning remains available.",
    action: aiPlanner.configured
      ? `Lowest stage: ${aiPlanner.lowestStage}. Highest stage: ${aiPlanner.highestStage}. Live discovery found ${aiPlanner.discovery.discoveredModelCount} model(s) and higher-stage review is ${aiPlanner.reviewEnabled ? "enabled" : "disabled"}.`
      : "Set OPENAI_API_KEY. APTLSS will discover, rank, and assign compatible account-visible OpenAI models automatically.",
  });

  const scheduledTaskSecretConfigured = hasValue(process.env.SCHEDULED_TASK_SECRET);
  items.push({
    id: "scheduled-task-secret",
    label: "Scheduled task secret",
    status: scheduledTaskSecretConfigured ? "ready" : "warning",
    message: scheduledTaskSecretConfigured
      ? "SCHEDULED_TASK_SECRET is configured for scheduled maintenance endpoints."
      : "SCHEDULED_TASK_SECRET is missing; scheduled endpoints are open only in local development and fail closed in production.",
    action: scheduledTaskSecretConfigured
      ? "No action needed."
      : "Set SCHEDULED_TASK_SECRET and send it as a Bearer token from scheduled jobs.",
  });

  try {
    const [gmailSettings, gmailClient, gmailConnection] = await Promise.all([
      getGmailIngestionSettings(),
      getGmailOauthClientCredentials(),
      getGmailOauthConnection(),
    ]);
    gmailJobExpected = gmailSettings.enabled && Boolean(gmailClient && gmailConnection);
    gmailJobMaxAgeMs = Math.max(15 * 60_000, gmailSettings.intervalMinutes * 2 * 60_000);
    const status: ReadinessStatus = !gmailClient || !gmailConnection || !gmailSettings.enabled ? "warning" : "ready";
    items.push({
      id: "gmail-integration",
      label: "Google Workspace ingestion",
      status,
      message: !gmailClient
        ? "The internal Gmail scheduler needs a Google OAuth client."
        : !gmailConnection
          ? "The Google OAuth client is configured, but no Gmail account is connected."
          : gmailSettings.enabled
            ? `Gmail is connected and the workspace index runs inside this server every ${gmailSettings.intervalMinutes} minute(s).`
            : "Google Workspace is connected, but automatic ingestion is disabled.",
      action: status === "ready" ? "No action needed." : "Open Settings > Automation to configure Google Workspace and choose its interval.",
    });
    const driveReady = Boolean(gmailConnection && hasGoogleDriveReadonlyScope(gmailConnection.scopes));
    items.push({
      id: "google-drive-integration",
      label: "Google Drive evidence",
      status: driveReady ? "ready" : "warning",
      message: driveReady
        ? "Google Drive read-only access is granted for incremental evidence ingestion."
        : "Reconnect Google Workspace once to grant the new Drive read-only scope.",
      action: driveReady ? "No action needed." : "Open Settings > Automation and reconnect Google Workspace.",
    });
  } catch (error) {
    items.push({
      id: "gmail-integration",
      label: "Gmail ingestion",
      status: "warning",
      message: error instanceof Error ? error.message : "Gmail configuration could not be read.",
      action: "Open Settings > Automation and reconnect Gmail.",
    });
  }

  const powerUpConfigured = hasValue(process.env.TRELLO_POWERUP_API_KEY);
  items.push({
    id: "trello-powerup-api-key",
    label: "Trello Power-Up API key",
    status: powerUpConfigured ? "ready" : "warning",
    message: powerUpConfigured
      ? "TRELLO_POWERUP_API_KEY is configured for the Trello Power-Up pages."
      : "TRELLO_POWERUP_API_KEY is missing, so Trello Power-Up buttons and popups cannot initialize.",
    action: powerUpConfigured ? "No action needed." : "Set TRELLO_POWERUP_API_KEY before publishing or using the Power-Up.",
  });

  const webhookCallbackValue = process.env.TRELLO_WEBHOOK_CALLBACK_URL?.trim() ?? "";
  const webhookCallback = webhookCallbackValue ? parseWebhookCallback(webhookCallbackValue) : null;
  const temporaryCallback = webhookCallback?.hostname.endsWith(".trycloudflare.com") ?? false;
  if (!webhookCallbackValue) {
    items.push({
      id: "trello-webhook-callback-url",
      label: "Trello webhook callback",
      status: "warning",
      message: "TRELLO_WEBHOOK_CALLBACK_URL is missing, so Trello updates fall back to polling instead of instant push sync.",
      action: "Set TRELLO_WEBHOOK_CALLBACK_URL to the deployed /api/trello/webhook URL.",
    });
  } else if (!webhookCallback) {
    items.push({
      id: "trello-webhook-callback-url",
      label: "Trello webhook callback",
      status: "warning",
      message: "TRELLO_WEBHOOK_CALLBACK_URL must be an HTTPS URL ending exactly in /api/trello/webhook.",
      action: "Correct the callback URL before registering Trello webhooks.",
    });
  } else if (!probeTrello) {
    items.push({
      id: "trello-webhook-callback-url",
      label: "Trello webhook callback",
      status: temporaryCallback ? "warning" : "ready",
      message: temporaryCallback
        ? "A temporary Cloudflare quick-tunnel callback is configured; reachability was not probed."
        : "TRELLO_WEBHOOK_CALLBACK_URL is configured; reachability was not probed.",
      action: temporaryCallback
        ? "Keep the local tunnel running and replace it with a stable deployment or named tunnel for unattended use."
        : "Run a live readiness check before production use.",
    });
  } else {
    try {
      await probeWebhookCallback(webhookCallback.toString());
      items.push({
        id: "trello-webhook-callback-url",
        label: "Trello webhook callback",
        status: temporaryCallback ? "warning" : "ready",
        message: temporaryCallback
          ? "The Trello callback is reachable through a temporary Cloudflare quick tunnel."
          : "The configured Trello webhook callback is reachable over HTTPS.",
        action: temporaryCallback
          ? "Keep the local tunnel running and replace it with a stable deployment or named tunnel for unattended use."
          : "No action needed.",
      });
    } catch (error) {
      items.push({
        id: "trello-webhook-callback-url",
        label: "Trello webhook callback",
        status: "warning",
        message: axios.isAxiosError(error) && error.response?.status
          ? `The configured callback returned HTTP ${error.response.status}.`
          : "The configured callback could not be reached over HTTPS.",
        action: "Start the tunnel or deployment, then rerun readiness before relying on Trello push sync.",
      });
    }
  }

  const webhookSecretConfigured = hasValue(process.env.TRELLO_WEBHOOK_SECRET);
  const webhookPowerUpSecretConfigured = hasValue(process.env.TRELLO_POWERUP_SECRET);
  items.push({
    id: "trello-webhook-secret",
    label: "Trello webhook signature",
    status: webhookSecretConfigured || webhookPowerUpSecretConfigured ? "ready" : "warning",
    message: webhookSecretConfigured
      ? "TRELLO_WEBHOOK_SECRET is configured for webhook signature verification."
      : webhookPowerUpSecretConfigured
        ? "TRELLO_POWERUP_SECRET is configured and will be used for Trello webhook signature verification."
        : "No Trello webhook signature secret is configured, so webhook signature verification is not enforced.",
    action: webhookSecretConfigured || webhookPowerUpSecretConfigured
      ? "No action needed."
      : "Set TRELLO_WEBHOOK_SECRET or TRELLO_POWERUP_SECRET for production webhook hardening.",
  });

  // Operational table checks belong to full readiness, not the lightweight
  // health endpoint or callers that explicitly skip database probing.
  if (hasValue(process.env.DATABASE_URL) && probeDatabase) {
    try {
      const status = await getReplyMonitorStatus();
      const lastSuccess = status.lastSuccessfulAt ? new Date(status.lastSuccessfulAt) : null;
      const stale = !lastSuccess || Date.now() - lastSuccess.getTime() > 30 * 60_000;
      const failed = status.state === "error";
      items.push({
        id: "reply-monitor-runtime",
        label: "Reply Monitor runtime",
        status: failed ? "blocked" : stale ? "warning" : "ready",
        message: failed
          ? `The last Reply Monitor scan failed: ${status.errorMessage ?? "Unknown scan error"}`
          : stale
            ? "No successful Reply Monitor scan has completed in the last 30 minutes."
            : `Reply Monitor last completed successfully at ${lastSuccess!.toISOString()}.`,
        action: failed || stale ? "Run Reply Monitor from Inbox and verify a successful completion." : "No action needed.",
      });
    } catch (error) {
      items.push({
        id: "reply-monitor-runtime",
        label: "Reply Monitor runtime",
        status: "blocked",
        message: error instanceof Error ? error.message : "Reply Monitor health could not be read.",
        action: "Apply database migrations and verify Reply Monitor storage.",
      });
    }

    try {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const result = await db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM aptlss_plans) AS planCount,
          (SELECT COUNT(DISTINCT cardId) FROM aptlss_assessments) AS assessedCount
      `);
      const rows = Array.isArray(result) ? result[0] : result;
      const row = Array.isArray(rows) ? rows[0] as { planCount?: number | string; assessedCount?: number | string } | undefined : undefined;
      const planCount = Number(row?.planCount ?? 0);
      const assessedCount = Number(row?.assessedCount ?? 0);
      const coverage = assessedCount > 0 ? Math.round(planCount / assessedCount * 100) : 0;
      const ready = assessedCount > 0 && coverage >= 80;
      items.push({
        id: "aptlss-plan-data",
        label: "APTLSS planning data",
        status: ready ? "ready" : "warning",
        message: assessedCount > 0
          ? `${planCount}/${assessedCount} assessed cards have plans (${coverage}% coverage).`
          : "No assessed card coverage exists; planning cannot be trusted yet.",
        action: ready ? "No action needed." : "Run APTLSS maintenance until plan coverage reaches at least 80%.",
      });
    } catch (error) {
      items.push({
        id: "aptlss-plan-data",
        label: "APTLSS planning data",
        status: "warning",
        message: error instanceof Error ? error.message : "APTLSS plan availability could not be checked.",
        action: "Verify the aptlss_plans migration and maintenance job.",
      });
    }

    try {
      const latestRuns = await getLatestJobRuns();
      const expected = [
        { key: "aptlss_maintenance", label: "APTLSS maintenance", maxAgeMs: 90 * 60_000 },
        { key: "reply_monitor", label: "Reply Monitor", maxAgeMs: 35 * 60_000 },
        { key: "eod_compliance", label: "EOD compliance", maxAgeMs: 30 * 60 * 60_000 },
        { key: "timer_auto_stop", label: "Timer auto-stop", maxAgeMs: 30 * 60 * 60_000 },
        { key: "weekly_analysis", label: "Weekly analysis", maxAgeMs: 8 * 24 * 60 * 60_000 },
        ...(gmailJobExpected ? [{ key: "workspace_ingestion", label: "Workspace ingestion", maxAgeMs: gmailJobMaxAgeMs }] : []),
      ];
      for (const job of expected) {
        const run = latestRuns.find((candidate) => candidate.jobKey === job.key);
        const stale = !run || Date.now() - new Date(run.startedAt).getTime() > job.maxAgeMs;
        const failed = run?.status === "error";
        items.push({
          id: `job-${job.key}`,
          label: job.label,
          status: failed || stale ? "warning" : "ready",
          message: !run
            ? "No durable run has been recorded."
            : `${run.status} at ${new Date(run.startedAt).toISOString()}${run.errorMessage ? `: ${run.errorMessage}` : ""}`,
          action: failed || stale ? "Keep the server process running, then run this job manually from Settings." : "No action needed.",
        });
      }
    } catch (error) {
      items.push({
        id: "scheduled-job-ledger",
        label: "Scheduled job ledger",
        status: "warning",
        message: error instanceof Error ? error.message : "Scheduled job freshness could not be read.",
        action: "Apply database migrations and restart the server.",
      });
    }
  }

  const blocked = items.filter((item) => item.status === "blocked").length;
  const warnings = items.filter((item) => item.status === "warning").length;

  return {
    ok: blocked === 0,
    status: blocked > 0 ? "blocked" : warnings > 0 ? "warning" : "ready",
    checkedAt: new Date().toISOString(),
    summary:
      blocked > 0
        ? `${blocked} production setup item${blocked === 1 ? "" : "s"} blocked.`
        : warnings > 0
          ? `${warnings} production setup warning${warnings === 1 ? "" : "s"} remaining.`
          : "Production setup is ready.",
    counts: {
      ready: items.filter((item) => item.status === "ready").length,
      warning: warnings,
      blocked,
    },
    items,
  } as const;
}

export async function getSystemHealth(options: { probeDatabase?: boolean; probeTrello?: boolean } = {}) {
  const readiness = await getSystemReadiness({
    probeDatabase: options.probeDatabase ?? true,
    probeTrello: options.probeTrello ?? true,
  });

  return {
    ok: readiness.ok,
    status: readiness.status,
    summary: readiness.summary,
    checkedAt: readiness.checkedAt,
    uptimeSeconds: Math.round(process.uptime()),
    nodeEnv: process.env.NODE_ENV || "development",
    counts: readiness.counts,
  } as const;
}

/** Cheap process liveness for high-frequency deployment monitoring. */
export function getSystemLiveness() {
  return {
    ok: true,
    status: "ready",
    summary: "Service process is running.",
    checkedAt: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    nodeEnv: process.env.NODE_ENV || "development",
    counts: { ready: 1, warning: 0, blocked: 0 },
  } as const;
}

export const systemRouter = router({
  navigationCounts: ownerProcedure.query(() => getNavigationCounts()),

  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => getSystemLiveness()),

  readiness: ownerProcedure
    .input(
      z
        .object({
          probeDatabase: z.boolean().optional(),
          probeTrello: z.boolean().optional(),
        })
        .optional()
    )
    .query(({ input }) => getSystemReadiness({ probeDatabase: input?.probeDatabase, probeTrello: input?.probeTrello })),

  aptlssModelCatalog: ownerProcedure
    .input(z.object({ refresh: z.boolean().optional() }).optional())
    .query(({ input }) => getAptlssLlmConfigurationStatus({ forceRefresh: input?.refresh })),

  scheduledJobFreshness: ownerProcedure.query(() => getLatestJobRuns()),

  runEodCompliance: ownerProcedure.mutation(() => runEodComplianceJob("manual")),

  runWeeklyAnalysis: ownerProcedure.mutation(() => runWeeklyAnalysis("manual", { force: true, notify: false })),

  notifyOwner: ownerProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
