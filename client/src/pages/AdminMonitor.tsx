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
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
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

type AssessmentReviewItem = {
  id: number;
  cardId: string;
  cardName: string;
  primaryState: string;
  stateReason: string;
  confidenceScore: number;
  priorityTier: string;
  engineVersion: string;
  forecastP50Minutes: number | null;
  bottleneckScore: number;
  assessedAt: Date | string;
};

const ASSESSMENT_STATES = [
  "NEW_UNTRIAGED", "READY_TO_START", "IN_PROGRESS", "WAITING_FOR_JOYCE",
  "WAITING_FOR_ROBERT", "WAITING_FOR_EXTERNAL_PARTY", "BLOCKED_BY_OTHER_CARD",
  "STALLED", "OVERDUE", "READY_FOR_REVIEW", "READY_FOR_DONE", "DONE_CONFIRMED",
  "NEEDS_RESTRUCTURING", "NEEDS_ARCHIVE",
] as const;

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
  const utils = trpc.useUtils();
  const { data, isFetching, refetch } = trpc.aptlss.getAdminMonitor.useQuery(undefined, {
    retry: false,
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  const { data: recentAudit } = trpc.aptlss.getRecentAuditLog.useQuery(
    { limit: 100 },
    { retry: false, staleTime: 2 * 60_000 }
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

  const [correctionItem, setCorrectionItem] = useState<AssessmentReviewItem | null>(null);
  const [correctedState, setCorrectedState] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");
  const recordFeedback = trpc.aptlss.recordAssessmentFeedback.useMutation({
    onSuccess: async () => {
      toast.success("Assessment review recorded");
      setCorrectionItem(null);
      setCorrectedState("");
      setCorrectionNote("");
      await Promise.all([
        refetch(),
        utils.aptlss.getAssessmentCalibration.invalidate(),
        utils.aptlss.getAssessmentReviewQueue.invalidate(),
      ]);
    },
    onError: (err) => toast.error("Review was not recorded", { description: err.message }),
  });

  const [showFullSyncLog, setShowFullSyncLog] = useState(false);
  const [showFullAuditLog, setShowFullAuditLog] = useState(false);

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
  const assessmentHealth = data?.assessmentHealth;
  const calibration = data?.calibration;
  const assessmentReviewQueue = (data?.assessmentReviewQueue ?? []) as AssessmentReviewItem[];
  const latestJobRuns = data?.latestJobRuns ?? [];
  const refreshMonitor = () => {
    void refetchReadiness();
    void refetch();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="container py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                <Link href="/robert" aria-label="Back to Robert's dashboard" title="Back to Robert's dashboard">
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Shield className="w-4 h-4 text-muted-foreground" />
              <h1 className="text-sm font-semibold text-foreground">Admin Monitor</h1>
              {isFetching && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => runMaintenance.mutate()}
                disabled={runMaintenance.isPending}
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
        <Card>
          <CardContent className="p-4">
            <SectionTitle icon={<BarChart2 className="h-3.5 w-3.5 text-blue-500" />} title="APTLSS Intelligence Health" />
            <div className="grid grid-cols-2 divide-x divide-y divide-border border border-border sm:grid-cols-6 sm:divide-y-0">
              {[
                ["Assessed", assessmentHealth?.assessedCards ?? 0, `${assessmentHealth?.unassessedCards ?? 0} unassessed`],
                ["Fresh", assessmentHealth?.freshCards ?? 0, `${assessmentHealth?.dueForAssessment ?? 0} due now`],
                ["Confidence", `${assessmentHealth?.averageConfidence ?? 0}%`, `${assessmentHealth?.lowConfidenceCards ?? 0} below 60%`],
                ["Near certainty", assessmentHealth?.nearCertaintyCards ?? 0, `at least ${assessmentHealth?.nearCertaintyTarget ?? 99}%`],
                ["Plan coverage", `${assessmentHealth?.planCoveragePct ?? 0}%`, `${assessmentHealth?.planCount ?? 0} plans`],
                ["Engine", assessmentHealth?.engineVersion ?? "-", `${assessmentHealth?.outdatedEngineCards ?? 0} outdated`],
              ].map(([label, value, detail]) => (
                <div key={label} className="min-w-0 px-3 py-3 first:pl-3">
                  <p className="text-[10px] font-medium uppercase text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 divide-y divide-border border border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[
                ["Validated accuracy", calibration?.accuracyScore == null ? "No sample" : `${calibration.accuracyScore}%`, `${calibration?.sampleSize ?? 0} reviewed snapshots`],
                ["Forecast learning", assessmentHealth?.forecastCalibrationSamples ?? 0, `${assessmentHealth?.forecastCalibratedCards ?? 0} cards calibrated`],
                ["Portfolio risks", (assessmentHealth?.dependencyCycleCards ?? 0) + (assessmentHealth?.portfolioBottlenecks ?? 0), `${assessmentHealth?.dependencyCycleCards ?? 0} cycle / ${assessmentHealth?.portfolioBottlenecks ?? 0} bottleneck`],
              ].map(([label, value, detail]) => (
                <div key={label} className="min-w-0 px-3 py-3">
                  <p className="text-[10px] font-medium uppercase text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 border border-border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">Path to {assessmentHealth?.nearCertaintyTarget ?? 99}% validated confidence</p>
                <Badge variant="outline">{assessmentHealth?.nearCertaintyCards ?? 0} cards qualified</Badge>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {assessmentHealth?.humanReviewsRemaining ?? 10} assessment review(s) and {assessmentHealth?.forecastSamplesRemaining ?? 2} fully timed completed card(s) remain before the engine can claim near-certainty. These gates use observed outcomes; they are not model self-ratings.
              </p>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Confidence combines Trello evidence, dependencies, tracked work, reply and decision age, schedule state, and forecast uncertainty. Validated accuracy is calculated only from human-reviewed snapshots.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <SectionTitle icon={<Clock className="h-3.5 w-3.5 text-blue-500" />} title="Scheduled Job Freshness" />
            {latestJobRuns.length === 0 ? (
              <p className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                No durable job executions have been recorded yet. Apply migrations and let the scheduler complete its first cycle.
              </p>
            ) : (
              <div className="divide-y divide-border border border-border">
                {latestJobRuns.map((run) => (
                  <div key={run.jobKey} className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{run.jobKey.replaceAll("_", " ")}</p>
                        <Badge variant="outline">{run.status}</Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{run.detail || run.errorMessage || `${run.recordsProcessed} records processed`}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(run.startedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
            <CardContent className="p-4">
              <SectionTitle icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />} title="Assessment Review Queue" />
              {assessmentReviewQueue.length === 0 ? (
                <p className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  No unreviewed assessment snapshots are available.
                </p>
              ) : (
                <div className="divide-y divide-border border border-border">
                  {assessmentReviewQueue.slice(0, 5).map((item) => (
                    <div key={item.id} className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{item.cardName}</p>
                          <Badge variant="outline" className="text-[10px]">{item.primaryState.replaceAll("_", " ")}</Badge>
                          <span className="text-[10px] text-muted-foreground">{item.confidenceScore}% confidence</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.stateReason}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {item.forecastP50Minutes == null ? "No forecast" : `P50 ${item.forecastP50Minutes}m`} · Bottleneck {item.bottleneckScore}/100
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-1" aria-label={`Review ${item.cardName}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-[11px]"
                          disabled={recordFeedback.isPending}
                          onClick={() => recordFeedback.mutate({ assessmentId: item.id, verdict: "accurate" })}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Accurate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-[11px]"
                          disabled={recordFeedback.isPending}
                          onClick={() => recordFeedback.mutate({ assessmentId: item.id, verdict: "partial" })}
                        >
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Partial
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-[11px]"
                          disabled={recordFeedback.isPending}
                          onClick={() => { setCorrectionItem(item); setCorrectedState(""); setCorrectionNote(""); }}
                        >
                          <XCircle className="h-3.5 w-3.5 text-red-500" /> Incorrect
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Reviews calibrate measured accuracy only. They do not modify Trello cards or rewrite historical snapshots.
              </p>
            </CardContent>
        </Card>
        <Dialog open={Boolean(correctionItem)} onOpenChange={(open) => { if (!open) setCorrectionItem(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Correct assessment</DialogTitle>
              <DialogDescription>
                Select the state that best matches {correctionItem?.cardName}. The original snapshot remains immutable.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Select value={correctedState} onValueChange={setCorrectedState}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose corrected state" /></SelectTrigger>
                <SelectContent>
                  {ASSESSMENT_STATES.map((state) => <SelectItem key={state} value={state}>{state.replaceAll("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
              <Textarea
                value={correctionNote}
                onChange={(event) => setCorrectionNote(event.target.value)}
                className="min-h-24"
                placeholder="Optional evidence or reason for the correction"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCorrectionItem(null)}>Cancel</Button>
              <Button
                disabled={!correctionItem || !correctedState || recordFeedback.isPending}
                onClick={() => correctionItem && recordFeedback.mutate({
                  assessmentId: correctionItem.id,
                  verdict: "inaccurate",
                  correctedState: correctedState as (typeof ASSESSMENT_STATES)[number],
                  note: correctionNote.trim() || undefined,
                })}
              >
                {recordFeedback.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Record correction
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
