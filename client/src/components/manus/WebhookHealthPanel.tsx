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
  const { data: webhooks, isLoading, refetch, isFetching } =
    trpc.trello.webhooks.useQuery(undefined, {
      // Webhooks almost never change; poll every 15 min. Manual refresh button available.
      staleTime: 15 * 60_000,
      refetchInterval: 15 * 60_000,
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
          disabled={isFetching}
          title="Refresh webhook status"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Loading webhooks…
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
