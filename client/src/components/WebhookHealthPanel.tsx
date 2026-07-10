/**
 * WebhookHealthPanel — Shows registered Trello webhooks with board name, webhook ID,
 * model ID (board ID), active status, and consecutive failures.
 * Designed to live inside the Settings tab.
 */
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Webhook,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

export default function WebhookHealthPanel() {
  const {
    data: readiness,
    isLoading: readinessLoading,
    error: readinessError,
  } = trpc.system.readiness.useQuery(
    { probeDatabase: false, probeTrello: false },
    {
      staleTime: 2 * 60_000,
      retry: false,
    },
  );

  const trelloApiKey = readiness?.items.find((item) => item.id === "trello-api-key");
  const trelloApiToken = readiness?.items.find((item) => item.id === "trello-api-token");
  const webhookCallback = readiness?.items.find((item) => item.id === "trello-webhook-callback-url");
  const webhookSecret = readiness?.items.find((item) => item.id === "trello-webhook-secret");
  const webhooksReady =
    trelloApiKey?.status === "ready" &&
    trelloApiToken?.status === "ready" &&
    webhookCallback?.status === "ready";
  const setupItems = [trelloApiKey, trelloApiToken, webhookCallback].filter(
    (item): item is NonNullable<typeof item> => Boolean(item && item.status !== "ready"),
  );

  const { data: webhooks, isLoading, error, refetch, isFetching } =
    trpc.trello.webhooks.useQuery(undefined, {
      enabled: webhooksReady,
      // Webhooks almost never change; poll every 15 min. Manual refresh button available.
      staleTime: 15 * 60_000,
      refetchInterval: 15 * 60_000,
      retry: false,
    });

  const activeCount = webhooks?.filter((w) => w.active).length ?? 0;
  const totalCount = webhooks?.length ?? 0;
  const hasFailures = webhooks?.some((w) => w.consecutiveFailures > 0) ?? false;

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Trello Webhook Health</span>
          {webhooks && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                hasFailures
                  ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                  : activeCount === totalCount && totalCount > 0
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted border-border text-muted-foreground"
              }`}
            >
              {totalCount === 0 ? "No webhooks" : `${activeCount}/${totalCount} active`}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => refetch()}
          disabled={!webhooksReady || isFetching}
          title="Refresh webhook status"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Content */}
      {readinessLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Checking webhook setup...
        </div>
      ) : readinessError ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>Webhook setup check failed: {readinessError.message}</span>
        </div>
      ) : !webhooksReady ? (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-medium">Webhook push sync is not enabled yet.</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800/80 dark:text-amber-300/90">
                The dashboard can still use polling, but production push sync needs Trello credentials and a deployed webhook callback URL.
              </p>
            </div>
          </div>
          {setupItems.length > 0 && (
            <div className="space-y-2">
              {setupItems.map((item) => (
                <div key={item.id} className="rounded-md border border-amber-500/20 bg-background/70 p-2">
                  <p className="text-xs font-semibold text-foreground">{item.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.action}</p>
                </div>
              ))}
            </div>
          )}
          {webhookSecret?.status !== "ready" && (
            <p className="rounded-md border border-amber-500/20 bg-background/70 p-2 text-xs text-muted-foreground">
              Optional hardening: {webhookSecret?.action ?? "Set TRELLO_WEBHOOK_SECRET or TRELLO_POWERUP_SECRET for production webhook hardening."}
            </p>
          )}
        </div>
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Loading webhooks…
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            Webhook status unavailable: {error.message}. Check Trello credentials, network access, and{" "}
            <code className="rounded bg-amber-500/20 px-1 py-0.5 text-xs">TRELLO_WEBHOOK_CALLBACK_URL</code>.
          </span>
        </div>
      ) : !webhooks || webhooks.length === 0 ? (
        <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <span>
            No webhooks registered. Set{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">TRELLO_WEBHOOK_CALLBACK_URL</code>{" "}
            and restart the server to auto-register.
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {webhooks.map((wh) => (
            <div
              key={wh.id}
              className={`rounded-lg border p-3 space-y-2 ${
                wh.consecutiveFailures > 0
                  ? "bg-red-500/5 border-red-500/20"
                  : wh.active
                  ? "bg-emerald-500/5 border-emerald-500/20"
                  : "bg-muted/30 border-border/50"
              }`}
            >
              {/* Top row: board name + active badge */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {wh.consecutiveFailures > 0 ? (
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  ) : wh.active ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="font-semibold text-sm text-foreground truncate">
                    {wh.boardName ?? wh.description ?? "Unknown Board"}
                  </span>
                  {wh.boardName && wh.description && wh.description !== wh.boardName && (
                    <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
                      ({wh.description})
                    </span>
                  )}
                </div>
                <span
                  className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${
                    wh.active
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  {wh.active ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Technical details row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-muted-foreground font-mono">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-muted-foreground/60 flex-shrink-0">Webhook ID:</span>
                  <span className="truncate">{wh.id}</span>
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-muted-foreground/60 flex-shrink-0">Board ID:</span>
                  <span className="truncate">{wh.idModel}</span>
                  <a
                    href={`https://trello.com/b/${wh.idModel}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 hover:text-foreground transition-colors"
                    title="Open board in Trello"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>

              {/* Failure info */}
              {wh.consecutiveFailures > 0 && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  ⚠ {wh.consecutiveFailures} consecutive failure
                  {wh.consecutiveFailures !== 1 ? "s" : ""}
                  {wh.firstConsecutiveFailDate
                    ? ` since ${new Date(wh.firstConsecutiveFailDate).toLocaleDateString()}`
                    : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
