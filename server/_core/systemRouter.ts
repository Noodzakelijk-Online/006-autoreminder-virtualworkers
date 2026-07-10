import { z } from "zod";
import { sql } from "drizzle-orm";
import axios from "axios";
import { getDb } from "../db";
import { getReplyMonitorStatus } from "../replyMonitorDb";
import { DISABLE_OWNER_LOGIN_ENV, isOwnerLoginDisabled } from "./localAuthUser";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";

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

export async function getSystemReadiness(options: { probeDatabase?: boolean; probeTrello?: boolean } = {}) {
  const items: ReadinessItem[] = [];
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
    {
      id: "cookie-secret",
      label: "Session secret",
      env: "JWT_SECRET",
      message: "JWT_SECRET is required for stable signed sessions.",
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

  const aiPlannerConfigured = hasValue(process.env.BUILT_IN_FORGE_API_KEY);
  items.push({
    id: "ai-planner-key",
    label: "AI planner key",
    status: aiPlannerConfigured ? "ready" : "warning",
    message: aiPlannerConfigured
      ? "BUILT_IN_FORGE_API_KEY is configured for APTLSS planning and generated drafts."
      : "BUILT_IN_FORGE_API_KEY is missing; APTLSS card plans and daily planning use deterministic fallback, while AI-generated follow-up drafts are reduced.",
    action: aiPlannerConfigured ? "No action needed." : "Set BUILT_IN_FORGE_API_KEY to restore full AI planning quality.",
  });

  const ownerLoginDisabled = isOwnerLoginDisabled();
  const ownerConfigured = hasValue(process.env.OWNER_OPEN_ID) || ownerLoginDisabled;
  items.push({
    id: "owner-open-id",
    label: "Owner access",
    status: ownerLoginDisabled ? "warning" : ownerConfigured ? "ready" : "warning",
    message: ownerLoginDisabled
      ? `${DISABLE_OWNER_LOGIN_ENV} is enabled for local development; owner-only monitoring is temporarily unlocked.`
      : ownerConfigured
        ? "OWNER_OPEN_ID is configured for owner-only monitoring."
      : "OWNER_OPEN_ID is missing, so owner-only monitoring, approvals, and audit views are locked closed.",
    action: ownerLoginDisabled
      ? `Unset ${DISABLE_OWNER_LOGIN_ENV} before production use.`
      : ownerConfigured
        ? "No action needed."
        : "Set OWNER_OPEN_ID to Joyce or Robert's expected owner identity.",
  });

  const oauthConfigured = hasValue(process.env.OAUTH_SERVER_URL);
  const localAuthConfigured = hasValue(process.env.LOCAL_AUTH_TOKEN) && hasValue(process.env.LOCAL_AUTH_OPEN_ID);
  items.push({
    id: "oauth-server",
    label: "Authenticated access",
    status: ownerLoginDisabled ? "warning" : oauthConfigured || localAuthConfigured ? "ready" : "warning",
    message: ownerLoginDisabled
      ? `${DISABLE_OWNER_LOGIN_ENV} is bypassing the owner login in local development.`
      : oauthConfigured
      ? "OAUTH_SERVER_URL is configured for hosted sign-in."
      : localAuthConfigured
        ? "Local owner login is configured for self-hosted access."
        : "No sign-in method is configured; protected planner features require hosted OAuth or local owner login.",
    action: ownerLoginDisabled
      ? `Set ${DISABLE_OWNER_LOGIN_ENV}=false or remove it to restore login.`
      : oauthConfigured || localAuthConfigured
      ? "No action needed."
      : "Set OAUTH_SERVER_URL for hosted OAuth, or set LOCAL_AUTH_TOKEN and LOCAL_AUTH_OPEN_ID for a self-hosted owner login.",
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

  const webhookCallbackConfigured = hasValue(process.env.TRELLO_WEBHOOK_CALLBACK_URL);
  items.push({
    id: "trello-webhook-callback-url",
    label: "Trello webhook callback",
    status: webhookCallbackConfigured ? "ready" : "warning",
    message: webhookCallbackConfigured
      ? "TRELLO_WEBHOOK_CALLBACK_URL is configured for Trello push updates."
      : "TRELLO_WEBHOOK_CALLBACK_URL is missing, so Trello updates fall back to polling instead of instant push sync.",
    action: webhookCallbackConfigured
      ? "No action needed."
      : "Set TRELLO_WEBHOOK_CALLBACK_URL to the deployed /api/trello/webhook URL.",
  });

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
      const result = await db.execute(sql`SELECT COUNT(*) AS count FROM aptlss_plans`);
      const rows = Array.isArray(result) ? result[0] : result;
      const count = Number(Array.isArray(rows) ? (rows[0] as { count?: number | string } | undefined)?.count ?? 0 : 0);
      items.push({
        id: "aptlss-plan-data",
        label: "APTLSS planning data",
        status: count > 0 ? "ready" : "warning",
        message: count > 0 ? `${count} APTLSS card plan${count === 1 ? " is" : "s are"} available.` : "No APTLSS card plans exist; Day Plan and Decisions must use reduced Trello fallback data.",
        action: count > 0 ? "No action needed." : "Run APTLSS maintenance from Inbox before relying on generated plans or decision summaries.",
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

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => getSystemHealth({ probeDatabase: false, probeTrello: false })),

  readiness: publicProcedure
    .input(
      z
        .object({
          probeDatabase: z.boolean().optional(),
          probeTrello: z.boolean().optional(),
        })
        .optional()
    )
    .query(({ input }) => getSystemReadiness({ probeDatabase: input?.probeDatabase, probeTrello: input?.probeTrello })),

  notifyOwner: adminProcedure
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
