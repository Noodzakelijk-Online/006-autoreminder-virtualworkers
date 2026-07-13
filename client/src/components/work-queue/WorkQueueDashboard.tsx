import React, { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, CalendarDays, CheckCircle, ChevronDown, ChevronUp, Clock, ExternalLink, GitBranch, MessageSquare, Settings2, ShieldCheck, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TRIAGE_TAB_KEY, type AppSection } from "@/lib/navigationState";
import { trpc } from "@/lib/trpc";
import { useEatClock } from "@/hooks/useEatClock";
import { dateKeyInEat } from "@shared/eatTime";
import {
  normalizeWorkQueue,
  type WorkQueueCard,
  type WorkQueueLane,
  type WorkQueueLaneId,
  type WorkQueueSourceData,
  type WorkQueueWaitingReason,
} from "@/lib/workQueue";

type WorkQueuePlanSummary = {
  planHealth?: { focusMinutes?: number; confidence?: number };
  totalScheduledMinutes?: number;
};

function getDueLabel(due?: string | null) {
  if (!due) return "No due date";
  const dueDate = new Date(due);
  if (Number.isNaN(dueDate.getTime())) return "Due date set";
  const today = new Date();
  const todayKey = dateKeyInEat(today);
  const dueKey = dateKeyInEat(dueDate);
  if (dueKey === todayKey) return "Due today";
  if (dueDate.getTime() < today.getTime()) return "Overdue";
  return dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getActivityLabel(value?: string | null) {
  if (!value) return "No recent activity";
  const diffMs = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diffMs)) return "Activity unknown";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

function formatWaitingDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unavailable";
  return parsed.toLocaleString("en-GB", {
    timeZone: "Africa/Nairobi",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }) + " EAT";
}

export function WorkQueueDashboard({
  trelloDisabledReason,
  actionData,
  actionsLoading,
  actionsError,
  dataNotice,
  dayPlan,
  dayPlanLoading = false,
  activeTimerCardId,
  activeTimerCardName,
  activeTimerStartedAt,
  activeTimerLoading = false,
  timerBusy,
  preferredCardId,
  readiness,
  waitingReasons = [],
  protectedDay = false,
  onNavigate,
  onOpenPlan,
  onStartTimer,
}: {
  trelloDisabledReason?: string;
  actionData?: WorkQueueSourceData;
  actionsLoading: boolean;
  actionsError?: { message: string } | null;
  dataNotice?: string;
  dayPlan?: WorkQueuePlanSummary | null;
  dayPlanLoading?: boolean;
  activeTimerCardId?: string | null;
  activeTimerCardName?: string | null;
  activeTimerStartedAt?: Date | string | null;
  activeTimerLoading?: boolean;
  timerBusy: boolean;
  preferredCardId?: string | null;
  readiness?: { status: string; counts: { warning: number } };
  waitingReasons?: WorkQueueWaitingReason[];
  protectedDay?: boolean;
  onNavigate: (section: AppSection) => void;
  onOpenPlan: () => void;
  onStartTimer: (card: WorkQueueCard) => void;
}) {
  const { nowMs } = useEatClock();
  const { data: intelligence, isLoading: intelligenceLoading } = trpc.aptlss.getWorkQueueContext.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });
  const queue = useMemo(
    () => normalizeWorkQueue(actionData, preferredCardId, waitingReasons, nowMs, intelligence),
    [actionData, preferredCardId, waitingReasons, nowMs, intelligence],
  );
  const decisionCount = useMemo(() => intelligence?.cards.reduce(
    (count, card) => count + card.steps.filter((step) => step.requiresRobert && step.status !== "complete").length,
    0,
  ) ?? 0, [intelligence]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingTimerCard, setPendingTimerCard] = useState<WorkQueueCard | null>(null);
  const selectedCard = selectedId ? queue.cards.find((card) => card.id === selectedId) ?? null : null;
  const { data: selectedAudit = [] } = trpc.aptlss.getCardAuditLog.useQuery(
    { cardId: selectedId ?? "", limit: 20 },
    { enabled: Boolean(selectedId), retry: false, staleTime: 30_000 },
  );
  const itemsByLane = useMemo(() => ({
    overdue: queue.cards.filter((card) => card.lane === "overdue"),
    doing: queue.cards.filter((card) => card.lane === "doing"),
    onhold: queue.cards.filter((card) => card.lane === "onhold"),
  }), [queue.cards]);
  const openTriageQueue = () => {
    localStorage.setItem(TRIAGE_TAB_KEY, "work-intake");
    onNavigate("triage");
  };
  const requestStartTimer = (card: WorkQueueCard) => {
    if (protectedDay || (activeTimerCardId && activeTimerCardId !== card.id)) {
      setPendingTimerCard(card);
      return;
    }
    onStartTimer(card);
  };
  return (
    <>
      <div className="mx-auto grid min-h-[calc(100vh-12rem)] w-full max-w-7xl gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-4">
          {dataNotice && <Alert><AlertDescription>{dataNotice}</AlertDescription></Alert>}
          {protectedDay && (
            <Alert className="border-emerald-500/30 bg-emerald-500/5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <AlertDescription>
                Sunday is Joyce&apos;s protected day off. The queue remains visible for awareness; starting work requires an explicit emergency confirmation.
              </AlertDescription>
            </Alert>
          )}
          <NowPanel
            card={queue.nowItem}
            loading={actionsLoading}
            disabledReason={trelloDisabledReason}
            errorMessage={actionsError?.message}
            activeTimerCardId={activeTimerCardId}
            timerBusy={timerBusy}
            anotherTimerRunning={Boolean(activeTimerCardId && activeTimerCardId !== queue.nowItem?.id)}
            onSelect={(card) => setSelectedId(card.id)}
            onStartTimer={requestStartTimer}
            protectedDay={protectedDay}
            onOpenTriage={openTriageQueue}
            onOpenSettings={() => onNavigate("settings")}
          />
          <NextUpTable
            items={queue.nextItems}
            loading={actionsLoading}
            selectedId={selectedCard?.id}
            onSelect={(card) => setSelectedId(card.id)}
            onOpenQueue={openTriageQueue}
          />
          <TriageLaneSummary
            lanes={queue.lanes}
            loading={actionsLoading}
            itemsByLane={itemsByLane}
            selectedId={selectedCard?.id}
            onSelectCard={(card) => setSelectedId(card.id)}
            onOpenQueue={openTriageQueue}
          />
        </div>
        <WorkQueueContextRail
          readiness={readiness}
          dayPlan={dayPlan}
          dayPlanLoading={dayPlanLoading}
          activeTimerCardId={activeTimerCardId}
          activeTimerCardName={activeTimerCardName}
          activeTimerStartedAt={activeTimerStartedAt}
          activeTimerLoading={activeTimerLoading}
          decisionCount={decisionCount}
          decisionCountLoading={intelligenceLoading}
          onNavigate={onNavigate}
          onOpenPlan={onOpenPlan}
        />
      </div>

      <Sheet open={Boolean(selectedCard)} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <SheetContent side="right" className="w-[min(440px,calc(100vw-1rem))] gap-0 overflow-y-auto p-0 sm:max-w-[440px] [&>button.absolute]:top-5">
          <SheetTitle className="sr-only">Card details</SheetTitle>
          <SheetDescription className="sr-only">
            Inspect the selected Work Queue card, workflow steps, activity, and explicit actions.
          </SheetDescription>
          <CardInspector
            card={selectedCard}
            audit={selectedAudit}
            onOpenTriage={openTriageQueue}
          />
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(pendingTimerCard)} onOpenChange={(open) => { if (!open) setPendingTimerCard(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {protectedDay
                ? activeTimerCardId && activeTimerCardId !== pendingTimerCard?.id ? "Switch timer on the protected day?" : "Start work on the protected day?"
                : "Switch the active timer?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {activeTimerCardId && activeTimerCardId !== pendingTimerCard?.id
                ? `The running timer${activeTimerCardName ? ` for ${activeTimerCardName}` : ""} will be stopped and saved before this timer starts. ${protectedDay ? "Sunday has no normal work target; continue only for a genuine emergency." : ""}`
                : "Sunday has no normal work target. Continue only for a genuine emergency; the timer and card assessment will still be recorded normally."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Sunday protected</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const card = pendingTimerCard;
              setPendingTimerCard(null);
              if (card) onStartTimer(card);
            }}>{protectedDay ? "Start emergency timer" : "Switch timer"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function WorkQueueContextRail({
  readiness,
  dayPlan,
  dayPlanLoading,
  activeTimerCardId,
  activeTimerCardName,
  activeTimerStartedAt,
  activeTimerLoading,
  decisionCount,
  decisionCountLoading,
  onNavigate,
  onOpenPlan,
}: {
  readiness?: { status: string; counts: { warning: number } };
  dayPlan?: WorkQueuePlanSummary | null;
  dayPlanLoading: boolean;
  activeTimerCardId?: string | null;
  activeTimerCardName?: string | null;
  activeTimerStartedAt?: Date | string | null;
  activeTimerLoading: boolean;
  decisionCount: number;
  decisionCountLoading: boolean;
  onNavigate: (section: AppSection) => void;
  onOpenPlan: () => void;
}) {
  const { dateKey, nowMs } = useEatClock();
  const { data: timeSummary = [], isLoading: timeSummaryLoading } = trpc.timer.getDailySummary.useQuery({ date: dateKey }, { retry: false, staleTime: 60_000 });
  const activeTimerIsToday = Boolean(activeTimerCardId && activeTimerStartedAt && dateKeyInEat(new Date(activeTimerStartedAt)) === dateKey);
  const activeSeconds = activeTimerIsToday
    ? Math.max(0, Math.floor((nowMs - new Date(activeTimerStartedAt!).getTime()) / 1_000))
    : 0;
  const totalSeconds = timeSummary.reduce((sum, entry) => sum + entry.totalSeconds, 0) + activeSeconds;
  const warnings = readiness?.counts.warning ?? 0;

  return (
    <aside className="h-fit rounded-lg border border-border bg-card shadow-sm lg:sticky lg:top-4">
      <div className="border-b border-border/60 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Context</p>
      </div>
      <div className="divide-y divide-border/60">
        <ContextRailItem
          icon={<CalendarDays className="h-4 w-4" />}
          label="Day plan"
          value={`${dayPlan?.planHealth?.focusMinutes ?? 0}m focus`}
          detail={dayPlan ? `${dayPlan.planHealth?.confidence ?? 0}% confidence` : "No saved plan"}
          loading={dayPlanLoading}
          onClick={onOpenPlan}
        />
        <ContextRailItem
          icon={<Clock className="h-4 w-4" />}
          label="Time today"
          value={totalSeconds >= 3600 ? `${Math.floor(totalSeconds / 3600)}h ${Math.round(totalSeconds % 3600 / 60)}m` : `${Math.round(totalSeconds / 60)}m`}
          detail={activeTimerCardId ? `Timer running: ${activeTimerCardName ?? "Active card"}` : activeTimerLabel(timeSummary)}
          loading={timeSummaryLoading || activeTimerLoading}
          onClick={() => onNavigate("performance")}
        />
        <ContextRailItem
          icon={<GitBranch className="h-4 w-4" />}
          label="Robert decisions"
          value={`${decisionCount} open`}
          detail={decisionCount ? "Outcome required before closure" : "No decision blockers"}
          loading={decisionCountLoading}
          onClick={() => onNavigate("decisions")}
        />
        <ContextRailItem
          icon={<Settings2 className="h-4 w-4" />}
          label="System readiness"
          value={readiness?.status ?? "checking"}
          detail={!readiness ? "Loading system status" : warnings ? `${warnings} warning${warnings === 1 ? "" : "s"}` : "No setup warnings"}
          onClick={() => onNavigate("settings")}
        />
      </div>
    </aside>
  );
}

function activeTimerLabel(summary: Array<{ cardName: string; totalSeconds: number }>) {
  return summary.length ? `${summary.length} tracked card${summary.length === 1 ? "" : "s"}` : "Nothing tracked yet";
}

function ContextRailItem({ icon, label, value, detail, loading = false, onClick }: { icon: ReactNode; label: string; value: string; detail: string; loading?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-accent/50">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
        {loading ? (
          <span className="mt-2 block space-y-1.5" aria-label={`Loading ${label.toLowerCase()}`}>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-28" />
          </span>
        ) : (
          <>
            <span className="mt-1 block text-sm font-semibold text-foreground">{value}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{detail}</span>
          </>
        )}
      </span>
      <ArrowRight className="mt-1 h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}

function NowPanel({
  card,
  loading,
  disabledReason,
  errorMessage,
  activeTimerCardId,
  timerBusy,
  protectedDay,
  anotherTimerRunning,
  onSelect,
  onStartTimer,
  onOpenTriage,
  onOpenSettings,
}: {
  card?: WorkQueueCard;
  loading: boolean;
  disabledReason?: string;
  errorMessage?: string;
  activeTimerCardId?: string | null;
  timerBusy: boolean;
  protectedDay: boolean;
  anotherTimerRunning: boolean;
  onSelect: (card: WorkQueueCard) => void;
  onStartTimer: (card: WorkQueueCard) => void;
  onOpenTriage: () => void;
  onOpenSettings: () => void;
}) {
  const running = Boolean(card && activeTimerCardId === card.id);
  return (
    <section
      className="rounded-lg border border-border bg-card shadow-sm"
      data-testid="work-queue-now"
      data-state={disabledReason ? "disabled" : loading ? "loading" : errorMessage ? "error" : card ? "ready" : "empty"}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Now</p>
        </div>
      </div>
      <div className="p-5">
        {disabledReason ? (
          <EmptyQueueState title="Trello setup needed" body={disabledReason} actionLabel="Open Settings" onAction={onOpenSettings} />
        ) : loading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : errorMessage ? (
          <EmptyQueueState title="Work queue unavailable" body={errorMessage} actionLabel="Open Triage" onAction={onOpenTriage} />
        ) : card ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
            <button type="button" className="min-w-0 text-left" onClick={() => onSelect(card)}>
              <h2 className="text-xl font-semibold leading-snug tracking-normal text-foreground sm:text-2xl">{card.title}</h2>
              <p className="mt-2 truncate text-sm text-muted-foreground">
                {card.boardName} <span className="mx-2">-</span> {card.listName}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline" className={riskTone(card.risk)}>{card.risk} risk</Badge>
                <Badge variant="outline" className="border-border bg-background text-foreground">{getDueLabel(card.due)}</Badge>
                {card.hasWaitingEvidence && <Badge variant="outline">Waiting on {card.waitingOn}</Badge>}
              </div>
              <div className="mt-5 border-l-2 border-primary pl-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next action</p>
                <p className="mt-1 text-base leading-relaxed text-foreground">{card.nextAction}</p>
              </div>
            </button>
            <div className="flex flex-col justify-end gap-2">
              <Button className="h-10 gap-2 rounded-md" onClick={() => onStartTimer(card)} disabled={timerBusy || running || !card.actionable}>
                <Timer className="h-4 w-4" />
                {running ? "Timer running" : card.actionable ? protectedDay ? "Start emergency timer" : anotherTimerRunning ? "Switch timer" : "Start timer" : "Waiting"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">Open details for context and secondary actions.</p>
            </div>
          </div>
        ) : (
          <EmptyQueueState title="No urgent work queued" body="Trello has no overdue, DOING update, or ON-HOLD review items right now." actionLabel="Open Triage" onAction={onOpenTriage} />
        )}
      </div>
    </section>
  );
}

function NextUpTable({ items, loading, selectedId, onSelect, onOpenQueue }: { items: WorkQueueCard[]; loading: boolean; selectedId?: string; onSelect: (card: WorkQueueCard) => void; onOpenQueue: () => void }) {
  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next up{loading ? "" : ` (${items.length})`}</p>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={onOpenQueue}>View full queue <ArrowRight className="h-3.5 w-3.5" /></Button>
      </div>
      <div className="p-2">
        {loading ? (
          <div className="space-y-2 px-3 py-2" aria-label="Loading next work items">
            {[0, 1, 2].map((item) => <Skeleton key={item} className="h-14 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">No more queued items for this first pass.</div>
        ) : items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            data-testid="next-up-item"
            onClick={() => onSelect(item)}
            className={`grid w-full grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-md px-3 py-3 text-left text-sm transition-colors hover:bg-accent/50 md:grid-cols-[28px_minmax(0,1fr)_auto] ${selectedId === item.id ? "bg-primary/10" : ""}`}
          >
            <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">{index + 1}</span>
            <span className="min-w-0">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium text-foreground">{item.title}</span>
                <Badge variant="outline" className={`shrink-0 ${riskTone(item.risk)}`}>{item.risk}</Badge>
              </span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">{item.nextAction}</span>
              <span className="mt-1 block truncate text-[11px] text-muted-foreground">{item.boardName} / {item.listName} - {getDueLabel(item.due)}</span>
            </span>
            <ArrowRight className="hidden h-4 w-4 self-center text-muted-foreground md:block" />
          </button>
        ))}
      </div>
    </section>
  );
}

function TriageLaneSummary({
  lanes,
  loading,
  itemsByLane,
  selectedId,
  onSelectCard,
  onOpenQueue,
}: {
  lanes: WorkQueueLane[];
  loading: boolean;
  itemsByLane: Record<WorkQueueLaneId, WorkQueueCard[]>;
  selectedId?: string;
  onSelectCard: (card: WorkQueueCard) => void;
  onOpenQueue: () => void;
}) {
  const [expandedLane, setExpandedLane] = useState<WorkQueueLaneId | null>(null);
  const toneClasses = {
    red: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    violet: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  };
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Triage lanes</p>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={onOpenQueue}>Open Triage <ArrowRight className="h-3.5 w-3.5" /></Button>
      </div>
      <div className="space-y-2">
        {loading ? [0, 1, 2].map((item) => <Skeleton key={item} className="h-[58px] w-full" />) : lanes.map((lane) => {
          const expanded = expandedLane === lane.id;
          const laneItems = itemsByLane[lane.id] ?? [];
          return (
            <div key={lane.id} className="overflow-hidden rounded-md border border-border bg-background">
              <button
                type="button"
                onClick={() => setExpandedLane(expanded ? null : lane.id)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-accent"
                aria-expanded={expanded}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-xs font-semibold ${toneClasses[lane.tone]}`}>{lane.count}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{lane.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{lane.summary}</span>
                </span>
                <span className="hidden text-xs text-muted-foreground md:block">{lane.helper}</span>
                {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expanded && (
                <div className="border-t border-border/60 bg-muted/20 p-2">
                  {laneItems.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-muted-foreground">No cards in this lane right now.</p>
                  ) : (
                    <div className="space-y-1">
                      {laneItems.slice(0, 3).map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => onSelectCard(card)}
                          className={`grid w-full grid-cols-[minmax(0,1fr)_72px] gap-3 rounded-md px-2 py-2 text-left text-xs transition-colors hover:bg-background ${selectedId === card.id ? "bg-primary/10" : ""}`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-foreground">{card.title}</span>
                            <span className="mt-0.5 block truncate text-muted-foreground">{card.boardName} / {card.listName}</span>
                          </span>
                          <span className="text-right">
                            <Badge variant="outline" className={riskTone(card.risk)}>{card.risk}</Badge>
                            <span className="mt-1 block truncate text-[11px] text-muted-foreground">{getDueLabel(card.due)}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <Button variant="ghost" size="sm" className="mt-2 h-8 w-full justify-between rounded-md text-xs" onClick={onOpenQueue}>
                    Manage full lane in Triage <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CardInspector({
  card,
  audit,
  onOpenTriage,
}: {
  card: WorkQueueCard | null;
  audit: Array<{ id: number; action: string; description: string; createdAt: Date | string }>;
  onOpenTriage: () => void;
}) {
  if (!card) {
    return null;
  }

  const stepGuidance = card.steps.length > 0
    ? card.steps.map((step) => `${step.status === "complete" ? "Done" : "Open"}: ${step.title}`)
    : card.hasWaitingEvidence
    ? [
        card.nextAction,
        card.actionable ? "Complete only the due internal follow-up step; external actions remain explicit." : "Do not start card execution before the saved checkpoint is due.",
        "Update or resolve the waiting evidence from Triage when the situation changes.",
      ]
    : card.lane === "overdue"
    ? [
        "Confirm whether the due date is still valid.",
        "Start the timer if Joyce can make progress now.",
        "If blocked, open Triage and leave a signed update before moving on.",
      ]
    : card.lane === "doing"
      ? [
          "Write a short progress update with what changed today.",
          "Confirm the next concrete step before continuing.",
          "Close or move the card only from Triage after the workflow checks pass.",
        ]
      : [
          "Review the blocker and decide whether it still holds.",
          "Choose follow-up, snooze, move, or unblock from the full queue.",
          "Keep Robert or dependency context visible before rescheduling work.",
        ];
  const normalizeContext = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const representedContext = new Set([normalizeContext(card.nextAction), normalizeContext(card.detail)]);
  const contextRecommendations = card.recommendations.filter((item) => !representedContext.has(normalizeContext(item)));

  return (
    <aside className="min-h-full bg-card" data-testid="card-inspector">
      <div className="flex items-start justify-between gap-3 border-b border-border/60 p-5 pr-12">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Card details</p>
          <h2 className="mt-2 text-base font-semibold leading-snug text-foreground">{card.title}</h2>
        </div>
      </div>
      <Tabs key={card.id} defaultValue="details" className="gap-0">
        <div className="border-b border-border/60 px-4 pt-3">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-md p-1">
            <TabsTrigger value="details" className="h-8 text-xs">Details</TabsTrigger>
            <TabsTrigger value="steps" className="h-8 text-xs">Steps</TabsTrigger>
            <TabsTrigger value="activity" className="h-8 text-xs">Activity</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="details" className="space-y-5 p-4">
            <InspectorSection title="Overview">
              <InspectorRow label="Board / List" value={`${card.boardName} / ${card.listName}`} />
              <InspectorRow label="Due" value={getDueLabel(card.due)} tone={card.tone} />
              <InspectorRow label="Priority" value={`${card.priorityTier} (${card.priorityScore})`} tone={card.tone} />
              <InspectorRow label="Assessment" value={card.assessmentState?.replaceAll("_", " ") ?? "Not assessed"} />
              <InspectorRow label="Validated confidence" value={card.confidenceScore == null ? "Not measured" : `${card.confidenceScore}%`} />
              {card.confidenceProfile && (
                <InspectorRow
                  label="Near-certainty ceiling"
                  value={`${card.confidenceProfile.ceiling}% / ${card.confidenceProfile.targetScore}% target`}
                  tone={card.confidenceProfile.eligibleForNearCertainty ? "green" : "amber"}
                />
              )}
              <InspectorRow label="Lane" value={card.laneLabel} />
              {card.hasWaitingEvidence && <InspectorRow label="Waiting on" value={card.waitingOn ?? "Unknown"} />}
              {card.waitingFollowUpAt && <InspectorRow label="Checkpoint" value={formatWaitingDate(card.waitingFollowUpAt)} />}
            </InspectorSection>
            <InspectorSection title="Next action">
              <p className="text-sm font-medium text-foreground">{card.nextAction}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{card.detail}</p>
            </InspectorSection>
            {(contextRecommendations.length > 0 || card.uncertainties.length > 0) && (
              <InspectorSection title="Assessment context">
                {contextRecommendations.slice(0, 3).map((item) => <p key={item} className="text-xs leading-relaxed text-foreground">{item}</p>)}
                {card.uncertainties.slice(0, 2).map((item) => <p key={item} className="text-xs leading-relaxed text-muted-foreground">Uncertainty: {item}</p>)}
              </InspectorSection>
            )}
            {card.confidenceProfile && card.confidenceProfile.blockers.length > 0 && (
              <InspectorSection title={`Path to ${card.confidenceProfile.targetScore}% confidence`}>
                {card.confidenceProfile.blockers.slice(0, 4).map((item) => (
                  <p key={item} className="text-xs leading-relaxed text-muted-foreground">{item}</p>
                ))}
                <p className="text-xs font-medium text-foreground">
                  Current gap: {card.confidenceProfile.gapToTarget} percentage points
                </p>
              </InspectorSection>
            )}
            <InspectorSection title="Card actions">
              <Button variant="outline" className="w-full gap-2 rounded-md" asChild>
                <a href={card.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open card in Trello
                </a>
              </Button>
            </InspectorSection>
            <InspectorSection title="Continue workflow">
              <button type="button" onClick={onOpenTriage} className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-accent">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1">Continue in Triage</span><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </InspectorSection>
        </TabsContent>
        <TabsContent value="steps" className="space-y-5 p-4">
          <InspectorSection title="Recommended workflow">
            {stepGuidance.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-md border border-border bg-background p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                <p className="text-sm leading-relaxed text-foreground">{step}</p>
              </div>
            ))}
            <Button variant="outline" className="mt-2 w-full gap-2 rounded-md" onClick={onOpenTriage}>
              <CheckCircle className="h-4 w-4" />
              Continue workflow in Triage
            </Button>
          </InspectorSection>
        </TabsContent>
        <TabsContent value="activity" className="space-y-5 p-4">
          <InspectorSection title="Recent activity">
            {audit.length > 0 ? (
              <div className="divide-y divide-border rounded-md border border-border bg-background">
                {audit.slice(0, 8).map((event) => (
                  <div key={event.id} className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{event.action.replaceAll("_", " ")}</p>
                      <span className="text-[11px] text-muted-foreground">{getActivityLabel(String(event.createdAt))}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{event.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-sm font-medium text-foreground">No recorded APTLSS activity</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Open Trello for the original card history.</p>
              </div>
            )}
          </InspectorSection>
          <InspectorSection title="State trail">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-muted-foreground" />{card.assessmentState?.replaceAll("_", " ") ?? "Awaiting assessment"}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${card.tone === "red" ? "bg-red-500" : card.tone === "amber" ? "bg-amber-500" : "bg-violet-500"}`} />Priority {card.priorityScore} / {card.priorityTier}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-primary" />{card.confidenceScore == null ? "Confidence not measured" : `${card.confidenceScore}% confidence`}</div>
            </div>
            <Button variant="outline" className="mt-3 w-full gap-2 rounded-md" asChild>
              <a href={card.url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                View full Trello activity
              </a>
            </Button>
          </InspectorSection>
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function InspectorRow({ label, value, tone = "neutral" }: { label: string; value: string; tone?: WorkQueueCard["tone"] | "neutral" }) {
  const toneClasses = {
    red: "text-red-700 dark:text-red-300",
    amber: "text-amber-700 dark:text-amber-300",
    violet: "text-violet-700 dark:text-violet-300",
    green: "text-emerald-700 dark:text-emerald-300",
    neutral: "text-foreground",
  };
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`min-w-0 truncate text-right font-medium ${toneClasses[tone]}`}>{value}</span>
    </div>
  );
}

function EmptyQueueState({ title, body, actionLabel, onAction }: { title: string; body: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <Button variant="outline" className="mt-4 h-9 rounded-md" onClick={onAction}>{actionLabel}</Button>
    </div>
  );
}

function riskTone(risk: WorkQueueCard["risk"]) {
  if (risk === "High") return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  if (risk === "Medium") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}
