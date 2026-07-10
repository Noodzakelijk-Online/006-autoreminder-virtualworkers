/**
 * AdminMonitor — Owner-only system health and automation monitoring page.
 *
 * Shows:
 *   - Sync health: last successful sync, 24h stats, recent sync log
 *   - Webhook status: active/inactive, count
 *   - Automation actions taken (audit log)
 *   - Cards skipped due to low confidence
 *   - Pending approvals (drafts awaiting human sign-off)
 *   - Failed recommendations (low-confidence escalations)
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  Shield,
  Webhook,
  Zap,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  BarChart2,
  History,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border p-3 ${color}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function readinessTone(status: "ready" | "warning" | "blocked") {
  if (status === "blocked") {
    return {
      icon: <XCircle className="w-3.5 h-3.5 text-red-500" />,
      badge: "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-300",
      row: "bg-red-500/5 border-red-500/20",
      label: "Blocked",
    };
  }
  if (status === "warning") {
    return {
      icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
      badge: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300",
      row: "bg-amber-500/5 border-amber-500/20",
      label: "Warning",
    };
  }
  return {
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
    badge: "bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-300",
    row: "bg-green-500/5 border-green-500/20",
    label: "Ready",
  };
}

export default function AdminMonitor() {
  const { user, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const adminQueriesEnabled = Boolean(user) && !authLoading;
  const { data, isLoading, isFetching, refetch, error } = trpc.aptlss.getAdminMonitor.useQuery(undefined, {
    enabled: adminQueriesEnabled,
    retry: false,
    staleTime: 2 * 60_000,
    refetchInterval: adminQueriesEnabled ? 5 * 60_000 : false,
  });

  const { data: recentAudit } = trpc.aptlss.getRecentAuditLog.useQuery(
    { limit: 100 },
    { enabled: adminQueriesEnabled, retry: false, staleTime: 2 * 60_000 }
  );
  const {
    data: readiness,
    isLoading: readinessLoading,
    error: readinessError,
    refetch: refetchReadiness,
  } = trpc.system.readiness.useQuery(
    { probeDatabase: true },
    {
      retry: false,
      staleTime: 60_000,
      refetchInterval: 5 * 60_000,
    },
  );

  const runMaintenance = trpc.aptlss.runMaintenanceNow.useMutation({
    onSuccess: async (result) => {
      toast.success("Maintenance run complete", {
        description: `${result.refreshed}/${result.total} card plans refreshed; ${result.failed} failed.`,
      });
      await Promise.all([
        refetch(),
        refetchReadiness(),
        utils.aptlss.getRecentAuditLog.invalidate(),
      ]);
    },
    onError: (err) => {
      toast.error("Maintenance run failed", { description: err.message });
    },
  });

  const [showFullSyncLog, setShowFullSyncLog] = useState(false);
  const [showFullAuditLog, setShowFullAuditLog] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Loading admin monitor…</p>
        </div>
      </div>
    );
  }
  // Access denied — not the owner
  if (error?.data?.code === 'FORBIDDEN' || error?.data?.code === 'UNAUTHORIZED' || (user && !authLoading && error)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="text-lg font-semibold text-foreground">Access Restricted</h1>
          <p className="text-sm text-muted-foreground">Admin monitoring is only accessible to the project owner.</p>
          <Link href="/robert">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-3 h-3 mr-1" /> Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const syncStats = data?.syncStats;
  const lastSync = data?.lastSync;
  const webhookStatus = data?.webhookStatus;
  const trelloApiKeyStatus = readiness?.items.find((item) => item.id === "trello-api-key")?.status;
  const trelloApiTokenStatus = readiness?.items.find((item) => item.id === "trello-api-token")?.status;
  const trelloApiAccessItem = readiness?.items.find((item) => item.id === "trello-api-access");
  const webhookCallbackItem = readiness?.items.find((item) => item.id === "trello-webhook-callback-url");
  const webhookSecretItem = readiness?.items.find((item) => item.id === "trello-webhook-secret");
  const trelloCredentialsReady = trelloApiKeyStatus === "ready" && trelloApiTokenStatus === "ready" && trelloApiAccessItem?.status === "ready";
  const webhookCallbackReady = webhookCallbackItem?.status === "ready";
  const pendingApprovals = data?.pendingApprovals ?? [];
  const cardsSkipped = data?.cardsSkipped ?? [];
  const failedRecs = data?.failedRecs ?? [];
  const recentSyncs = data?.recentSyncs ?? [];
  const refreshMonitor = () => {
    void refetchReadiness();
    if (adminQueriesEnabled) {
      void refetch();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="container py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Link href="/robert">
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  <ArrowLeft className="w-3 h-3 mr-1" /> Back
                </Button>
              </Link>
              <Shield className="w-4 h-4 text-muted-foreground" />
              <h1 className="text-sm font-semibold text-foreground">Admin Monitor</h1>
              {isFetching && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => runMaintenance.mutate()}
                disabled={!adminQueriesEnabled || runMaintenance.isPending}
                title="Run APTLSS maintenance now"
              >
                {runMaintenance.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                Run Maintenance
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={refreshMonitor} disabled={runMaintenance.isPending}>
                <RefreshCw className="w-3 h-3 mr-1" /> Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6 max-w-4xl">
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
              <SectionTitle icon={<Shield className="w-3.5 h-3.5 text-slate-600" />} title="Production Readiness" />
              {readiness && (
                <Badge variant="outline" className={readinessTone(readiness.status).badge}>
                  {readinessTone(readiness.status).label}
                </Badge>
              )}
            </div>

            {readinessLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Checking required production setup...
              </div>
            ) : readinessError ? (
              <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-3.5 h-3.5" />
                Readiness check failed: {readinessError.message}
              </div>
            ) : readiness ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <StatCard
                    label="Ready"
                    value={readiness.counts.ready}
                    color="bg-green-500/5 border-green-500/20"
                    icon={<CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                  />
                  <StatCard
                    label="Warnings"
                    value={readiness.counts.warning}
                    color={readiness.counts.warning ? "bg-amber-500/5 border-amber-500/20" : "bg-muted border-border"}
                    icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                  />
                  <StatCard
                    label="Blocked"
                    value={readiness.counts.blocked}
                    color={readiness.counts.blocked ? "bg-red-500/5 border-red-500/20" : "bg-muted border-border"}
                    icon={<XCircle className="w-3.5 h-3.5 text-red-500" />}
                  />
                </div>

                <div className="text-xs text-muted-foreground">
                  {readiness.summary} Last checked{" "}
                  {new Date(readiness.checkedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.
                </div>

                <div className="space-y-2">
                  {readiness.items.map((item) => {
                    const tone = readinessTone(item.status);
                    return (
                      <div key={item.id} className={`rounded-lg border p-3 ${tone.row}`}>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">{tone.icon}</div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-semibold text-foreground">{item.label}</p>
                              <Badge variant="outline" className={tone.badge}>
                                {tone.label}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{item.message}</p>
                            {item.status !== "ready" && (
                              <p className="mt-1 text-[10px] font-medium text-foreground">{item.action}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
        {/* ── Sync Health Stats ─────────────────────────────────────────────── */}
        {!adminQueriesEnabled && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-foreground">Owner monitor data is locked.</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Production readiness is public, but sync logs, automation history, and approval details load only after an owner session is available.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="p-4">
            <SectionTitle icon={<Activity className="w-3.5 h-3.5 text-blue-500" />} title="Sync Health (Last 24h)" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <StatCard
                label="Total Syncs"
                value={syncStats?.totalRuns ?? 0}
                color="bg-blue-500/5 border-blue-500/20"
                icon={<Activity className="w-3.5 h-3.5 text-blue-500" />}
              />
              <StatCard
                label="Successful"
                value={syncStats?.successRuns ?? 0}
                color="bg-green-500/5 border-green-500/20"
                icon={<CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
              />
              <StatCard
                label="Failed"
                value={syncStats?.failedRuns ?? 0}
                color={syncStats?.failedRuns ? "bg-red-500/5 border-red-500/20" : "bg-muted border-border"}
                icon={<XCircle className="w-3.5 h-3.5 text-red-500" />}
              />
              <StatCard
                label="Cards Synced"
                value={syncStats?.totalCardsProcessed ?? 0}
                color="bg-purple-500/5 border-purple-500/20"
                icon={<BarChart2 className="w-3.5 h-3.5 text-purple-500" />}
              />
            </div>
            {/* Last successful sync */}
            {lastSync && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                Last successful sync:{" "}
                <span className="text-foreground font-medium">
                  {new Date(lastSync.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
                {lastSync.cardsProcessed != null && (
                  <span>· {lastSync.cardsProcessed} cards</span>
                )}
              </div>
            )}
            {/* Recent sync log */}
            <div>
              <button
                onClick={() => setShowFullSyncLog(o => !o)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <History className="w-3 h-3" />
                Recent sync log ({recentSyncs.length})
                {showFullSyncLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showFullSyncLog && (
                <div className="mt-2 space-y-1 border-l-2 border-muted pl-3 max-h-48 overflow-y-auto">
                  {recentSyncs.map((s, i) => (
                    <div key={i} className="text-[10px] text-muted-foreground flex items-center gap-2">
                      {s.success ? (
                        <CheckCircle2 className="w-2.5 h-2.5 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-2.5 h-2.5 text-red-500 flex-shrink-0" />
                      )}
                      <span className="text-foreground font-medium">
                        {new Date(s.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span>{s.cardsProcessed ?? 0} cards</span>
                      {s.errorMessage && (
                        <span className="text-red-500 truncate">{s.errorMessage}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Webhook Status ────────────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-4">
            <SectionTitle icon={<Webhook className="w-3.5 h-3.5 text-indigo-500" />} title="Webhook Status" />
            {!trelloCredentialsReady ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <div className="flex items-start gap-2">
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Trello access is not ready.</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {trelloApiAccessItem?.message ?? "Set TrelloAPIKey and TrelloAPIToken before webhook status can be checked."}
                    </p>
                    {trelloApiAccessItem?.status !== "ready" && (
                      <p className="mt-1 text-[10px] font-medium text-foreground">
                        {trelloApiAccessItem?.action ?? "Verify the Trello API key/token pair."}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : !webhookCallbackReady ? (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Webhook push sync is not enabled.</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {webhookCallbackItem?.message ?? "TRELLO_WEBHOOK_CALLBACK_URL is missing."}
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-foreground">
                      {webhookCallbackItem?.action ?? "Set TRELLO_WEBHOOK_CALLBACK_URL to the deployed /api/trello/webhook URL."}
                    </p>
                    {webhookSecretItem?.status !== "ready" && (
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        Optional hardening: {webhookSecretItem?.action ?? "Set TRELLO_WEBHOOK_SECRET or TRELLO_POWERUP_SECRET for production webhook hardening."}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : webhookStatus ? (
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${webhookStatus.active ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}>
                  {webhookStatus.active ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${webhookStatus.active ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
                    {webhookStatus.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">{webhookStatus.count} webhook{webhookStatus.count !== 1 ? 's' : ''} registered</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Webhook status is unavailable from the owner monitor. Use the readiness checks above and retry after deployment configuration is complete.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Pending Approvals ─────────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-4">
            <SectionTitle icon={<Clock className="w-3.5 h-3.5 text-amber-500" />} title={`Pending Approvals (${pendingApprovals.length})`} />
            {pendingApprovals.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                No drafts awaiting approval.
              </div>
            ) : (
              <div className="space-y-2">
                {pendingApprovals.map(entry => (
                  <div key={entry.id} className="flex items-start gap-2 p-2.5 rounded-lg border bg-amber-500/5 border-amber-500/20">
                    <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{entry.cardName}</p>
                      <p className="text-[10px] text-muted-foreground">{entry.action.replace(/_/g, ' ')} — {entry.description}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                    {entry.confidenceScore != null && (
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {entry.confidenceScore}% conf.
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Cards Skipped (Low Confidence) ───────────────────────────────── */}
        <Card>
          <CardContent className="p-4">
            <SectionTitle icon={<AlertTriangle className="w-3.5 h-3.5 text-orange-500" />} title={`Cards Skipped — Low Confidence (${cardsSkipped.length})`} />
            {cardsSkipped.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                No cards were skipped due to low confidence in the last 24h.
              </div>
            ) : (
              <div className="space-y-2">
                {cardsSkipped.map(entry => (
                  <div key={entry.id} className="flex items-start gap-2 p-2.5 rounded-lg border bg-orange-500/5 border-orange-500/20">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{entry.cardName}</p>
                      <p className="text-[10px] text-muted-foreground">{entry.description}</p>
                    </div>
                    {entry.confidenceScore != null && (
                      <span className="text-[10px] text-orange-600 dark:text-orange-400 flex-shrink-0 font-medium">
                        {entry.confidenceScore}% conf.
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Failed Recommendations ────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-4">
            <SectionTitle icon={<XCircle className="w-3.5 h-3.5 text-red-500" />} title={`Failed Recommendations (${failedRecs.length})`} />
            {failedRecs.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                No failed recommendations.
              </div>
            ) : (
              <div className="space-y-2">
                {failedRecs.map(entry => (
                  <div key={entry.id} className="flex items-start gap-2 p-2.5 rounded-lg border bg-red-500/5 border-red-500/20">
                    <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{entry.cardName}</p>
                      <p className="text-[10px] text-muted-foreground">{entry.description}</p>
                    </div>
                    {entry.confidenceScore != null && (
                      <span className="text-[10px] text-red-600 dark:text-red-400 flex-shrink-0 font-medium">
                        {entry.confidenceScore}% conf.
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Full Automation Audit Log ─────────────────────────────────────── */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <SectionTitle icon={<History className="w-3.5 h-3.5 text-slate-500" />} title="Recent Automation Log" />
              <button
                onClick={() => setShowFullAuditLog(o => !o)}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                {showFullAuditLog ? "Collapse" : "Expand all"}
                {showFullAuditLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
            {(recentAudit?.length ?? 0) === 0 ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                No automation actions recorded yet.
              </div>
            ) : (
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {(showFullAuditLog ? recentAudit : recentAudit?.slice(0, 20))?.map(entry => (
                  <div key={entry.id} className="flex items-start gap-2 py-1.5 border-b border-border/40 last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 flex-shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                        <span className="text-[10px] font-medium text-foreground">{entry.action.replace(/_/g, ' ')}</span>
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 truncate">{entry.cardName}</span>
                        {entry.confidenceScore != null && (
                          <span className="text-[10px] text-muted-foreground">{entry.confidenceScore}%</span>
                        )}
                        {entry.approved === true && (
                          <span className="text-[10px] text-green-600 dark:text-green-400">✓ approved</span>
                        )}
                        {entry.requiresApproval && entry.approved == null && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400">⏳ pending</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{entry.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
