/**
 * ReplyMonitor — Trello reply-thread monitoring dashboard.
 *
 * Shows:
 * 1. Active unanswered threads (pending / overdue) with 12h countdown
 * 2. Active vague-reply and unsigned-message flags requiring review
 * 3. History of all threads and resolved flags
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  PenLine,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useEatClock } from "@/hooks/useEatClock";
// ─── Countdown helpers ────────────────────────────────────────────────────────

function useCountdown(targetMs: number): { label: string; isExpired: boolean; urgency: "ok" | "warn" | "critical" } {
  const { nowMs } = useEatClock(5 * 60_000);
  // Minute-level precision is sufficient for this countdown.
  const remaining = targetMs - nowMs;
  if (remaining <= 0) return { label: "Overdue", isExpired: true, urgency: "critical" };
  const hours = Math.floor(remaining / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  const label = hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;
  const urgency = remaining < 60 * 60 * 1000 ? "critical" : remaining < 3 * 60 * 60 * 1000 ? "warn" : "ok";
  return { label, isExpired: false, urgency };
}

function CountdownBadge({ targetMs }: { targetMs: number }) {
  const { label, urgency } = useCountdown(targetMs);
  const cls =
    urgency === "critical"
      ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400"
      : urgency === "warn"
      ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
      : "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      <Clock className="w-3 h-3" />
      {label}
    </span>
  );
}

// ─── Thread card ──────────────────────────────────────────────────────────────

function ThreadCard({
  thread,
}: {
  thread: {
    id: number;
    source: string;
    cardId: string;
    cardName: string;
    cardUrl: string;
    boardName: string;
    listName: string;
    lastNonJoyceMsgAt: Date;
    lastNonJoyceAuthor: string;
    lastNonJoyceText: string | null;
    lastJoyceReplyAt: Date | null;
    status: string;
    demerited: boolean;
  };
}) {
  const [expanded, setExpanded] = useState(false);
  const deadline = new Date(thread.lastNonJoyceMsgAt).getTime() + 12 * 60 * 60 * 1000;
  const isOverdue = thread.status === "overdue";

  return (
    <div
      className={`rounded-lg border p-4 space-y-2 ${
        isOverdue
          ? "border-red-400/40 bg-red-500/5"
          : "border-amber-400/40 bg-amber-500/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={thread.cardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-sm text-foreground hover:underline flex items-center gap-1 truncate"
            >
              {thread.cardName}
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
            {thread.demerited && (
              <Badge variant="outline" className="text-xs bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400">
                D1 issued
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {thread.boardName} › {thread.listName}
          </p>
        </div>
        <CountdownBadge targetMs={deadline} />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="font-medium text-foreground">{thread.lastNonJoyceAuthor}</span>
        <span>replied</span>
        <span>{new Date(thread.lastNonJoyceMsgAt).toLocaleString()}</span>
        <button
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Hide latest message" : "Show latest message"}
          title={expanded ? "Hide latest message" : "Show latest message"}
          className="ml-auto text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="bg-muted/40 rounded p-2.5 text-xs text-muted-foreground italic leading-relaxed">
          "{(thread.lastNonJoyceText ?? "").slice(0, 400)}{(thread.lastNonJoyceText ?? "").length > 400 ? "…" : ""}"
        </div>
      )}
    </div>
  );
}

// ─── Vague flag card ──────────────────────────────────────────────────────────

function VagueFlagCard({
  flag,
  onResolve,
}: {
  flag: {
    id: number;
    source: string;
    cardId: string;
    cardName: string;
    cardUrl: string;
    actionId: string;
    messageText: string;
    flaggedAt: Date;
    resolvedAt: Date | null;
    demeritIssued: boolean;
    demeritIssuedAt: Date | null;
  };
  onResolve: (id: number) => void;
}) {
  const correctionDeadline = new Date(flag.flaggedAt).getTime() + 60 * 60 * 1000;
  const isActive = !flag.resolvedAt;

  return (
    <div className="rounded-lg border border-orange-400/40 bg-orange-500/5 p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={flag.cardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-sm text-foreground hover:underline flex items-center gap-1 truncate"
            >
              {flag.cardName}
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
            {flag.demeritIssued && (
              <Badge variant="outline" className="text-xs bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400">
                D1 issued
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Flagged at {new Date(flag.flaggedAt).toLocaleString()}
          </p>
        </div>
        {isActive && <CountdownBadge targetMs={correctionDeadline} />}
        {!isActive && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400">
            <CheckCircle className="w-3 h-3" />
            Resolved
          </span>
        )}
      </div>

      <div className="bg-muted/40 rounded p-2.5 text-xs text-muted-foreground italic leading-relaxed">
        <span className="font-semibold text-orange-700 dark:text-orange-400 not-italic">Vague reply: </span>
        "{flag.messageText.slice(0, 300)}{flag.messageText.length > 300 ? "…" : ""}"
      </div>

      {isActive && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 border-green-500/40 text-green-700 dark:text-green-400 hover:bg-green-500/10"
            onClick={() => onResolve(flag.id)}
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Mark as Corrected
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Unsigned flag card ──────────────────────────────────────────────────────

function UnsignedFlagCard({
  flag,
  onResolve,
}: {
  flag: {
    id: number;
    source: string;
    cardId: string;
    cardName: string;
    cardUrl: string;
    actionId: string;
    messageText: string;
    flaggedAt: Date;
    resolvedAt: Date | null;
    demeritIssued: boolean;
  };
  onResolve: (id: number, note: string) => void;
}) {
  const correctionDeadline = new Date(flag.flaggedAt).getTime() + 60 * 60 * 1000;
  const isActive = !flag.resolvedAt;
  const sourceLabel = flag.source === "upwork" ? "Upwork" : "Trello";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resolveNote, setResolveNote] = useState("");

  const handleResolveSubmit = () => {
    const trimmed = resolveNote.trim();
    if (!trimmed) return;
    onResolve(flag.id, trimmed);
    setDialogOpen(false);
    setResolveNote("");
  };

  return (
    <>
      <div className="rounded-lg border border-purple-400/40 bg-purple-500/5 p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400">
                {sourceLabel}
              </span>
              <a
                href={flag.cardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-sm text-foreground hover:underline flex items-center gap-1 truncate"
              >
                {flag.cardName}
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
              {flag.demeritIssued && (
                <Badge variant="outline" className="text-xs bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400">
                  D1 issued
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Flagged at {new Date(flag.flaggedAt).toLocaleString()}
            </p>
          </div>
          {isActive && <CountdownBadge targetMs={correctionDeadline} />}
          {!isActive && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400">
              <CheckCircle className="w-3 h-3" />
              Resolved
            </span>
          )}
        </div>

        <div className="bg-muted/40 rounded p-2.5 text-xs text-muted-foreground italic leading-relaxed">
          <span className="font-semibold text-purple-700 dark:text-purple-400 not-italic">Unsigned message: </span>
          "{flag.messageText.slice(0, 300)}{flag.messageText.length > 300 ? "\u2026" : ""}"
        </div>

        {isActive && (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 border-green-500/40 text-green-700 dark:text-green-400 hover:bg-green-500/10"
              onClick={() => setDialogOpen(true)}
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Mark Resolved
            </Button>
          </div>
        )}
      </div>

      {/* Resolve dialog with required note */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <PenLine className="w-4 h-4 text-purple-500" />
              Resolve Unsigned Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-xs text-muted-foreground">
              Confirm that a signed follow-up message was added to{" "}
              <span className="font-semibold text-foreground">{flag.cardName}</span>.
              Provide a brief note explaining the resolution (required).
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="resolve-note" className="text-xs font-medium">
                Resolution note <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="resolve-note"
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="e.g. Added '~ Joyce' as a follow-up comment on the card"
                className="text-xs min-h-[70px] resize-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleResolveSubmit();
                }}
              />
              <p className="text-[10px] text-muted-foreground">Ctrl+Enter to confirm</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setDialogOpen(false); setResolveNote(""); }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleResolveSubmit}
              disabled={!resolveNote.trim()}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
              Confirm Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

function ProgressiveRevealButton({
  visible,
  total,
  onShowMore,
}: {
  visible: number;
  total: number;
  onShowMore: () => void;
}) {
  if (visible >= total) return null;
  const nextCount = Math.min(PAGE_SIZE, total - visible);
  return (
    <Button type="button" variant="ghost" size="sm" className="w-full text-xs" onClick={onShowMore}>
      <ChevronDown className="h-3.5 w-3.5" />
      Show {nextCount} more
    </Button>
  );
}

export default function ReplyMonitor() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState("replies");
  const [visibleUnsignedCount, setVisibleUnsignedCount] = useState(PAGE_SIZE);
  const [visibleThreadHistoryCount, setVisibleThreadHistoryCount] = useState(PAGE_SIZE);
  const [visibleVagueHistoryCount, setVisibleVagueHistoryCount] = useState(PAGE_SIZE);
  const [visibleUnsignedHistoryCount, setVisibleUnsignedHistoryCount] = useState(PAGE_SIZE);
  const [clarificationResponse, setClarificationResponse] = useState("");
  const [clarificationResolution, setClarificationResolution] = useState<"completed" | "not_completed" | "not_required">("completed");

  // The server scans every 15 minutes and pushes completion over SSE. This
  // 30-minute poll is only a fallback for a missed push event.
  const { data: pendingThreads = [], isLoading: threadsLoading, error: threadsError } = trpc.replyMonitor.getPendingThreads.useQuery(
    undefined,
    { refetchInterval: 30 * 60_000 }
  );
  const { data: activeVagueFlags = [], isLoading: flagsLoading, error: flagsError } = trpc.replyMonitor.getActiveVagueFlags.useQuery(
    undefined,
    { refetchInterval: 30 * 60_000 }
  );
  const { data: activeUnsignedFlags = [], isLoading: unsignedLoading, error: unsignedError } = trpc.replyMonitor.getActiveUnsignedFlags.useQuery(
    undefined,
    { refetchInterval: 30 * 60_000 }
  );
  const { data: scanStatus, isLoading: statusLoading, error: statusError } = trpc.replyMonitor.getStatus.useQuery(
    undefined,
    { refetchInterval: 30 * 60_000 }
  );
  // History queries: no polling needed — they only change after a scan or resolve action.
  const { data: allThreads = [] } = trpc.replyMonitor.getAllThreads.useQuery({ limit: 50 });
  const { data: allVagueFlags = [] } = trpc.replyMonitor.getAllVagueFlags.useQuery({ limit: 50 });
  const { data: allUnsignedFlags = [] } = trpc.replyMonitor.getAllUnsignedFlags.useQuery({ limit: 50 });
  const { data: clarifications = [], error: clarificationError } = trpc.compliance.getClarifications.useQuery(
    { status: "open", limit: 100 },
    { refetchInterval: 5 * 60_000 },
  );
  const activeDataError = threadsError ?? flagsError ?? unsignedError ?? statusError;
  const lastSuccessfulAt = scanStatus?.lastSuccessfulAt ? new Date(scanStatus.lastSuccessfulAt) : null;
  const scanAgeMs = lastSuccessfulAt ? Date.now() - lastSuccessfulAt.getTime() : Number.POSITIVE_INFINITY;
  const scanIsFresh = scanAgeMs <= 30 * 60_000;
  const scanIsTrusted = Boolean(scanStatus && scanStatus.state !== "error" && scanIsFresh);

  const resolveFlag = trpc.replyMonitor.resolveVagueFlag.useMutation({
    onSuccess: () => {
      utils.replyMonitor.getActiveVagueFlags.invalidate();
      utils.replyMonitor.getAllVagueFlags.invalidate();
      utils.system.navigationCounts.invalidate();
      toast.success("Flag marked as corrected.");
    },
    onError: () => toast.error("Failed to resolve flag."),
  });

  const resolveUnsigned = trpc.replyMonitor.resolveUnsignedFlag.useMutation({
    onSuccess: () => {
      utils.replyMonitor.getActiveUnsignedFlags.invalidate();
      utils.replyMonitor.getAllUnsignedFlags.invalidate();
      utils.system.navigationCounts.invalidate();
      toast.success("Signature confirmed.");
    },
    onError: () => toast.error("Failed to resolve unsigned flag."),
  });

  const triggerScan = trpc.replyMonitor.triggerScan.useMutation({
    onSuccess: async (result) => {
      await Promise.all([
        utils.replyMonitor.getPendingThreads.invalidate(),
        utils.replyMonitor.getActiveVagueFlags.invalidate(),
        utils.replyMonitor.getActiveUnsignedFlags.invalidate(),
        utils.replyMonitor.getAllThreads.invalidate(),
        utils.replyMonitor.getAllVagueFlags.invalidate(),
        utils.replyMonitor.getAllUnsignedFlags.invalidate(),
        utils.replyMonitor.getStatus.invalidate(),
        utils.system.navigationCounts.invalidate(),
      ]);
      toast.success("Reply scan completed", { description: `${result.threadsScanned} Trello threads checked.` });
    },
    onError: (error) => toast.error("Reply scan failed", { description: error.message }),
  });

  const resolveClarification = trpc.compliance.resolveClarification.useMutation({
    onSuccess: async () => {
      setClarificationResponse("");
      setClarificationResolution("completed");
      await Promise.all([
        utils.compliance.getClarifications.invalidate(),
        utils.compliance.getHistory.invalidate(),
        utils.compliance.getCommunicationEvidence.invalidate(),
      ]);
      toast.success("Compliance update recorded.");
    },
    onError: (error) => toast.error("Could not record the update", { description: error.message }),
  });

  const overdueCount = pendingThreads.filter(t => t.status === "overdue").length;
  const pendingCount = pendingThreads.filter(t => t.status === "pending").length;
  const activeFlagCount = activeVagueFlags.length;
  const activeUnsignedCount = activeUnsignedFlags.length;
  const activeClarification = clarifications[0];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-500" />
            Reply Monitor
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Trello + Upwork · 12h reply rule · vague reply detection · signature review
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground" data-testid="reply-monitor-status">
            {statusLoading ? "Checking scan freshness..." : lastSuccessfulAt
              ? `Last successful scan ${lastSuccessfulAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
              : "No successful scan has been recorded yet"}
          </p>
        </div>
        <Button
          data-testid="reply-monitor-scan"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => triggerScan.mutate()}
          disabled={triggerScan.isPending}
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${triggerScan.isPending ? "animate-spin" : ""}`} />
          {triggerScan.isPending ? "Scanning..." : "Scan Now"}
        </Button>
      </div>

      {activeClarification && (
        <Card className="border-amber-500/50 bg-amber-500/5" data-testid="compliance-clarification">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-sm font-semibold text-foreground">Joyce update required now</p>
                  <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">
                    {clarifications.length} open
                  </Badge>
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">{activeClarification.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{activeClarification.question}</p>
              </div>
              <Badge variant="secondary" className="shrink-0 capitalize">{activeClarification.channel}</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Clarification outcome">
              {([
                ["completed", "Completed"],
                ["not_completed", "Not completed"],
                ["not_required", "Not required"],
              ] as const).map(([value, label]) => (
                <Button key={value} type="button" size="sm" variant={clarificationResolution === value ? "default" : "outline"} onClick={() => setClarificationResolution(value)}>
                  {label}
                </Button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compliance-update">What exactly happened?</Label>
              <Textarea
                id="compliance-update"
                value={clarificationResponse}
                onChange={(event) => setClarificationResponse(event.target.value)}
                placeholder="State what you did, when you did it, and where the evidence can be found."
                className="min-h-20"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">This update becomes part of the permanent compliance evidence.</p>
              <Button
                type="button"
                size="sm"
                disabled={clarificationResponse.trim().length < 10 || resolveClarification.isPending}
                onClick={() => resolveClarification.mutate({ id: activeClarification.id, resolution: clarificationResolution, response: clarificationResponse })}
              >
                {resolveClarification.isPending ? "Recording..." : "Record update"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {clarificationError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div><p className="text-sm font-semibold text-foreground">Compliance questions unavailable</p><p className="mt-1 text-xs text-muted-foreground">The queue could not verify whether Joyce has outstanding evidence requests.</p></div>
          </CardContent>
        </Card>
      )}

      {activeDataError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div><p className="text-sm font-semibold text-foreground">Reply status unavailable</p><p className="mt-1 text-xs text-muted-foreground">Do not treat this queue as clear until Trello reply data reconnects.</p></div>
          </CardContent>
        </Card>
      )}

      {!activeDataError && !statusLoading && !scanIsTrusted && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div><p className="text-sm font-semibold text-foreground">Reply status is not current</p><p className="mt-1 text-xs text-muted-foreground">Run a scan and wait for a successful completion before treating this queue as clear.</p></div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-9">
          <TabsTrigger value="replies" className="text-xs">
            Replies
            {(overdueCount + pendingCount) > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {overdueCount + pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="vague" className="text-xs">
            Vague Flags
            {activeFlagCount > 0 && (
              <span className="ml-1.5 bg-orange-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activeFlagCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="unsigned" className="text-xs">
            Unsigned
            {activeUnsignedCount > 0 && (
              <span className="ml-1.5 bg-purple-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activeUnsignedCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
        </TabsList>

        {/* ── Unanswered replies ── */}
        <TabsContent value="replies" className="space-y-3 mt-3">
          {activeDataError ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Active reply data could not be verified.</p>
          ) : threadsLoading ? (
            <div className="text-xs text-muted-foreground py-4 text-center">Loading threads…</div>
          ) : pendingThreads.length === 0 && scanIsTrusted ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">All clear</p>
                <p className="text-xs text-muted-foreground mt-1">No unanswered Trello threads right now.</p>
              </CardContent>
            </Card>
          ) : pendingThreads.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No verified reply result is available yet.</p>
          ) : (
            <div className="space-y-2">
              {/* Overdue first */}
              {pendingThreads
                .filter(t => t.status === "overdue")
                .map(t => (
                  <ThreadCard key={t.id} thread={{ ...t, lastNonJoyceMsgAt: t.lastNonJoyceMsgAt ? new Date(t.lastNonJoyceMsgAt) : new Date(), lastJoyceReplyAt: t.lastJoyceReplyAt ? new Date(t.lastJoyceReplyAt) : null }} />
                ))})
              {/* Then pending */}
              {pendingThreads
                .filter(t => t.status === "pending")
                .map(t => (
                  <ThreadCard key={t.id} thread={{ ...t, lastNonJoyceMsgAt: t.lastNonJoyceMsgAt ? new Date(t.lastNonJoyceMsgAt) : new Date(), lastJoyceReplyAt: t.lastJoyceReplyAt ? new Date(t.lastJoyceReplyAt) : null }} />
                ))}
            </div>
          )}

        </TabsContent>

        {/* ── Vague flags tab ── */}
        <TabsContent value="vague" className="space-y-3 mt-3">
          {flagsLoading ? (
            <div className="text-xs text-muted-foreground py-4 text-center">Loading flags…</div>
          ) : activeVagueFlags.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">No active vague flags</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Replies like "I'll get back to you tonight" are automatically detected and flagged here.
                </p>
              </CardContent>
            </Card>
          ) : (
            activeVagueFlags.map(f => (
              <VagueFlagCard
                key={f.id}
                flag={{ ...f, flaggedAt: new Date(f.flaggedAt), resolvedAt: f.resolvedAt ? new Date(f.resolvedAt) : null, demeritIssuedAt: null }}
                onResolve={id => resolveFlag.mutate({ id })}
              />
            ))
          )}

          {/* What counts as vague */}
          <Card className="border-dashed">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-foreground mb-2">What triggers a vague-reply flag?</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>"I'll get back to you tonight / today / soon"</li>
                <li>"I'll check on this later"</li>
                <li>"Will do" without any substance</li>
                <li>"Let me get back to you" without a timeframe or action</li>
                <li>Any reply that defers without addressing the situation</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Correct the flagged reply, then record the resolution. The monitor never changes pay automatically.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Unsigned messages tab ── */}
        <TabsContent value="unsigned" className="space-y-3 mt-3">
          {unsignedLoading ? (
            <div className="text-xs text-muted-foreground py-4 text-center">Loading unsigned flags…</div>
          ) : activeUnsignedFlags.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">All messages are signed</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Every message ends with ~ Angel or ~ Joyce.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {activeUnsignedFlags.slice(0, visibleUnsignedCount).map(f => (
                <UnsignedFlagCard
                  key={f.id}
                  flag={{ ...f, flaggedAt: new Date(f.flaggedAt), resolvedAt: f.resolvedAt ? new Date(f.resolvedAt) : null }}
                  onResolve={(id, note) => resolveUnsigned.mutate({ id, note })}
                />
              ))}
              <ProgressiveRevealButton
                visible={visibleUnsignedCount}
                total={activeUnsignedFlags.length}
                onShowMore={() => setVisibleUnsignedCount(count => count + PAGE_SIZE)}
              />
            </>
          )}

          <Card className="border-dashed">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-foreground mb-2">Signature rule</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Every message sent from the owner account must end with <strong>~ Angel</strong> or <strong>~ Joyce</strong></li>
                <li><strong>~ Joyce</strong> = Joyce wrote it (regardless of whose voice it’s in)</li>
                <li><strong>~ Angel</strong> = Angel personally wrote it</li>
                <li>Applies to both Trello card comments and Upwork messages</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Add a signed follow-up, then record the resolution. The monitor never changes pay automatically.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── History tab ── */}
        <TabsContent value="history" className="space-y-3 mt-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">All Threads (last 50)</p>
            {allThreads.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No thread history yet.</p>
            ) : (
              <div className="space-y-1">
                {allThreads.slice(0, visibleThreadHistoryCount).map(t => {
                  const statusColor =
                    t.status === "overdue"
                      ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400"
                      : t.status === "replied"
                      ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400";
                  return (
                    <div key={t.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusColor}`}>
                        {t.status.toUpperCase()}
                      </span>
                      <a
                        href={t.cardUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-foreground hover:underline flex-1 truncate"
                      >
                        {t.cardName}
                      </a>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {t.lastNonJoyceMsgAt ? new Date(t.lastNonJoyceMsgAt).toLocaleDateString() : "—"}
                      </span>
                    </div>
                  );
                })}
                <ProgressiveRevealButton
                  visible={visibleThreadHistoryCount}
                  total={allThreads.length}
                  onShowMore={() => setVisibleThreadHistoryCount(count => count + PAGE_SIZE)}
                />
              </div>
            )}
          </div>

          <div className="space-y-1 mt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vague Flag History (last 50)</p>
            {allVagueFlags.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No vague flag history yet.</p>
            ) : (
              <div className="space-y-1">
                {allVagueFlags.slice(0, visibleVagueHistoryCount).map(f => (
                  <div key={f.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                    {f.demeritIssued ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400">
                        D1 ISSUED
                      </span>
                    ) : f.resolvedAt ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400">
                        RESOLVED
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400">
                        ACTIVE
                      </span>
                    )}
                    <a
                      href={f.cardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-foreground hover:underline flex-1 truncate"
                    >
                      {f.cardName}
                    </a>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {new Date(f.flaggedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
                <ProgressiveRevealButton
                  visible={visibleVagueHistoryCount}
                  total={allVagueFlags.length}
                  onShowMore={() => setVisibleVagueHistoryCount(count => count + PAGE_SIZE)}
                />
              </div>
            )}
          </div>

          <div className="space-y-1 mt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Signature Flag History (last 50)</p>
            {allUnsignedFlags.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No signature flag history yet.</p>
            ) : (
              <div className="space-y-1">
                {allUnsignedFlags.slice(0, visibleUnsignedHistoryCount).map((flag) => (
                  <div key={flag.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                    {flag.demeritIssued ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400">D1 ISSUED</span>
                    ) : flag.resolvedAt ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400">RESOLVED</span>
                    ) : (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400">ACTIVE</span>
                    )}
                    <a href={flag.cardUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-foreground hover:underline flex-1 truncate">{flag.cardName}</a>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{new Date(flag.flaggedAt).toLocaleDateString()}</span>
                  </div>
                ))}
                <ProgressiveRevealButton
                  visible={visibleUnsignedHistoryCount}
                  total={allUnsignedFlags.length}
                  onShowMore={() => setVisibleUnsignedHistoryCount(count => count + PAGE_SIZE)}
                />
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
