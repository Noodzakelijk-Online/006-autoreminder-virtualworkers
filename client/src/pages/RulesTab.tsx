import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getOperationalExceptionCounts } from "@/lib/operationalContext";
import { DEFAULT_PRIORITY_RESULT, PRIORITY_CLASSIFIER_QUESTIONS, type PriorityResult } from "@/lib/priorityPlaybook";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, ArrowRight, Check, CheckCircle2, ChevronRight, CircleAlert, Clock, ExternalLink, ListFilter, RefreshCw, ShieldAlert } from "lucide-react";

type DecisionItem = {
  cardId: string;
  cardName: string;
  cardUrl: string;
  boardName: string;
  listName: string;
  stepId: number;
  stepTitle: string;
  tier: string;
  recommendedDecision: string | null;
};

function priorityTone(tier: string) {
  if (tier === "CRITICAL") return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  if (tier === "HIGH") return "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300";
  if (tier === "BLOCKED") return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";
  if (tier === "LOW") return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

function formatTimestamp(value: Date | string) {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function DecisionsTab() {
  const utils = trpc.useUtils();
  const [activeView, setActiveView] = useState<"inbox" | "history">("inbox");
  const inboxActive = activeView === "inbox";
  const decisionQuery = trpc.aptlss.getDecisionQueue.useQuery(undefined, {
    enabled: inboxActive,
    staleTime: 60_000,
    refetchInterval: inboxActive ? 15 * 60_000 : false,
  });
  const commandQuery = trpc.aptlss.getCommandCenter.useQuery(undefined, { enabled: inboxActive, staleTime: 2 * 60_000 });
  const liveExceptionsQuery = trpc.trello.actionAlerts.useQuery(undefined, { enabled: inboxActive, staleTime: 2 * 60_000 });
  const historyQuery = trpc.aptlss.getDecisionHistory.useQuery(undefined, { enabled: activeView === "history", staleTime: 60_000 });
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const [outcome, setOutcome] = useState("");
  const [classifierOpen, setClassifierOpen] = useState(false);
  const [classifierStep, setClassifierStep] = useState(0);
  const [classifierResult, setClassifierResult] = useState<PriorityResult | null>(null);

  const recordOutcome = trpc.aptlss.recordDecisionOutcome.useMutation({
    onSuccess: async () => {
      toast.success("Decision outcome recorded");
      await Promise.all([
        utils.aptlss.getDecisionQueue.invalidate(),
        utils.aptlss.getCommandCenter.invalidate(),
        utils.aptlss.getDecisionHistory.invalidate(),
      ]);
      setSelectedStepId(null);
      setOutcome("");
    },
    onError: (error) => toast.error("Could not record outcome", { description: error.message }),
  });

  const items: DecisionItem[] = decisionQuery.data?.items ?? [];
  const selectedItem = useMemo(() => items.find((item) => item.stepId === selectedStepId) ?? null, [items, selectedStepId]);
  const nextItem = items[0];
  const remainingItems = items.slice(1);
  const exceptionCounts = getOperationalExceptionCounts(liveExceptionsQuery.data, commandQuery.data);
  const criticalCount = exceptionCounts.critical;
  const waitingCount = exceptionCounts.waiting;
  const blockedCount = exceptionCounts.blocked;
  const operationalContextLoading = commandQuery.isLoading || liveExceptionsQuery.isLoading;
  const currentQuestion = PRIORITY_CLASSIFIER_QUESTIONS[classifierStep];

  const openInspector = (stepId: number) => { setOutcome(""); setSelectedStepId(stepId); };
  const resetClassifier = () => { setClassifierStep(0); setClassifierResult(null); };
  const refreshActiveView = () => {
    if (activeView === "history") {
      void historyQuery.refetch();
      return;
    }
    void decisionQuery.refetch();
    void commandQuery.refetch();
    void liveExceptionsQuery.refetch();
  };
  const answerClassifier = (answer: "yes" | "no") => {
    if (answer === "yes") return setClassifierResult(currentQuestion.yes);
    if (classifierStep === PRIORITY_CLASSIFIER_QUESTIONS.length - 1) return setClassifierResult(DEFAULT_PRIORITY_RESULT);
    setClassifierStep((step) => step + 1);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-xl font-semibold text-foreground">Decisions</h1><p className="mt-1 text-sm text-muted-foreground">Prepared decisions and exceptions requiring Joyce's attention.</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setClassifierOpen(true)}><ListFilter className="h-4 w-4" />Classify task</Button>
          <Button variant="outline" size="icon" aria-label="Refresh decisions" onClick={refreshActiveView}><RefreshCw className={"h-4 w-4 " + (decisionQuery.isFetching || liveExceptionsQuery.isFetching || historyQuery.isFetching ? "animate-spin" : "")} /></Button>
        </div>
      </header>

      <Tabs value={activeView} onValueChange={(value) => setActiveView(value as "inbox" | "history")} className="gap-5">
        <div className="overflow-x-auto border-b border-border">
          <TabsList className="h-11 w-max rounded-none bg-transparent p-0">
            <TabsTrigger value="inbox" className="h-11 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Decision inbox{items.length > 0 && <Badge className="ml-1 border-0 bg-primary/10 text-primary">{items.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="history" className="h-11 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Recent outcomes</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="inbox" className="mt-0 space-y-4">
          <div data-testid="decision-context" data-state={operationalContextLoading ? "loading" : commandQuery.error && liveExceptionsQuery.error ? "error" : "ready"}>
            {operationalContextLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : commandQuery.error && liveExceptionsQuery.error ? (
              <Alert variant="destructive"><CircleAlert className="h-4 w-4" /><AlertTitle>Operational context unavailable</AlertTitle><AlertDescription>{commandQuery.error.message}</AlertDescription></Alert>
            ) : (
              <DecisionContext criticalCount={criticalCount} waitingCount={waitingCount} blockedCount={blockedCount} />
            )}
          </div>
          {!decisionQuery.isLoading && !operationalContextLoading && items.length === 0 && criticalCount + waitingCount + blockedCount > 0 && (
            <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Operational exceptions still need attention</AlertTitle><AlertDescription>No open Robert-decision steps were found, but the live Trello queue still contains overdue, update, or on-hold work. Use Today or Inbox to process those cards.</AlertDescription></Alert>
          )}
          {decisionQuery.error ? (
            <Alert variant="destructive"><CircleAlert className="h-4 w-4" /><AlertTitle>Decision inbox unavailable</AlertTitle><AlertDescription>{decisionQuery.error.message}</AlertDescription></Alert>
          ) : decisionQuery.isLoading || operationalContextLoading ? (
            <div className="space-y-4"><Skeleton className="h-56 w-full" /><Skeleton className="h-36 w-full" /></div>
          ) : nextItem ? (
            <>
              <NextDecision item={nextItem} onOpen={() => openInspector(nextItem.stepId)} />
              <section className="rounded-lg border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border/60 px-4 py-3"><div><h2 className="text-sm font-semibold text-foreground">Remaining decisions</h2><p className="mt-0.5 text-xs text-muted-foreground">Open a row to review context and record Robert's outcome.</p></div><Badge variant="outline">{remainingItems.length}</Badge></div>
                <div className="divide-y divide-border">{remainingItems.length ? remainingItems.map((item) => <DecisionRow key={item.stepId} item={item} onOpen={() => openInspector(item.stepId)} />) : <p className="px-4 py-6 text-sm text-muted-foreground">No other decisions are waiting.</p>}</div>
              </section>
            </>
          ) : <AllClear />}
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <section className="rounded-lg border border-border bg-card shadow-sm">
            <div className="border-b border-border/60 px-4 py-3"><h2 className="text-sm font-semibold text-foreground">Recent outcomes</h2><p className="mt-0.5 text-xs text-muted-foreground">Recorded answers remain visible after their active decision is closed.</p></div>
            {historyQuery.isLoading ? <div className="space-y-3 p-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : historyQuery.error ? <p className="p-4 text-sm text-destructive">{historyQuery.error.message}</p> : historyQuery.data?.length ? <div className="divide-y divide-border">{historyQuery.data.map((item) => <article key={item.id} className="px-4 py-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-foreground">{item.cardName}</h3><p className="mt-1 text-xs text-muted-foreground">{item.decisionPrompt}</p></div><time className="shrink-0 text-xs text-muted-foreground">{formatTimestamp(item.resolvedAt)}</time></div>{item.recommendedDecision && <p className="mt-3 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Recommendation:</span> {item.recommendedDecision}</p>}<p className="mt-2 border-l-2 border-primary pl-3 text-sm text-foreground">{item.outcome}</p></article>)}</div> : <p className="p-8 text-center text-sm text-muted-foreground">No decision outcomes have been recorded yet.</p>}
          </section>
        </TabsContent>
      </Tabs>

      <Sheet open={Boolean(selectedItem)} onOpenChange={(open) => { if (!open) setSelectedStepId(null); }}>
        <SheetContent side="right" className="w-[min(460px,calc(100vw-1rem))] gap-0 overflow-y-auto p-0 sm:max-w-[460px]"><SheetTitle className="sr-only">Decision details</SheetTitle><SheetDescription className="sr-only">Review a decision and record Robert's outcome before resolving it.</SheetDescription>{selectedItem && <DecisionInspector item={selectedItem} outcome={outcome} onOutcomeChange={setOutcome} isSubmitting={recordOutcome.isPending} onRecord={() => recordOutcome.mutate({ stepId: selectedItem.stepId, outcome: outcome.trim() })} />}</SheetContent>
      </Sheet>

      <Dialog open={classifierOpen} onOpenChange={(open) => { setClassifierOpen(open); if (!open) resetClassifier(); }}>
        <DialogContent><DialogHeader><DialogTitle>Classify a task</DialogTitle><DialogDescription>Use the priority check for work not yet represented in the live inbox.</DialogDescription></DialogHeader>{classifierResult ? <div className={"rounded-md border p-4 " + classifierResult.tone}><p className="text-xs font-semibold uppercase tracking-wide">Priority result</p><h3 className="mt-1 text-lg font-semibold">{classifierResult.label}</h3><p className="mt-2 text-sm leading-relaxed">{classifierResult.description}</p></div> : <div><div className="mb-5 flex gap-1">{PRIORITY_CLASSIFIER_QUESTIONS.map((_, index) => <span key={index} className={"h-1 flex-1 rounded-full " + (index === classifierStep ? "bg-primary" : index < classifierStep ? "bg-primary/40" : "bg-muted")} />)}</div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Question {classifierStep + 1} of {PRIORITY_CLASSIFIER_QUESTIONS.length}</p><h3 className="mt-2 text-base font-semibold text-foreground">{currentQuestion.question}</h3><div className="mt-5 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => answerClassifier("yes")}><Check className="h-4 w-4" />Yes</Button><Button variant="outline" onClick={() => answerClassifier("no")}><ArrowRight className="h-4 w-4" />No</Button></div></div>}<DialogFooter><Button variant="ghost" onClick={resetClassifier}>{classifierResult ? "Classify another" : "Start over"}</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}

function DecisionContext({ criticalCount, waitingCount, blockedCount }: { criticalCount: number; waitingCount: number; blockedCount: number }) {
  const items = [{ label: "Critical / overdue", value: criticalCount, icon: ShieldAlert, tone: criticalCount ? "text-red-700 dark:text-red-300" : "text-muted-foreground" }, { label: "Doing updates", value: waitingCount, icon: Clock, tone: waitingCount ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground" }, { label: "On-hold review", value: blockedCount, icon: AlertCircle, tone: blockedCount ? "text-violet-700 dark:text-violet-300" : "text-muted-foreground" }];
  return <section className="grid divide-y divide-border rounded-lg border border-border bg-card shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">{items.map(({ label, value, icon: Icon, tone }) => <div key={label} className="flex items-center gap-3 px-4 py-3"><Icon className={"h-4 w-4 " + tone} /><div><p className="text-xs text-muted-foreground">{label}</p><p className={"text-lg font-semibold " + tone}>{value}</p></div></div>)}</section>;
}

function NextDecision({ item, onOpen }: { item: DecisionItem; onOpen: () => void }) {
  return <section className="rounded-lg border border-primary/35 bg-card shadow-sm"><div className="flex items-center gap-2 border-b border-border/60 px-4 py-3"><span className="h-2.5 w-2.5 rounded-full bg-primary" /><p className="text-xs font-semibold uppercase tracking-wide text-primary">Next decision</p></div><div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_200px]"><div className="min-w-0"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-lg font-semibold text-foreground">{item.cardName}</h2><p className="mt-1 text-sm text-muted-foreground">{item.boardName} / {item.listName}</p></div><Badge variant="outline" className={priorityTone(item.tier)}>{item.tier}</Badge></div><div className="mt-5 border-l-2 border-primary pl-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision needed</p><p className="mt-1 text-sm font-medium text-foreground">{item.stepTitle}</p>{item.recommendedDecision && <p className="mt-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">Recommendation:</span> {item.recommendedDecision}</p>}</div></div><Button className="self-end" onClick={onOpen}>Review decision<ChevronRight className="h-4 w-4" /></Button></div></section>;
}

function DecisionRow({ item, onOpen }: { item: DecisionItem; onOpen: () => void }) {
  return <button type="button" className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-4 text-left transition-colors hover:bg-accent/50" onClick={onOpen}><span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground">{item.cardName}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{item.stepTitle}</span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{item.boardName} / {item.listName}</span></span><span className="flex items-center gap-3"><Badge variant="outline" className={priorityTone(item.tier)}>{item.tier}</Badge><ChevronRight className="h-4 w-4 text-muted-foreground" /></span></button>;
}

function AllClear() {
  return <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-6 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600 dark:text-emerald-300" /><h2 className="mt-3 text-base font-semibold text-foreground">No Robert decisions are waiting</h2><p className="mt-1 text-sm text-muted-foreground">Operational exceptions remain visible above and continue through Today or Inbox.</p></section>;
}

function DecisionInspector({ item, outcome, onOutcomeChange, isSubmitting, onRecord }: { item: DecisionItem; outcome: string; onOutcomeChange: (value: string) => void; isSubmitting: boolean; onRecord: () => void }) {
  return <aside className="min-h-full bg-card"><div className="border-b border-border/60 p-5 pr-12"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision details</p><h2 className="mt-2 text-base font-semibold text-foreground">{item.cardName}</h2><p className="mt-1 text-xs text-muted-foreground">{item.boardName} / {item.listName}</p></div><div className="space-y-5 p-5"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Priority</p><Badge variant="outline" className={priorityTone(item.tier)}>{item.tier}</Badge></div><section><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision needed</p><p className="mt-2 text-sm font-medium leading-relaxed text-foreground">{item.stepTitle}</p></section>{item.recommendedDecision && <section className="rounded-md border border-border bg-background p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommendation</p><p className="mt-2 text-sm leading-relaxed text-foreground">{item.recommendedDecision}</p></section>}<a href={item.cardUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"><ExternalLink className="h-4 w-4" />Open Trello card</a><section className="border-t border-border pt-5"><label htmlFor="decision-outcome" className="text-sm font-semibold text-foreground">Record Robert's outcome</label><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Required. This closes the linked decision internally; it does not post to Trello.</p><Textarea id="decision-outcome" className="mt-3 min-h-32" value={outcome} onChange={(event) => onOutcomeChange(event.target.value)} placeholder="What did Robert decide?" /><Button className="mt-3 w-full" onClick={onRecord} disabled={!outcome.trim() || isSubmitting}>{isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Record outcome</Button></section></div></aside>;
}
