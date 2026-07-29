/**
 * RobertDashboard — Minimum-oversight view for Robert.
 *
 * Shows only what requires Robert's attention:
 *   1. Pending decisions (steps flagged requiresRobert)
 *   2. Escalations (cards with escalationCategory set in their APTLSS plan)
 *   3. Stalled cards (no progress for 5+ days)
 *   4. Blocked cards (blocked by another card)
 *   5. Cards waiting for Joyce (unanswered question)
 *   6. Cards needing repair (vague / no checklist)
 *
 * Robert does NOT need to see the daily routine, compliance, or schedule tabs.
 * This page is intentionally minimal and action-oriented.
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  ShieldAlert,
  Wrench,
  ZapOff,
  HelpCircle,
  ArrowLeft,
  RefreshCw,
  Mail,
  BarChart2,
  Copy,
  CheckCheck,
  Flame,
  ThumbsUp,
  Zap,
  Shield,
  ChevronDown,
} from "lucide-react";
import { Children, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

// ── Escalation category labels ────────────────────────────────────────────────
const ESCALATION_LABELS: Record<string, string> = {
  money_decision: "💰 Money Decision",
  legal_approval: "⚖️ Legal Approval",
  scope_change: "🔄 Scope Change",
  worker_performance: "👤 Worker Performance",
  deadline_risk: "⏰ Deadline Risk",
  contradiction: "⚡ Contradiction",
  low_confidence: "❓ Low Confidence",
};

// ── Urgency tier styles ───────────────────────────────────────────────────────
const TIER_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  CRITICAL: { bg: "bg-red-500/10",    text: "text-red-600 dark:text-red-400",       border: "border-red-500/30",    label: "CRITICAL" },
  HIGH:     { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30", label: "HIGH" },
  MEDIUM:   { bg: "bg-amber-500/10",  text: "text-amber-600 dark:text-amber-400",   border: "border-amber-500/30",  label: "MED" },
  LOW:      { bg: "bg-slate-500/10",  text: "text-slate-500 dark:text-slate-400",   border: "border-slate-500/30",  label: "LOW" },
  BLOCKED:  { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/30", label: "BLK" },
};

function TierChip({ tier }: { tier: string }) {
  const s = TIER_STYLES[tier] ?? TIER_STYLES.MEDIUM;
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${s.bg} ${s.border} ${s.text}`}>
      {s.label}
    </span>
  );
}

function SectionHeader({ icon, title, count, color }: { icon: React.ReactNode; title: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <h2 className="text-sm font-semibold text-foreground flex-1">{title}</h2>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color} border`}>
        {count}
      </span>
    </div>
  );
}

function CardLink({ url, name, boardName }: { url: string; name: string; boardName?: string | null }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 text-xs font-medium text-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors group"
    >
      <span className="truncate">{name}</span>
      {boardName && <span className="max-w-[40%] flex-shrink truncate text-[10px] text-muted-foreground">· {boardName}</span>}
      <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}

function AllClear({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-2 text-emerald-600 dark:text-emerald-400 text-xs">
      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
      <span className="font-medium">{label}</span>
    </div>
  );
}

function ProgressiveList({ children, initialCount = 5 }: { children: React.ReactNode; initialCount?: number }) {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const items = Children.toArray(children);
  const hiddenCount = Math.max(0, items.length - visibleCount);

  return (
    <div className="space-y-2">
      {items.slice(0, visibleCount)}
      {hiddenCount > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setVisibleCount(count => count + initialCount)}
        >
          <ChevronDown className="h-3.5 w-3.5" />
          Show {Math.min(initialCount, hiddenCount)} more
        </Button>
      )}
    </div>
  );
}

export default function RobertDashboard() {
  const { data, isLoading, refetch, isFetching } = trpc.aptlss.getRisksAndExceptions.useQuery(undefined, {
    staleTime: 3 * 60_000,
  });
  const { data: followUps } = trpc.aptlss.getPendingFollowUps.useQuery(undefined, { staleTime: 3 * 60_000 });
  const { data: readyForDoneCards } = trpc.aptlss.getReadyForDone.useQuery(undefined, { staleTime: 3 * 60_000 });
  const { data: weeklyAnalysis } = trpc.aptlss.getLatestWeeklyAnalysis.useQuery(undefined, { staleTime: 10 * 60_000 });
  const markSent = trpc.aptlss.markFollowUpSent.useMutation({ onSuccess: () => {} });
  const dismiss = trpc.aptlss.dismissFollowUp.useMutation({ onSuccess: () => {} });
  const utils = trpc.useUtils();
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const decisionCardIds = new Set((data?.pendingDecisions ?? []).map(item => item.cardId));
  const deadlineRisks = (data?.deadlineRisks ?? []).filter(card => !decisionCardIds.has(card.cardId));
  const deadlineRiskIds = new Set(deadlineRisks.map(card => card.cardId));
  const escalations = (data?.escalations ?? []).filter(item => !decisionCardIds.has(item.cardId) && !deadlineRiskIds.has(item.cardId));
  const representedCardIds = new Set([
    ...(data?.pendingDecisions ?? []).map(item => item.cardId),
    ...deadlineRisks.map(card => card.cardId),
    ...escalations.map(item => item.cardId),
  ]);
  const stalledCards = (data?.stalledCards ?? []).filter(card => !representedCardIds.has(card.cardId));
  stalledCards.forEach(card => representedCardIds.add(card.cardId));
  const blockedCards = (data?.blockedCards ?? []).filter(card => !representedCardIds.has(card.cardId));
  blockedCards.forEach(card => representedCardIds.add(card.cardId));
  const waitingCards = (data?.waitingCards ?? []).filter(card => !representedCardIds.has(card.cardId));
  waitingCards.forEach(card => representedCardIds.add(card.cardId));
  const repairCards = (data?.repairCards ?? []).filter(card => !representedCardIds.has(card.cardId));

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleMarkSent = (id: number) => {
    markSent.mutate({ id }, { onSuccess: () => utils.aptlss.getPendingFollowUps.invalidate() });
  };

  const handleDismiss = (id: number) => {
    dismiss.mutate({ id }, { onSuccess: () => utils.aptlss.getPendingFollowUps.invalidate() });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2">
              <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <Link href="/" aria-label="Back to Joyce's Dashboard" title="Back to Joyce's Dashboard">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div className="min-w-0">
              <h1 className="text-base font-bold text-foreground sm:text-lg">Robert's Oversight Dashboard</h1>
              <p className="text-[11px] text-muted-foreground">Decisions, risks, and exceptions requiring your attention</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Button asChild variant="outline" size="sm" className="flex items-center gap-1.5 text-xs">
                <Link href="/">
                  <Zap className="w-3.5 h-3.5" />
                  Joyce Work Queue
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="flex items-center gap-1.5 text-xs">
                <Link href="/command-center">
                  <BarChart2 className="w-3.5 h-3.5" />
                  Operations
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="flex items-center gap-1.5 text-xs">
                <Link href="/admin">
                  <Shield className="w-3.5 h-3.5" />
                  Admin
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-1.5 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-5 max-w-3xl">
        {isLoading && (
          <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading risks and exceptions…
          </div>
        )}

        {!isLoading && data && (
          <>
            {/* Summary banner — spec Item 16 */}
            <div className={`rounded-xl border p-4 ${
              data.totalIssues === 0
                ? "bg-emerald-500/8 border-emerald-500/30"
                : "bg-amber-500/8 border-amber-500/30"
            }`}>
              {data.totalIssues === 0 ? (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">All clear — no issues require your attention</p>
                    <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Joyce is working autonomously. No decisions, escalations, or blockers.</p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Robert Attention Required</p>
                      <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">Review each section below and take action where needed.</p>
                    </div>
                  </div>
                  {/* Attention-needed counts */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                    {[
                      { label: "Decisions needed", count: data.pendingDecisions.length, color: "text-orange-600 dark:text-orange-400" },
                      { label: "Deadline risks", count: (data.deadlineRisks ?? []).length, color: "text-red-600 dark:text-red-400" },
                      { label: "Payment/scope issues", count: data.escalations.filter(e => e.escalationCategory === 'money_decision' || e.escalationCategory === 'scope_change').length, color: "text-rose-600 dark:text-rose-400" },
                      { label: "Cards blocked 3+ days", count: data.blockedCards.length + data.stalledCards.length, color: "text-purple-600 dark:text-purple-400" },
                      { label: "Ready for final approval", count: (data.readyForApproval ?? []).length, color: "text-emerald-600 dark:text-emerald-400" },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-2 bg-background/60 rounded-lg px-2.5 py-1.5 border border-border/40">
                        <span className={`text-base font-bold ${item.color}`}>{item.count}</span>
                        <span className="text-[10px] text-muted-foreground leading-tight">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* No-attention-needed section — always shown */}
              <div className={`mt-2 pt-2 border-t ${data.totalIssues === 0 ? "border-emerald-500/20" : "border-amber-500/20"}`}>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">No attention needed:</p>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    <span>{data.normalCount ?? 0} card{(data.normalCount ?? 0) !== 1 ? "s are" : " is"} progressing normally.</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock className="w-3 h-3 text-blue-500 flex-shrink-0" />
                    <span>{data.externalCount ?? 0} external follow-up{(data.externalCount ?? 0) !== 1 ? "s are" : " is"} scheduled and not yet overdue.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 1. Pending Decisions ── */}
            <Card className="border-border/60">
              <CardContent className="p-4">
                <SectionHeader
                  icon={<AlertCircle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />}
                  title="Pending Decisions"
                  count={data.pendingDecisions.length}
                  color="bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30"
                />
                {data.pendingDecisions.length === 0 ? (
                  <AllClear label="No pending decisions — Joyce can proceed autonomously." />
                ) : (
                  <ProgressiveList>
                    {data.pendingDecisions.map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg border bg-orange-500/5 border-orange-500/20">
                        <TierChip tier={item.tier} />
                        <div className="flex-1 min-w-0">
                          <CardLink url={item.cardUrl} name={item.cardName} boardName={item.boardName} />
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{item.stepTitle}</p>
                          {item.recommendedDecision && (
                            <p className="text-[11px] text-orange-700 dark:text-orange-300 mt-1 font-medium">
                              💡 Suggested: {item.recommendedDecision}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </ProgressiveList>
                )}
              </CardContent>
            </Card>

            {/* ── 2. Deadline Risks ── */}
            {deadlineRisks.length > 0 && (
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <SectionHeader
                    icon={<Flame className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />}
                    title="Deadline Risks"
                    count={deadlineRisks.length}
                    color="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30"
                  />
                  <p className="text-[10px] text-muted-foreground mb-3">
                    These cards are overdue or are HIGH/CRITICAL priority cards that are stalled or blocked.
                  </p>
                  <ProgressiveList>
                    {deadlineRisks.map((card, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg border bg-red-500/5 border-red-500/20">
                        <TierChip tier={card.tier} />
                        <div className="flex-1 min-w-0">
                          <CardLink url={card.cardUrl} name={card.cardName} boardName={card.boardName} />
                          <div className="flex items-center gap-2 mt-0.5">
                            {card.isOverdue && (
                              <span className="text-[10px] font-bold text-red-600 dark:text-red-400">OVERDUE</span>
                            )}
                            {card.stateReason && (
                              <p className="text-[11px] text-muted-foreground">{card.stateReason}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </ProgressiveList>
                </CardContent>
              </Card>
            )}

            {/* ── 3. Other Escalations ── */}
            <Card className="border-border/60">
              <CardContent className="p-4">
                <SectionHeader
                  icon={<ShieldAlert className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />}
                  title="Other Escalations"
                  count={escalations.length}
                  color="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30"
                />
                {escalations.length === 0 ? (
                  <AllClear label="No additional escalations outside the decision and deadline queues." />
                ) : (
                  <ProgressiveList>
                    {escalations.map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg border bg-red-500/5 border-red-500/20">
                        <TierChip tier={item.tier} />
                        <div className="flex-1 min-w-0">
                          <CardLink url={item.cardUrl} name={item.cardName} boardName={item.boardName} />
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {item.escalationCategory && (
                              <span className="text-[10px] font-semibold text-red-700 dark:text-red-300 bg-red-500/10 border border-red-500/20 rounded px-1.5 py-0.5">
                                {ESCALATION_LABELS[item.escalationCategory] ?? item.escalationCategory}
                              </span>
                            )}
                            {item.confidenceScore !== null && (
                              <span className="text-[10px] text-muted-foreground">
                                Confidence: {item.confidenceScore}/100
                              </span>
                            )}
                          </div>
                          {item.robertDecision && (
                            <p className="text-[11px] text-red-700 dark:text-red-300 mt-1 font-medium">
                              ❓ {item.robertDecision}
                            </p>
                          )}
                          {item.confidenceReason && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{item.confidenceReason}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </ProgressiveList>
                )}
              </CardContent>
            </Card>

            {/* ── 4. Ready for Final Approval ── */}
            {(data.readyForApproval ?? []).length > 0 && (
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <SectionHeader
                    icon={<ThumbsUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                    title="Cards Ready for Final Approval"
                    count={(data.readyForApproval ?? []).length}
                    color="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  />
                  <p className="text-[10px] text-muted-foreground mb-3">
                    These cards have passed the Done quality gate and are waiting for your final approval before being moved to Done.
                  </p>
                  <ProgressiveList>
                    {(data.readyForApproval ?? []).map((card, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
                        <TierChip tier={card.tier} />
                        <div className="flex-1 min-w-0">
                          <CardLink url={card.cardUrl} name={card.cardName} boardName={card.boardName} />
                          {card.stateReason && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{card.stateReason}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </ProgressiveList>
                </CardContent>
              </Card>
            )}
            {/* ── 2b. Ready for Done (needs Robert to move to Done list) ── */}
            {(readyForDoneCards ?? []).length > 0 && (
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <SectionHeader
                    icon={<CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />}
                    title="Cards Ready to Move to Done"
                    count={(readyForDoneCards ?? []).length}
                    color="bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30"
                  />
                  <p className="text-[10px] text-muted-foreground mb-3">
                    These cards have completed all checklist items and passed the Done quality gate. Move them to the Done list in Trello.
                  </p>
                  <ProgressiveList>
                    {(readyForDoneCards ?? []).map((card) => (
                      <div key={card.cardId} className="flex items-start gap-2.5 p-2.5 rounded-lg border bg-teal-500/5 border-teal-500/20">
                        <div className="flex-1 min-w-0">
                          <a
                            href={`https://trello.com/c/${card.cardId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-medium text-foreground hover:text-teal-600 dark:hover:text-teal-400 transition-colors group"
                          >
                            <span className="truncate">{card.cardName}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                          {card.stateReason && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{card.stateReason}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </ProgressiveList>
                </CardContent>
              </Card>
            )}
            {/* ── 3. Stalled Cards ── */}
            <Card className="border-border/60">
              <CardContent className="p-4">
                <SectionHeader
                  icon={<ZapOff className="w-3.5 h-3.5 text-slate-500" />}
                  title="Stalled Cards"
                  count={stalledCards.length}
                  color="bg-slate-500/15 text-slate-500 border-slate-500/30"
                />
                {stalledCards.length === 0 ? (
                  <AllClear label={data.stalledCards.length ? "All stalled cards are already represented in higher-priority queues." : "No stalled cards — all active work is progressing."} />
                ) : (
                  <ProgressiveList>
                    {stalledCards.map((card, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg border bg-slate-500/5 border-slate-500/20">
                        <TierChip tier={card.tier} />
                        <div className="flex-1 min-w-0">
                          <CardLink url={card.cardUrl} name={card.cardName} boardName={card.boardName} />
                          {card.stateReason && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{card.stateReason}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </ProgressiveList>
                )}
              </CardContent>
            </Card>

            {/* ── 4. Blocked Cards ── */}
            <Card className="border-border/60">
              <CardContent className="p-4">
                <SectionHeader
                  icon={<AlertTriangle className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />}
                  title="Blocked Cards"
                  count={blockedCards.length}
                  color="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30"
                />
                {blockedCards.length === 0 ? (
                  <AllClear label={data.blockedCards.length ? "All blocked cards are already represented in higher-priority queues." : "No blocked cards — all work can proceed."} />
                ) : (
                  <ProgressiveList>
                    {blockedCards.map((card, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg border bg-purple-500/5 border-purple-500/20">
                        <TierChip tier={card.tier} />
                        <div className="flex-1 min-w-0">
                          <CardLink url={card.cardUrl} name={card.cardName} boardName={card.boardName} />
                          {card.stateReason && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{card.stateReason}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </ProgressiveList>
                )}
              </CardContent>
            </Card>

            {/* ── 5. Waiting for Joyce ── */}
            <Card className="border-border/60">
              <CardContent className="p-4">
                <SectionHeader
                  icon={<HelpCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                  title="Waiting for Joyce (Unanswered Questions)"
                  count={waitingCards.length}
                  color="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"
                />
                {waitingCards.length === 0 ? (
                  <AllClear label={data.waitingCards.length ? "All waiting cards are already represented in higher-priority queues." : "No cards waiting — Joyce has answered all questions."} />
                ) : (
                  <ProgressiveList>
                    {waitingCards.map((card, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg border bg-blue-500/5 border-blue-500/20">
                        <TierChip tier={card.tier} />
                        <div className="flex-1 min-w-0">
                          <CardLink url={card.cardUrl} name={card.cardName} boardName={card.boardName} />
                          {card.stateReason && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{card.stateReason}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </ProgressiveList>
                )}
              </CardContent>
            </Card>

            {/* ── 6. Cards Needing Repair ── */}
            <Card className="border-border/60">
              <CardContent className="p-4">
                <SectionHeader
                  icon={<Wrench className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                  title="Cards Needing Repair"
                  count={repairCards.length}
                  color="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                />
                <p className="text-[10px] text-muted-foreground mb-3">
                  These cards are too vague, missing a description, or have no checklist. Joyce needs to re-generate their APTLSS plan, or you need to add more detail to the Trello card.
                </p>
                {repairCards.length === 0 ? (
                  <AllClear label={data.repairCards.length ? "All repair cards are already represented in higher-priority queues." : "No cards need repair — all cards are well-structured."} />
                ) : (
                  <ProgressiveList>
                    {repairCards.map((card, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg border bg-amber-500/5 border-amber-500/20">
                        <TierChip tier={card.tier} />
                        <div className="flex-1 min-w-0">
                          <CardLink url={card.cardUrl} name={card.cardName} boardName={card.boardName} />
                          {card.stateReason && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{card.stateReason}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </ProgressiveList>
                )}
              </CardContent>
            </Card>

            {/* ── 7. Auto Follow-Up Drafts ── */}
            {followUps && followUps.length > 0 && (
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <SectionHeader
                    icon={<Mail className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
                    title="Auto-Generated Follow-Up Drafts"
                    count={followUps.length}
                    color="bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30"
                  />
                  <p className="text-[10px] text-muted-foreground mb-3">
                    These follow-up messages were auto-drafted by the APTLSS engine for cards waiting on external parties. Review, copy, and send — or dismiss if no longer needed.
                  </p>
                  <ProgressiveList>
                    {followUps.map((draft) => (
                      <div key={draft.id} className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="text-xs font-semibold text-foreground">{draft.cardName}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{draft.reason}</p>
                          </div>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400 flex-shrink-0">
                            {draft.urgencyType}
                          </span>
                        </div>
                        <pre className="text-[11px] text-foreground whitespace-pre-wrap font-sans bg-background/60 rounded p-2 border border-border/40 mb-2">{draft.draftMessage}</pre>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(draft.id, draft.draftMessage)}
                            className="flex items-center gap-1 text-[10px] text-sky-600 dark:text-sky-400 hover:underline"
                          >
                            {copiedId === draft.id ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copiedId === draft.id ? "Copied!" : "Copy"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkSent(draft.id)}
                            className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Mark Sent
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDismiss(draft.id)}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:underline ml-auto"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                  </ProgressiveList>
                </CardContent>
              </Card>
            )}

            {/* ── 8. Weekly Analysis Snapshot ── */}
            {weeklyAnalysis && (() => {
              let noProgressCards: { cardId: string; cardName: string; state: string }[] = [];
              let recurringBlockers: { reason: string; count: number; cards: string[] }[] = [];
              let processImprovements: string[] = [];
              try { noProgressCards = JSON.parse(weeklyAnalysis.noProgressCards ?? "[]"); } catch { /* ignore */ }
              try { recurringBlockers = JSON.parse(weeklyAnalysis.recurringBlockers ?? "[]"); } catch { /* ignore */ }
              try { processImprovements = JSON.parse(weeklyAnalysis.processImprovements ?? "[]"); } catch { /* ignore */ }
              const hasIssues = noProgressCards.length > 0 || recurringBlockers.length > 0;
              if (!hasIssues) return null;
              return (
                <Card className="border-border/60">
                  <CardContent className="p-4">
                    <SectionHeader
                      icon={<BarChart2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                      title={`Weekly Analysis — Week ${weeklyAnalysis.weekKey}`}
                      count={noProgressCards.length + recurringBlockers.length}
                      color="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
                    />
                    <p className="text-[11px] text-muted-foreground mb-3">{weeklyAnalysis.summary}</p>
                    {noProgressCards.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mb-1">No-Progress Cards ({noProgressCards.length})</p>
                        <div className="space-y-1">
                          {noProgressCards.map(c => (
                            <div key={c.cardId} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                              {c.cardName} <span className="text-amber-500">({c.state})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {recurringBlockers.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 mb-1">Recurring Blockers ({recurringBlockers.length})</p>
                        <div className="space-y-1">
                          {recurringBlockers.map((b, i) => (
                            <div key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1" />
                              {b.reason} <span className="text-red-500">({b.count} cards)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {processImprovements.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Process Improvements Suggested</p>
                        <div className="space-y-1">
                          {processImprovements.map((imp, i) => (
                            <div key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1" />
                              {imp}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Footer timestamp */}
            <p className="text-center text-[10px] text-muted-foreground pb-4">
              Data sourced from APTLSS AI engine · Refresh to get latest state
            </p>
          </>
        )}
      </main>
    </div>
  );
}
