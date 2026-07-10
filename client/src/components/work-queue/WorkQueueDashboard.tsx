import React, { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, CheckCircle, ChevronDown, ChevronUp, ExternalLink, MessageSquare, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TRIAGE_TAB_KEY, type AppSection } from "@/lib/navigationState";
import {
  normalizeWorkQueue,
  type WorkQueueCard,
  type WorkQueueLane,
  type WorkQueueLaneId,
  type WorkQueueSourceData,
} from "@/lib/workQueue";
function getDueLabel(due?: string | null) {
  if (!due) return "No due date";
  const dueDate = new Date(due);
  if (Number.isNaN(dueDate.getTime())) return "Due date set";
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const dueKey = dueDate.toISOString().slice(0, 10);
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

export function WorkQueueDashboard({
  trelloDisabledReason,
  actionData,
  actionsLoading,
  actionsError,
  dataNotice,
  activeTimerCardId,
  timerBusy,
  preferredCardId,
  onNavigate,
  onStartTimer,
}: {
  trelloDisabledReason?: string;
  actionData?: WorkQueueSourceData;
  actionsLoading: boolean;
  actionsError?: { message: string } | null;
  dataNotice?: string;
  activeTimerCardId?: string | null;
  timerBusy: boolean;
  preferredCardId?: string | null;
  onNavigate: (section: AppSection) => void;
  onStartTimer: (card: WorkQueueCard) => void;
}) {
  const queue = useMemo(() => normalizeWorkQueue(actionData, preferredCardId), [actionData, preferredCardId]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedCard = selectedId ? queue.cards.find((card) => card.id === selectedId) ?? null : null;
  const itemsByLane = useMemo(() => ({
    overdue: queue.cards.filter((card) => card.lane === "overdue"),
    doing: queue.cards.filter((card) => card.lane === "doing"),
    onhold: queue.cards.filter((card) => card.lane === "onhold"),
  }), [queue.cards]);
  const openTriageQueue = () => {
    localStorage.setItem(TRIAGE_TAB_KEY, "work-intake");
    onNavigate("triage");
  };
  return (
    <>
      <div className="mx-auto flex min-h-[calc(100vh-12rem)] w-full max-w-5xl flex-col gap-4">
        {dataNotice && <Alert><AlertDescription>{dataNotice}</AlertDescription></Alert>}
        <NowPanel
          card={queue.nowItem}
          loading={actionsLoading}
          disabledReason={trelloDisabledReason}
          errorMessage={actionsError?.message}
          activeTimerCardId={activeTimerCardId}
          timerBusy={timerBusy}
          onSelect={(card) => setSelectedId(card.id)}
          onStartTimer={onStartTimer}
          onOpenTriage={openTriageQueue}
          onOpenSettings={() => onNavigate("settings")}
        />
        <NextUpTable
          items={queue.nextItems}
          selectedId={selectedCard?.id}
          onSelect={(card) => setSelectedId(card.id)}
          onOpenQueue={openTriageQueue}
        />
        <TriageLaneSummary
          lanes={queue.lanes}
          itemsByLane={itemsByLane}
          selectedId={selectedCard?.id}
          onSelectCard={(card) => setSelectedId(card.id)}
          onOpenQueue={openTriageQueue}
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
            onOpenTriage={openTriageQueue}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

function NowPanel({
  card,
  loading,
  disabledReason,
  errorMessage,
  activeTimerCardId,
  timerBusy,
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
              </div>
              <div className="mt-5 border-l-2 border-primary pl-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next action</p>
                <p className="mt-1 text-base leading-relaxed text-foreground">{card.nextAction}</p>
              </div>
            </button>
            <div className="flex flex-col justify-end gap-2">
              <Button className="h-10 gap-2 rounded-md" onClick={() => onStartTimer(card)} disabled={timerBusy || running}>
                <Timer className="h-4 w-4" />
                {running ? "Timer running" : "Start timer"}
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

function NextUpTable({ items, selectedId, onSelect, onOpenQueue }: { items: WorkQueueCard[]; selectedId?: string; onSelect: (card: WorkQueueCard) => void; onOpenQueue: () => void }) {
  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next up ({items.length})</p>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={onOpenQueue}>View full queue <ArrowRight className="h-3.5 w-3.5" /></Button>
      </div>
      <div className="p-2">
        {items.length === 0 ? (
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
  itemsByLane,
  selectedId,
  onSelectCard,
  onOpenQueue,
}: {
  lanes: WorkQueueLane[];
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
        {lanes.map((lane) => {
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
  onOpenTriage,
}: {
  card: WorkQueueCard | null;
  onOpenTriage: () => void;
}) {
  if (!card) {
    return null;
  }

  const stepGuidance = card.lane === "overdue"
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
              <InspectorRow label="Priority" value={`${card.risk} risk`} tone={card.tone} />
              <InspectorRow label="Lane" value={card.laneLabel} />
            </InspectorSection>
            <InspectorSection title="Next action">
              <p className="text-sm font-medium text-foreground">{card.nextAction}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{card.detail}</p>
            </InspectorSection>
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
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-sm font-medium text-foreground">{getActivityLabel(card.lastActivity)}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Full comment history and Trello metadata stay out of the dashboard until the card is opened.
              </p>
            </div>
          </InspectorSection>
          <InspectorSection title="State trail">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-muted-foreground" />Captured from Trello action alerts</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${card.tone === "red" ? "bg-red-500" : card.tone === "amber" ? "bg-amber-500" : "bg-violet-500"}`} />Routed to {card.laneLabel}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-primary" />Selected for focused review</div>
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
