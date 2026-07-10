/**
 * EmailInbox — Gmail inbox management page for Joyce.
 *
 * Goals:
 *   - Show ALL emails (not just unread) — inbox-zero every day
 *   - Financial emails: 48h deadline countdown, archive when handled
 *   - Non-financial emails: LLM-suggested Trello card link + next action
 *   - Inbox-zero progress bar
 *   - Batch "Archive All" button for end-of-day inbox zero
 *
 * Data is populated by the AGENT cron that scans Gmail and calls
 * trpc.emailInbox.upsertBatch. This page is read-only from the DB.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Mail,
  Archive,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Inbox,
  DollarSign,
  MessageSquare,
  Zap,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type EmailTask = {
  id: number;
  gmailMessageId: string;
  gmailThreadId: string;
  subject: string;
  fromAddress: string;
  fromName: string;
  snippet: string | null;
  receivedAt: Date;
  category: "financial" | "non_financial";
  status: "pending" | "processed" | "archived";
  deadlineAt: Date | null;
  trelloCardId: string | null;
  trelloCardName: string | null;
  trelloCardUrl: string | null;
  suggestedNextAction: string | null;
  llmSummary: string | null;
  processedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getFinancialDeadlineInfo(email: EmailTask): {
  label: string;
  className: string;
  urgent: boolean;
} {
  // Financial emails have a 48h deadline from receivedAt
  const deadline = email.deadlineAt
    ? new Date(email.deadlineAt).getTime()
    : new Date(email.receivedAt).getTime() + 48 * 3600 * 1000;
  const remaining = deadline - Date.now();
  const hoursLeft = remaining / 3600000;

  if (remaining <= 0) {
    return { label: "OVERDUE", className: "text-red-600 dark:text-red-400 font-bold", urgent: true };
  }
  if (hoursLeft < 6) {
    return {
      label: `${Math.floor(hoursLeft)}h ${Math.floor((hoursLeft % 1) * 60)}m left`,
      className: "text-red-600 dark:text-red-400 font-semibold",
      urgent: true,
    };
  }
  if (hoursLeft < 24) {
    return {
      label: `${Math.floor(hoursLeft)}h left`,
      className: "text-orange-600 dark:text-orange-400 font-semibold",
      urgent: true,
    };
  }
  return {
    label: `${Math.floor(hoursLeft)}h left`,
    className: "text-muted-foreground",
    urgent: false,
  };
}

// ── Email Row ─────────────────────────────────────────────────────────────────
function EmailRow({
  email,
  onArchive,
  onProcess,
  isArchiving,
}: {
  email: EmailTask;
  onArchive: (id: number) => void;
  onProcess: (id: number) => void;
  isArchiving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isFinancial = email.category === "financial";
  const isArchived = email.status === "archived";
  const isProcessed = email.status === "processed";
  const deadline = isFinancial ? getFinancialDeadlineInfo(email) : null;

  return (
    <div
      className={`border rounded-lg transition-all ${
        isArchived
          ? "opacity-50 bg-muted/30 border-border/40"
          : isProcessed
          ? "bg-emerald-500/5 border-emerald-500/20"
          : isFinancial && deadline?.urgent
          ? "bg-red-500/5 border-red-500/30"
          : "bg-card border-border hover:border-border/80"
      }`}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Status icon */}
        <div className="flex-shrink-0 mt-0.5">
          {isArchived ? (
            <Archive className="w-4 h-4 text-muted-foreground/50" />
          ) : isProcessed ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : isFinancial ? (
            <DollarSign className={`w-4 h-4 ${deadline?.urgent ? "text-red-500" : "text-amber-500"}`} />
          ) : (
            <Mail className="w-4 h-4 text-blue-500" />
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${isArchived ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {email.subject}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {email.fromName || email.fromAddress}
                {email.fromName && email.fromAddress && ` <${email.fromAddress}>`}
                <span className="mx-1.5">·</span>
                {formatRelativeTime(email.receivedAt)}
              </p>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isFinancial && !isArchived && deadline && (
                <span className={`text-xs font-medium ${deadline.className}`}>
                  {deadline.label}
                </span>
              )}
              {isFinancial && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-600 dark:text-amber-400">
                  Financial
                </Badge>
              )}
              {isProcessed && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                  Processed
                </Badge>
              )}
              {isArchived && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border/40 text-muted-foreground">
                  Archived
                </Badge>
              )}
            </div>
          </div>

          {/* Snippet */}
          {email.snippet && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{email.snippet}</p>
          )}

          {/* Expanded details */}
          {expanded && (
            <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
              {email.llmSummary && (
                <div className="flex items-start gap-2">
                  <Zap className="w-3.5 h-3.5 text-violet-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-foreground">{email.llmSummary}</p>
                </div>
              )}
              {email.suggestedNextAction && (
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-foreground">
                    <span className="font-medium">Next action: </span>
                    {email.suggestedNextAction}
                  </p>
                </div>
              )}
              {email.trelloCardName && email.trelloCardUrl && (
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
                  </div>
                  <a
                    href={email.trelloCardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    {email.trelloCardName}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Expand/collapse */}
          {(email.llmSummary || email.suggestedNextAction || email.trelloCardName) && (
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              className="p-1 rounded hover:bg-accent/50 transition-colors"
              title={expanded ? "Collapse" : "Expand details"}
            >
              {expanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          )}

          {/* Open in Gmail */}
          <a
            href={`https://mail.google.com/mail/u/0/#inbox/${email.gmailThreadId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded hover:bg-accent/50 transition-colors"
            title="Open in Gmail"
          >
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
          </a>

          {/* Mark as processed */}
          {!isArchived && !isProcessed && (
            <button
              type="button"
              onClick={() => onProcess(email.id)}
              className="p-1 rounded hover:bg-emerald-500/10 transition-colors"
              title="Mark as processed"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground hover:text-emerald-500" />
            </button>
          )}

          {/* Archive */}
          {!isArchived && (
            <button
              type="button"
              onClick={() => onArchive(email.id)}
              disabled={isArchiving}
              className="p-1 rounded hover:bg-accent/50 transition-colors disabled:opacity-50"
              title="Archive"
            >
              <Archive className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function EmailInbox() {
  const utils = trpc.useUtils();
  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [isArchivingAll, setIsArchivingAll] = useState(false);

  const { data: emails = [], isLoading, error: inboxError, refetch } = trpc.emailInbox.getPending.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
  });

  const updateStatus = trpc.emailInbox.updateStatus.useMutation({
    onSuccess: () => utils.emailInbox.getPending.invalidate(),
  });

  const archiveAll = trpc.emailInbox.archiveAll.useMutation({
    onSuccess: (data) => {
      utils.emailInbox.getPending.invalidate();
      toast.success(`Inbox zero! Archived ${data.archived} email${data.archived !== 1 ? "s" : ""}.`);
      setIsArchivingAll(false);
    },
    onError: () => {
      toast.error("Failed to archive emails");
      setIsArchivingAll(false);
    },
  });

  const handleArchive = (id: number) => {
    setArchivingId(id);
    updateStatus.mutate(
      { id, status: "archived" },
      {
        onSettled: () => setArchivingId(null),
        onError: () => toast.error("Failed to archive email"),
      }
    );
  };

  const handleProcess = (id: number) => {
    updateStatus.mutate(
      { id, status: "processed" },
      { onError: () => toast.error("Failed to update email") }
    );
  };

  const handleArchiveAll = () => {
    setIsArchivingAll(true);
    archiveAll.mutate();
  };

  // Split into financial and non-financial
  const { financial, nonFinancial, total, pending } = useMemo(() => {
    const financial = emails.filter(e => e.category === "financial");
    const nonFinancial = emails.filter(e => e.category === "non_financial");
    const total = emails.length;
    const pending = emails.filter(e => e.status === "pending").length;
    return { financial, nonFinancial, total, pending };
  }, [emails]);

  // Inbox-zero progress
  const progressPct = total === 0 ? 0 : Math.round(((total - pending) / total) * 100);
  const isInboxZero = total > 0 && pending === 0;

  // Financial urgency sort: overdue first, then by deadline
  const sortedFinancial = useMemo(() => {
    return [...financial].sort((a, b) => {
      const aDeadline = a.deadlineAt
        ? new Date(a.deadlineAt).getTime()
        : new Date(a.receivedAt).getTime() + 48 * 3600 * 1000;
      const bDeadline = b.deadlineAt
        ? new Date(b.deadlineAt).getTime()
        : new Date(b.receivedAt).getTime() + 48 * 3600 * 1000;
      return aDeadline - bDeadline;
    });
  }, [financial]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Inbox className="w-5 h-5 text-blue-500" />
            Email Inbox
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Goal: inbox zero every day — process every email, archive when done
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="h-8 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {!isInboxZero && (
            <Button
              variant="default"
              size="sm"
              onClick={handleArchiveAll}
              disabled={isArchivingAll || pending === 0}
              className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Archive className="w-3.5 h-3.5" />
              Archive All ({pending})
            </Button>
          )}
        </div>
      </div>

      {/* Import coverage and inbox progress */}
      {inboxError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div><p className="text-sm font-semibold text-foreground">Email data unavailable</p><p className="mt-1 text-xs text-muted-foreground">The inbox cannot be verified right now. Refresh after the scanner or database connection is restored.</p></div>
          </CardContent>
        </Card>
      ) : <Card className={`border ${isInboxZero ? "border-emerald-500/30 bg-emerald-500/5" : "border-border"}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {isInboxZero ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <Clock className="w-4 h-4 text-amber-500" />
              )}
              <span className="text-sm font-medium text-foreground">
                {total === 0 ? "No imported email records" : isInboxZero ? "Imported inbox is clear" : `${pending} email${pending !== 1 ? "s" : ""} remaining`}
              </span>
            </div>
            <span className="text-sm font-bold text-foreground">{progressPct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isInboxZero ? "bg-emerald-500" : progressPct >= 75 ? "bg-amber-500" : "bg-blue-500"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {total > 0 && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {total - pending} of {total} emails processed or archived
            </p>
          )}
        </CardContent>
      </Card>}

      {/* Empty state */}
      {!isLoading && !inboxError && total === 0 && (
        <Card className="border-dashed border-2 border-border/40">
          <CardContent className="p-8 text-center">
            <Inbox className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nothing has been imported</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              This is not confirmation that Gmail is empty. Records appear here only after a successful scanner run.
            </p>
            <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg text-left max-w-sm mx-auto">
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Gmail scanning is handled by the Manus AGENT cron. Once the site is deployed and the cron is set up, emails will appear here automatically.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Email tabs */}
      {!isLoading && total > 0 && (
        <Tabs defaultValue="financial" className="space-y-3">
          <TabsList className="h-9">
            <TabsTrigger value="financial" className="text-sm gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              Financial
              {sortedFinancial.filter(e => e.status !== "archived").length > 0 && (
                <span className="ml-1 bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {sortedFinancial.filter(e => e.status !== "archived").length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="non_financial" className="text-sm gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              Non-Financial
              {nonFinancial.filter(e => e.status !== "archived").length > 0 && (
                <span className="ml-1 bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {nonFinancial.filter(e => e.status !== "archived").length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="all" className="text-sm">
              All ({total})
            </TabsTrigger>
          </TabsList>

          {/* Financial tab */}
          <TabsContent value="financial" className="space-y-2">
            {sortedFinancial.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No financial emails
              </div>
            ) : (
              <>
                {/* Urgent banner */}
                {sortedFinancial.some(e => e.status !== "archived" && getFinancialDeadlineInfo(e).urgent) && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                      {sortedFinancial.filter(e => e.status !== "archived" && getFinancialDeadlineInfo(e).urgent).length} financial email(s) need urgent attention — deadline approaching!
                    </p>
                  </div>
                )}
                {sortedFinancial.map(email => (
                  <EmailRow
                    key={email.id}
                    email={email}
                    onArchive={handleArchive}
                    onProcess={handleProcess}
                    isArchiving={archivingId === email.id}
                  />
                ))}
              </>
            )}
          </TabsContent>

          {/* Non-financial tab */}
          <TabsContent value="non_financial" className="space-y-2">
            {nonFinancial.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No non-financial emails
              </div>
            ) : (
              nonFinancial.map(email => (
                <EmailRow
                  key={email.id}
                  email={email}
                  onArchive={handleArchive}
                  onProcess={handleProcess}
                  isArchiving={archivingId === email.id}
                />
              ))
            )}
          </TabsContent>

          {/* All tab */}
          <TabsContent value="all" className="space-y-2">
            {[...sortedFinancial, ...nonFinancial].map(email => (
              <EmailRow
                key={email.id}
                email={email}
                onArchive={handleArchive}
                onProcess={handleProcess}
                isArchiving={archivingId === email.id}
              />
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
