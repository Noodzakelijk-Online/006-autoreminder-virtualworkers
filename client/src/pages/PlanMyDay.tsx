import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  accentFor,
  buildEmptyPlan,
  compactAction,
  doneLabel,
  durationMinutes,
  formatDate,
  formatDuration,
  formatGeneratedAt,
  planAppliedAt,
  plannerErrorMessage,
  priorityTone,
  toMinutes,
  type BlockStatus,
  type DailyPlanBlock,
  type DailyPlanPayload,
  type HandoffDraft,
} from "@/lib/planMyDayModel";
import {
  Activity,
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ClipboardList,
  ExternalLink,
  Loader2,
  Lock,
  PanelRightOpen,
  Play,
  RefreshCw,
  ShieldCheck,
  StopCircle,
  Target,
} from "lucide-react";
import { useEatClock } from "@/hooks/useEatClock";
import { OperationProgress } from "@/components/OperationProgress";

export default function PlanMyDay() {
  const { dateKey, timeKey } = useEatClock();
  const [handoff, setHandoff] = useState<HandoffDraft | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [localChecks, setLocalChecks] = useState<Record<string, boolean>>({});
  const [startingBlockId, setStartingBlockId] = useState<string | null>(null);
  const [stoppingBlockId, setStoppingBlockId] = useState<string | null>(null);
  const [pendingStartBlock, setPendingStartBlock] = useState<DailyPlanBlock | null>(null);
  const [preparingPlans, setPreparingPlans] = useState(false);
  const utils = trpc.useUtils();

  useEffect(() => {
    setHandoff(null);
    setControlsOpen(false);
    setLocalChecks({});
    setPendingStartBlock(null);
  }, [dateKey]);

  const planQuery = trpc.aptlss.getDailyPlan.useQuery({ dateKey }, { retry: false, staleTime: 30_000 });
  const activeTimer = trpc.timer.getActive.useQuery(undefined, { staleTime: 15_000 });
  const plan = planQuery.data?.plan as DailyPlanPayload | null | undefined;
  const isInitialLoading = planQuery.isLoading && planQuery.data === undefined;
  const isPreview = !isInitialLoading && !plan;
  const displayPlan = useMemo(() => plan ?? buildEmptyPlan(dateKey), [dateKey, plan]);
  const appliedAt = useMemo(() => planAppliedAt(displayPlan), [displayPlan]);

  const generatePlan = trpc.aptlss.generateDailyPlan.useMutation({
    onMutate: () => {
      void utils.aptlss.getDailyPlanGenerationProgress.invalidate({ dateKey });
    },
    onSuccess: () => {
      toast.success("Daily plan generated");
      void utils.aptlss.getDailyPlan.invalidate({ dateKey });
      void utils.aptlss.getDailyPlanGenerationProgress.invalidate({ dateKey });
    },
    onError: (err) => {
      toast.error("Planner unavailable", { description: err.message });
      void utils.aptlss.getDailyPlanGenerationProgress.invalidate({ dateKey });
    },
  });
  const generationProgressQuery = trpc.aptlss.getDailyPlanGenerationProgress.useQuery(
    { dateKey },
    {
      retry: false,
      staleTime: 0,
      refetchInterval: (query) => (
        generatePlan.isPending || query.state.data?.status === "running" ? 750 : false
      ),
    },
  );
  const generationProgress = generationProgressQuery.data;
  const isGenerationActive = generatePlan.isPending || generationProgress?.status === "running";

  const prepareCardPlan = trpc.aptlss.generate.useMutation();

  const updatePlan = trpc.aptlss.updateDailyPlan.useMutation({
    onSuccess: () => void utils.aptlss.getDailyPlan.invalidate({ dateKey }),
    onError: (err) => toast.error("Plan update failed", { description: err.message }),
  });

  const replan = trpc.aptlss.replanRemainingDay.useMutation({
    onSuccess: () => {
      toast.success("Remaining day replanned");
      void utils.aptlss.getDailyPlan.invalidate({ dateKey });
    },
    onError: (err) => toast.error("Replan failed", { description: err.message }),
  });

  const draftHandoff = trpc.aptlss.draftDailyHandoff.useMutation({
    onSuccess: (data) => {
      const nextHandoff = data as HandoffDraft;
      setHandoff(nextHandoff);
      setLocalChecks(Object.fromEntries(nextHandoff.checklist.map((item) => [item.id, item.done])));
    },
    onError: (err) => toast.error("Handoff draft failed", { description: err.message }),
  });
  const updateHandoffChecklist = trpc.aptlss.updateDailyHandoffChecklist.useMutation({
    onSuccess: (data) => {
      setHandoff((current) => current ? { ...current, checklist: data.checklist } : current);
      if (data.status === "reviewed") toast.success("End-of-day handoff reviewed");
    },
    onError: (err) => toast.error("Handoff checklist was not saved", { description: err.message }),
  });
  const toggleHandoffItem = (itemId: string, done: boolean) => {
    if (!handoff) return;
    const previousChecks = localChecks;
    const checklist = handoff.checklist.map((item) => item.id === itemId ? { ...item, done } : item);
    setLocalChecks({ ...localChecks, [itemId]: done });
    updateHandoffChecklist.mutate(
      { recordId: handoff.recordId, checklist },
      { onError: () => setLocalChecks(previousChecks) },
    );
  };

  const startTimer = trpc.timer.start.useMutation({
    onError: (err) => toast.error("Timer failed", { description: err.message }),
  });
  const stopTimer = trpc.timer.stop.useMutation({
    onError: (err) => toast.error("Timer stop failed", { description: err.message }),
  });
  const completeSteps = trpc.aptlss.completeSteps.useMutation({
    onError: (err) => toast.error("Step update failed", { description: err.message }),
  });

  const eatNowMinutes = toMinutes(timeKey);
  const plannedCardBlocks = displayPlan.blocks
    .filter((block) => block.cardId && block.status === "planned")
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  const planPreparationCandidates = Array.from(
    new Map(
      displayPlan.blocks
        .filter((block) => block.cardId)
        .map((block) => [block.cardId!, block]),
    ).values(),
  ).slice(0, 12);
  const nowBlock = displayPlan.blocks.find((block) => block.status === "active")
    ?? plannedCardBlocks.find((block) => toMinutes(block.startTime) <= eatNowMinutes && toMinutes(block.endTime) > eatNowMinutes)
    ?? plannedCardBlocks.find((block) => toMinutes(block.startTime) >= eatNowMinutes)
    ?? displayPlan.blocks.find((block) => block.cardId)
    ?? displayPlan.blocks[0];
  const nextBlock = plannedCardBlocks.find((block) => block.id !== nowBlock?.id && toMinutes(block.startTime) >= toMinutes(nowBlock?.endTime ?? "00:00"));
  const completedIds = displayPlan.blocks.filter((block) => block.status === "done").map((block) => block.id);
  const runningCardId = activeTimer.data?.cardId ?? null;

  async function handlePrepareCardPlans() {
    if (!planPreparationCandidates.length || preparingPlans) return;
    setPreparingPlans(true);
    try {
      for (const block of planPreparationCandidates) {
        await prepareCardPlan.mutateAsync({
          cardId: block.cardId!,
          cardName: block.cardName,
          cardUrl: block.cardUrl ?? `https://trello.com/c/${block.cardId}`,
          boardName: block.boardName,
          listName: block.listName,
          forceRefresh: false,
          syncChecklist: false,
        });
      }
      await generatePlan.mutateAsync({ dateKey, force: true });
      await utils.aptlss.getDailyPlan.invalidate({ dateKey });
      toast.success("Card intelligence prepared", {
        description: `${planPreparationCandidates.length} card plans saved without changing Trello.`,
      });
    } catch (error) {
      toast.error("Card preparation failed", { description: error instanceof Error ? error.message : "Unknown planner error" });
    } finally {
      setPreparingPlans(false);
    }
  }

  async function persistStatus(block: DailyPlanBlock, status: BlockStatus) {
    if (isPreview) {
      toast.info("Generate a plan before updating blocks");
      return;
    }
    const action = status === "done" ? "block_done" : status === "skipped" ? "block_skipped" : "block_status_changed";
    const nextPlan: DailyPlanPayload = {
      ...displayPlan,
      blocks: displayPlan.blocks.map((item) => (item.id === block.id ? { ...item, status } : item)),
      audit: [
        ...(displayPlan.audit ?? []),
        {
          at: new Date().toISOString(),
          action,
          detail: `${block.startTime}-${block.endTime} ${block.cardName} marked ${status}. ${block.stepIds.length > 0 ? "Linked APTLSS step state is handled separately." : "No Trello checklist or APTLSS step was changed."}`,
        },
      ].slice(-30),
    };
    await updatePlan.mutateAsync({ dateKey, scheduleJson: nextPlan });
  }

  async function handleStartTimer(block: DailyPlanBlock) {
    if (!block.cardId) return;
    if (isPreview) {
      toast.info("Generate a plan before starting block timers");
      return;
    }
    if (startingBlockId || stoppingBlockId) return;

    setStartingBlockId(block.id);
    try {
      await startTimer.mutateAsync({
        cardId: block.cardId,
        cardName: block.cardName,
        cardUrl: block.cardUrl ?? `https://trello.com/c/${block.cardId}`,
        boardName: block.boardName,
        listName: block.listName,
        source: "plan_my_day",
        planDateKey: dateKey,
        planBlockId: block.id,
        aptlssStepId: block.stepIds[0] ?? null,
        notes: block.action,
      });
      await activeTimer.refetch();
      await persistStatus(block, "active");
      toast.success("Timer started");
    } catch {
      // Mutation onError handlers already surface the failure to Joyce.
    } finally {
      setStartingBlockId(null);
    }
  }

  async function handleStopTimer(block: DailyPlanBlock) {
    if (!block.cardId) return;
    if (isPreview) {
      toast.info("Generate a plan before stopping block timers");
      return;
    }
    if (startingBlockId || stoppingBlockId) return;

    setStoppingBlockId(block.id);
    try {
      await stopTimer.mutateAsync({ cardId: block.cardId });
      await activeTimer.refetch();
      if (block.status === "active") {
        await persistStatus(block, "planned");
      }
      toast.success("Timer stopped");
    } catch {
      // Mutation onError handlers already surface the failure to Joyce.
    } finally {
      setStoppingBlockId(null);
    }
  }

  async function handleMarkDone(block: DailyPlanBlock) {
    if (isPreview) {
      toast.info("Generate a plan before marking steps done");
      return;
    }

    try {
      if (block.stepIds.length > 0) {
        await completeSteps.mutateAsync({ stepIds: block.stepIds });
      }
      await persistStatus(block, "done");
      toast.success(block.stepIds.length > 0 ? "Step marked done" : "Block marked done", {
        description: block.stepIds.length > 0 ? undefined : "No Trello checklist item was changed.",
      });
    } catch {
      // Mutation onError handlers already surface the failure to Joyce.
    }
  }

  async function handleApplyPlan() {
    if (isPreview) {
      toast.info("Generate a plan before applying it");
      return;
    }
    if (appliedAt) {
      toast.info("Plan is already applied");
      return;
    }

    const nextPlan: DailyPlanPayload = {
      ...displayPlan,
      audit: [
        ...(displayPlan.audit ?? []),
        {
          at: new Date().toISOString(),
          action: "applied",
          detail: "Plan applied from the Plan My Day cockpit. No Trello comments, moves, or step changes were made.",
        },
      ],
    };
    await updatePlan.mutateAsync({ dateKey, scheduleJson: nextPlan });
    toast.success("Plan applied", { description: "Approval recorded. External actions remain gated." });
  }

  function queueStatusUpdate(block: DailyPlanBlock, status: BlockStatus) {
    void persistStatus(block, status).catch(() => undefined);
  }

  function queueStartTimer(block: DailyPlanBlock) {
    if (runningCardId && runningCardId !== block.cardId) {
      setPendingStartBlock(block);
      return;
    }
    void handleStartTimer(block);
  }

  function queueStopTimer(block: DailyPlanBlock) {
    void handleStopTimer(block);
  }

  function queueMarkDone(block: DailyPlanBlock) {
    void handleMarkDone(block);
  }

  function queueApplyPlan() {
    void handleApplyPlan().catch(() => undefined);
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-card text-foreground">
      <PlannerHeader
        plan={displayPlan}
        isPreview={isPreview}
        isLoading={planQuery.isLoading}
        isGenerating={isGenerationActive}
        generationPercent={generationProgress?.percent ?? 0}
        appliedAt={appliedAt}
        dateKey={dateKey}
        onGenerate={() => generatePlan.mutate({ dateKey, force: true })}
        onOpenControls={() => setControlsOpen(true)}
      />

      {isGenerationActive && generationProgress && (
        <OperationProgress
          progress={generationProgress}
          className="border-b border-primary/25 px-4 md:px-6"
          testId="plan-generation-progress"
        />
      )}

      <main className="mx-auto w-full max-w-6xl space-y-4 p-3 md:p-4">
        {!isInitialLoading && <PlannerFocusPanel
          nowBlock={nowBlock}
          nextBlock={nextBlock}
          isOffDay={displayPlan.constraints.dayType === "off_day" || displayPlan.constraints.isWorkday === false}
          runningCardId={runningCardId}
          timerBusyBlockId={startingBlockId ?? stoppingBlockId}
          onStart={queueStartTimer}
          onStop={queueStopTimer}
          onDone={queueMarkDone}
        />}
        {!isInitialLoading && !isPreview && <DaySummaryStrip plan={displayPlan} />}
        <section className="min-w-0">
          {!isInitialLoading && (planQuery.error || isPreview) && (
            <Alert className="mb-3 border-primary/30 bg-primary/10 text-foreground">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{planQuery.error ? "Planner degraded" : "No saved plan yet"}</AlertTitle>
              <AlertDescription>
                <p>{plannerErrorMessage(planQuery.error?.message)}</p>
              </AlertDescription>
            </Alert>
          )}

          {!isPreview && (displayPlan.planHealth.warnings?.length ?? 0) > 0 && (
            <Alert className="mb-3 border-amber-500/35 bg-amber-500/10 text-foreground">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle>Plan needs review</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {displayPlan.planHealth.warnings?.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
                {displayPlan.planHealth.source === "trello_fallback" && <p className="mt-2 font-medium">Open Inbox - Work Intake and generate APTLSS card plans before relying on this schedule.</p>}
                {(displayPlan.planHealth.source === "trello_fallback" || displayPlan.planHealth.source === "legacy") && planPreparationCandidates.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="prepare-aptlss-plans"
                    className="mt-3"
                    disabled={preparingPlans}
                    onClick={() => void handlePrepareCardPlans()}
                  >
                    {preparingPlans ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    {preparingPlans ? "Preparing card plans..." : `Prepare ${planPreparationCandidates.length} card plans`}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {isInitialLoading ? (
            <Card className="rounded-md border-border bg-card py-0 text-foreground shadow-none">
              <CardContent className="space-y-3 p-4">
                {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}
              </CardContent>
            </Card>
          ) : isPreview ? null : (
            <AgendaPanel
              plan={displayPlan}
              focusBlockId={nowBlock?.id}
              runningCardId={runningCardId}
              timerBusyBlockId={startingBlockId ?? stoppingBlockId}
              onStart={queueStartTimer}
              onStop={queueStopTimer}
              onDone={queueMarkDone}
              onSkip={(block) => queueStatusUpdate(block, "skipped")}
            />
          )}
        </section>
      </main>

      <Sheet open={controlsOpen} onOpenChange={setControlsOpen}>
        <SheetContent side="right" className="w-[min(460px,calc(100vw-1rem))] overflow-y-auto p-0 sm:max-w-[460px]">
          <SheetTitle className="sr-only">Plan details</SheetTitle>
          <SheetDescription className="sr-only">Review plan health, exceptions, workload evidence, history, handoff, and approval-gated controls.</SheetDescription>
          <div className="border-b border-border px-4 py-4"><p className="text-sm font-semibold text-foreground">Plan details</p><p className="mt-1 text-xs text-muted-foreground">Context and secondary actions, available when you need them.</p></div>
          <div className="p-4"><CommandRail
            plan={displayPlan}
            isPreview={isPreview}
            handoff={handoff}
            localChecks={localChecks}
            onToggleHandoffItem={toggleHandoffItem}
            onApply={queueApplyPlan}
            onReplan={() => replan.mutate({ dateKey, completedBlockIds: completedIds, activeBlockId: nowBlock?.status === "active" ? nowBlock.id : undefined })}
            onDraft={() => draftHandoff.mutate({ dateKey })}
            isApplied={Boolean(appliedAt)}
            appliedAt={appliedAt}
            busy={generatePlan.isPending || replan.isPending || draftHandoff.isPending || updatePlan.isPending || updateHandoffChecklist.isPending}
          /></div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(pendingStartBlock)} onOpenChange={(open) => { if (!open) setPendingStartBlock(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch the active timer?</AlertDialogTitle>
            <AlertDialogDescription>
              The running timer{activeTimer.data?.cardName ? ` for ${activeTimer.data.cardName}` : ""} will be stopped and saved before the selected plan block starts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current timer</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const block = pendingStartBlock;
              setPendingStartBlock(null);
              if (block) void handleStartTimer(block);
            }}>Switch timer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PlannerHeader({
  plan,
  isPreview,
  isLoading,
  isGenerating,
  generationPercent,
  appliedAt,
  dateKey,
  onGenerate,
  onOpenControls,
}: {
  plan: DailyPlanPayload;
  isPreview: boolean;
  isLoading: boolean;
  isGenerating: boolean;
  generationPercent: number;
  appliedAt: string | null;
  dateKey: string;
  onGenerate: () => void;
  onOpenControls: () => void;
}) {
  const isOffDay = plan.constraints.dayType === "off_day" || plan.constraints.isWorkday === false;
  const confidenceVerified = plan.planHealth.source !== "legacy";
  const timelineMinutes = plan.blocks.reduce((sum, block) => sum + durationMinutes(block), 0);
  return (
    <header className="flex min-h-[72px] flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-normal text-foreground">Plan My Day</h2>
            {isLoading ? <Badge variant="outline">Loading plan</Badge> : isPreview ? <Badge variant="outline">Not generated</Badge> : null}
            {!isLoading && !isPreview && !confidenceVerified && <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">Unverified plan</Badge>}
            {isOffDay && <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Off day</Badge>}
            {appliedAt && <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Applied {formatGeneratedAt(appliedAt)} EAT</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDate(dateKey)}</span>
            <span>{isLoading ? "Loading saved plan" : isPreview ? "Waiting for a trusted plan" : `Generated: ${formatGeneratedAt(plan.generatedAt)} EAT`}</span>
            {!isLoading && !isPreview && confidenceVerified && <Badge className={`border-0 ${plan.planHealth.confidence >= 80 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : plan.planHealth.confidence >= 60 ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-red-500/10 text-red-700 dark:text-red-300"}`}>{plan.planHealth.confidence}% confidence</Badge>}
            {!isLoading && !isPreview && !confidenceVerified && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Unverified confidence</span>}
            {!isLoading && <span>{isOffDay ? "Protected window" : "Scheduled"}: {formatDuration(timelineMinutes)}</span>}
            {isOffDay && plan.constraints.offDayReason && <span>{plan.constraints.offDayReason}</span>}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button className="h-9 bg-primary text-white hover:bg-primary/90" onClick={onGenerate} disabled={isLoading || isGenerating || isOffDay} title={isOffDay ? "Sunday is protected; generate the next working plan on Monday" : undefined}>
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {isOffDay ? "Protected day" : isGenerating ? `Generating ${generationPercent}%` : isPreview ? "Generate Plan" : "Regenerate Plan"}
        </Button>
        <Button variant="outline" className="h-9 border-border" onClick={onOpenControls}><PanelRightOpen className="mr-2 h-4 w-4" />Plan details</Button>
      </div>
    </header>
  );
}

function PlannerFocusPanel({
  nowBlock,
  nextBlock,
  isOffDay,
  runningCardId,
  timerBusyBlockId,
  onStart,
  onStop,
  onDone,
}: {
  nowBlock?: DailyPlanBlock;
  nextBlock?: DailyPlanBlock;
  isOffDay: boolean;
  runningCardId: string | null;
  timerBusyBlockId: string | null;
  onStart: (block: DailyPlanBlock) => void;
  onStop: (block: DailyPlanBlock) => void;
  onDone: (block: DailyPlanBlock) => void;
}) {
  if (!nowBlock) return null;
  const running = runningCardId === nowBlock.cardId;
  const switching = Boolean(runningCardId && !running);
  return (
    <section className="rounded-md border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /><p className="text-xs font-semibold uppercase tracking-wide text-primary">Now</p></div>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><h2 className="break-words text-lg font-semibold text-foreground">{nowBlock.cardName}</h2><p className="mt-1 text-sm text-muted-foreground">{nowBlock.boardName} / {nowBlock.listName}</p></div>
            <Badge className={`border-0 ${priorityTone(nowBlock.priority)}`}>{nowBlock.priority}</Badge>
          </div>
          <div className="mt-4 border-l-2 border-primary pl-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exactly next</p><p className="mt-1 text-sm font-medium text-foreground">{nowBlock.action}</p><p className="mt-1 text-xs text-muted-foreground">{nowBlock.notes}</p></div>
          {nextBlock && <p className="mt-4 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Next:</span> {nextBlock.cardName} at {nextBlock.startTime}</p>}
        </div>
        {isOffDay ? (
          <div className="flex items-center rounded-md border border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">No execution actions on protected time.</div>
        ) : (
          <div className="flex flex-col justify-end gap-2">
            <Button className={running ? "bg-foreground text-white hover:bg-foreground/90" : "bg-primary text-white hover:bg-primary/90"} onClick={() => running ? onStop(nowBlock) : onStart(nowBlock)} disabled={!nowBlock.cardId || timerBusyBlockId === nowBlock.id}>
              {running ? <StopCircle className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}{running ? "Stop timer" : switching ? "Switch timer" : "Start timer"}
            </Button>
            <Button variant="outline" onClick={() => onDone(nowBlock)} disabled={nowBlock.status === "done"}><Check className="mr-2 h-4 w-4" />{doneLabel(nowBlock)}</Button>
          </div>
        )}
      </div>
    </section>
  );
}

function DaySummaryStrip({ plan }: { plan: DailyPlanPayload }) {
  const protectedMinutes = plan.blocks
    .filter((block) => block.flags.includes("Protected"))
    .reduce((sum, block) => sum + durationMinutes(block), 0);
  const decisionCount = plan.robertItems.length
    || plan.blocks.filter((block) => block.flags.includes("Robert") || block.priority.toLowerCase().includes("robert")).length;
  return (
    <section className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-md border border-border bg-card sm:grid-cols-4 sm:divide-y-0">
      <SummaryMetric label="Focus time" value={formatDuration(plan.planHealth.focusMinutes)} tone="text-emerald-600 dark:text-emerald-400" />
      <SummaryMetric label="Protected time" value={formatDuration(protectedMinutes)} tone="text-blue-600 dark:text-blue-400" />
      <SummaryMetric label="Decisions" value={String(decisionCount)} tone={decisionCount ? "text-violet-600 dark:text-violet-400" : "text-foreground"} />
      <SummaryMetric label="Unscheduled" value={String(plan.unscheduledCards.length)} tone={plan.unscheduledCards.length ? "text-amber-600 dark:text-amber-400" : "text-foreground"} />
    </section>
  );
}

function SummaryMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function AgendaPanel({
  plan,
  focusBlockId,
  runningCardId,
  timerBusyBlockId,
  onStart,
  onStop,
  onDone,
  onSkip,
}: {
  plan: DailyPlanPayload;
  focusBlockId?: string;
  runningCardId: string | null;
  timerBusyBlockId: string | null;
  onStart: (block: DailyPlanBlock) => void;
  onStop: (block: DailyPlanBlock) => void;
  onDone: (block: DailyPlanBlock) => void;
  onSkip: (block: DailyPlanBlock) => void;
}) {
  const [expandedBlockIds, setExpandedBlockIds] = useState<Set<string>>(() => new Set());
  const isOffDay = plan.constraints.dayType === "off_day" || plan.constraints.isWorkday === false;
  const toggleBlock = (blockId: string) => {
    setExpandedBlockIds((current) => {
      const next = new Set(current);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  };
  return (
    <section className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Today's agenda</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Open a block only when you need its context or controls.</p>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{plan.constraints.workStart}-{plan.constraints.workEnd} EAT</span>
      </div>
      <div className="divide-y divide-border">
        {plan.blocks.map((block) => (
          <AgendaRow
            key={block.id}
            block={block}
            expanded={expandedBlockIds.has(block.id)}
            isFocusBlock={block.id === focusBlockId}
            isOffDay={isOffDay}
            running={runningCardId === block.cardId}
            switching={Boolean(runningCardId && runningCardId !== block.cardId)}
            busy={timerBusyBlockId === block.id}
            onToggle={() => toggleBlock(block.id)}
            onStart={onStart}
            onStop={onStop}
            onDone={onDone}
            onSkip={onSkip}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>{isOffDay ? plan.constraints.offDayReason ?? "Protected off day" : "Protected breaks and decision windows are included in the agenda."}</span>
      </div>
    </section>
  );
}

function AgendaRow({
  block,
  expanded,
  isFocusBlock,
  isOffDay,
  running,
  switching,
  busy,
  onToggle,
  onStart,
  onStop,
  onDone,
  onSkip,
}: {
  block: DailyPlanBlock;
  expanded: boolean;
  isFocusBlock: boolean;
  isOffDay: boolean;
  running: boolean;
  switching: boolean;
  busy: boolean;
  onToggle: () => void;
  onStart: (block: DailyPlanBlock) => void;
  onStop: (block: DailyPlanBlock) => void;
  onDone: (block: DailyPlanBlock) => void;
  onSkip: (block: DailyPlanBlock) => void;
}) {
  const hasCard = Boolean(block.cardId);
  return (
    <div className={running ? "bg-primary/10" : isFocusBlock ? "bg-primary/[0.04]" : "bg-card"}>
      <button
        type="button"
        className="grid w-full grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 md:grid-cols-[72px_minmax(0,1fr)_auto_70px_20px]"
        aria-expanded={expanded}
        aria-controls={`agenda-block-${block.id}`}
        onClick={onToggle}
      >
        <span className="text-sm font-semibold tabular-nums text-foreground">{block.startTime}</span>
        <span className="flex min-w-0 gap-3">
          <span className={`h-auto min-h-10 w-1 shrink-0 rounded-full ${accentFor(block)}`} />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="break-words text-sm font-semibold text-foreground">{block.cardName}</span>
              {running && <span className="text-[10px] font-semibold uppercase text-primary">Running</span>}
              {isFocusBlock && !running && <span className="text-[10px] font-semibold uppercase text-primary">Now</span>}
            </span>
            <span className="mt-1 block truncate text-xs text-muted-foreground">{compactAction(block.action)}</span>
          </span>
        </span>
        <Badge variant="outline" className={`hidden rounded-md border px-2 py-1 text-xs sm:inline-flex ${priorityTone(block.priority)}`}>{block.priority}</Badge>
        <span className="hidden text-right text-xs tabular-nums text-muted-foreground md:block">{formatDuration(durationMinutes(block))}</span>
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div id={`agenda-block-${block.id}`} className="border-t border-border/70 bg-muted/15 px-4 py-3 md:pl-[103px]">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0 space-y-2">
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Next action</p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-foreground">{block.action}</p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{block.startTime}-{block.endTime} EAT</span>
                <span>{block.boardName} / {block.listName}</span>
                <span>Status: {block.status}</span>
              </div>
              {block.notes && <p className="text-xs leading-relaxed text-muted-foreground">{block.notes}</p>}
              {block.flags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {block.flags.map((flag) => <Badge key={flag} variant="outline" className="h-5 rounded-md border-border bg-background px-1.5 text-[10px]">{flag}</Badge>)}
                </div>
              )}
            </div>
            {!isOffDay && (
              <div className="flex flex-wrap gap-2">
                {isFocusBlock ? (
                  <span className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs text-muted-foreground">Use the Now controls above</span>
                ) : (
                  <>
                    <Button
                      variant={running ? "default" : "outline"}
                      size="sm"
                      className={running ? "h-8 bg-foreground text-white hover:bg-foreground/90" : "h-8 border-border"}
                      onClick={() => running ? onStop(block) : onStart(block)}
                      disabled={!hasCard || busy}
                    >
                      {running ? <StopCircle className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
                      {running ? "Stop timer" : switching ? "Switch timer" : "Start timer"}
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 border-border" onClick={() => onDone(block)} disabled={block.status === "done"}>
                      <Check className="mr-1.5 h-3.5 w-3.5" />{doneLabel(block)}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8" onClick={() => onSkip(block)} disabled={block.status === "skipped"}>Skip</Button>
                  </>
                )}
                {block.cardUrl && (
                  <Button variant="outline" size="icon" className="h-8 w-8 border-border" asChild>
                    <a href={block.cardUrl} target="_blank" rel="noreferrer" aria-label={`Open ${block.cardName} in Trello`}><ExternalLink className="h-3.5 w-3.5" /></a>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CommandRail({
  plan,
  isPreview,
  handoff,
  localChecks,
  onToggleHandoffItem,
  onApply,
  onReplan,
  onDraft,
  isApplied,
  appliedAt,
  busy,
}: {
  plan: DailyPlanPayload;
  isPreview: boolean;
  handoff: HandoffDraft | null;
  localChecks: Record<string, boolean>;
  onToggleHandoffItem: (itemId: string, done: boolean) => void;
  onApply: () => void;
  onReplan: () => void;
  onDraft: () => void;
  isApplied: boolean;
  appliedAt: string | null;
  busy: boolean;
}) {
  const risks = plan.blocks.filter((block) => block.flags.some((flag) => ["Blocked", "Waiting", "Robert"].includes(flag))).slice(0, 4);
  const handoffItems = handoff?.checklist ?? [
    { id: "send_daily_update", label: "Send daily update to Robert", done: false },
    { id: "post_key_updates", label: "Post key updates on Trello cards", done: false },
    { id: "log_time", label: "Log time and close timers", done: false },
    { id: "close_browser_tabs", label: "Save needed references and close work tabs", done: false },
    { id: "prepare_tomorrow", label: "Prepare tomorrow's plan", done: false },
  ];
  const focusBlocks = plan.blocks.filter((block) => block.cardId && !block.flags.includes("Protected"));
  const highMinutes = plan.blocks
    .filter((block) => block.priority.toLowerCase().includes("high"))
    .reduce((sum, block) => sum + durationMinutes(block), 0);
  const protectedMinutes = plan.blocks
    .filter((block) => block.flags.includes("Protected"))
    .reduce((sum, block) => sum + durationMinutes(block), 0);

  return (
    <aside>
      <Accordion type="multiple" defaultValue={["health"]} className="space-y-2">
        <PlanDetailSection value="health" icon={<Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />} label="Plan health">
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            <DetailMetric label="Confidence" value={`${plan.planHealth.confidence}%`} />
            <DetailMetric label="Status" value={plan.planHealth.status === "blocked" ? "Blocked" : plan.planHealth.status === "warning" ? "Needs review" : "Good"} />
            <DetailMetric label="Focus work" value={formatDuration(plan.planHealth.focusMinutes)} />
            <DetailMetric label="Buffer" value={formatDuration(plan.planHealth.bufferMinutes)} />
            <DetailMetric label="Overlaps" value={String(plan.planHealth.overlaps)} />
            <DetailMetric label="Schedule gaps" value={String(plan.planHealth.gaps)} />
          </div>
          {(plan.planHealth.warnings?.length ?? 0) > 0 && (
            <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-amber-700 dark:text-amber-300">
              {plan.planHealth.warnings?.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          )}
        </PlanDetailSection>

        <PlanDetailSection
          value="exceptions"
          icon={<AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
          label="Risks and Robert decisions"
          count={risks.length + plan.robertItems.length}
        >
          <div className="space-y-3">
            {risks.map((block) => <MiniItem key={block.id} color="bg-amber-500" title={block.cardName} subtitle={block.action} />)}
            {plan.robertItems.map((item) => <MiniItem key={`${item.cardId}-${item.decision}`} color="bg-violet-500" title={item.cardName} subtitle={item.decision} />)}
            {!risks.length && !plan.robertItems.length && <EmptyLine text="No current risks or Robert decisions" />}
          </div>
        </PlanDetailSection>

        <PlanDetailSection value="unscheduled" icon={<ClipboardList className="h-4 w-4 text-primary" />} label="Unscheduled cards" count={plan.unscheduledCards.length}>
          <div className="space-y-3">
            {plan.unscheduledCards.map((card) => (
              <div key={card.cardId} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">{card.cardName}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{card.reason}</p>
                </div>
                <Badge className={`shrink-0 border-0 ${priorityTone(card.priority ?? "Medium")}`}>{card.priority ?? "Medium"}</Badge>
              </div>
            ))}
            {!plan.unscheduledCards.length && <EmptyLine text="All candidate cards are scheduled" />}
          </div>
        </PlanDetailSection>

        <PlanDetailSection value="workload" icon={<Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />} label="Workload evidence">
          <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            <p><span className="font-semibold text-foreground">{formatDuration(plan.planHealth.focusMinutes)}</span> of focused work is scheduled across {focusBlocks.length} card blocks.</p>
            <p><span className="font-semibold text-foreground">{formatDuration(highMinutes)}</span> is allocated to high-priority work.</p>
            <p><span className="font-semibold text-foreground">{formatDuration(protectedMinutes)}</span> is reserved as protected time.</p>
            <p>{plan.unscheduledCards.length} candidate {plan.unscheduledCards.length === 1 ? "card remains" : "cards remain"} outside the agenda.</p>
          </div>
        </PlanDetailSection>

        <PlanDetailSection value="history" icon={<Clock className="h-4 w-4 text-muted-foreground" />} label="Plan history" count={plan.audit.length}>
          <div className="space-y-3">
            {plan.audit.length ? [...plan.audit].reverse().map((event, index) => (
              <div key={`${event.at}-${index}`} className="border-l border-border pl-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-foreground">{event.action}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{formatGeneratedAt(event.at)} EAT</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{event.detail}</p>
              </div>
            )) : <EmptyLine text="No audit events saved for this plan" />}
          </div>
        </PlanDetailSection>

        <PlanDetailSection value="handoff" icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />} label="End-of-day handoff">
          <div className="space-y-3">
            {handoffItems.map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={Boolean(localChecks[item.id])}
                  disabled={!handoff || busy}
                  onCheckedChange={(checked) => onToggleHandoffItem(item.id, checked === true)}
                />
                {item.label}
              </label>
            ))}
          </div>
          {!handoff && <p className="mt-3 text-[11px] text-muted-foreground">Draft the handoff before recording checklist evidence.</p>}
          {!handoff && <Button variant="outline" className="mt-3 h-8" onClick={onDraft} disabled={isPreview || busy}>Draft handoff</Button>}
          {handoff && <Textarea className="mt-3 min-h-36 text-xs" value={handoff.draft} readOnly />}
        </PlanDetailSection>

        <PlanDetailSection value="actions" icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />} label="Approval-gated actions">
          <div className="space-y-2">
            <ActionButton
              icon={<Check className="h-4 w-4" />}
              label={isApplied ? "Plan Applied" : "Apply Plan"}
              helper={isApplied && appliedAt ? `Applied ${formatGeneratedAt(appliedAt)} EAT` : "Record approval; no Trello side effects"}
              onClick={onApply}
              disabled={isPreview || isApplied || busy}
            />
            <ActionButton icon={<RefreshCw className="h-4 w-4" />} label="Replan Remaining Day" helper="Adjust with current context" onClick={onReplan} disabled={isPreview || busy} />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
            <span>External side effects</span>
            <span className="inline-flex items-center gap-1 text-muted-foreground"><Lock className="h-3.5 w-3.5" />Approval gated</span>
          </div>
        </PlanDetailSection>
      </Accordion>
    </aside>
  );
}

function PlanDetailSection({
  value,
  icon,
  label,
  count,
  children,
}: {
  value: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value} className="rounded-md border border-border bg-card px-3">
      <AccordionTrigger className="py-3 text-sm hover:no-underline">
        <span className="flex items-center gap-2">
          {icon}
          <span>{label}</span>
          {typeof count === "number" && count > 0 && <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{count}</Badge>}
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-4 pt-1">{children}</AccordionContent>
    </AccordionItem>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function MiniItem({ color, title, subtitle }: { color: string; title: string; subtitle: string }) {
  return (
    <div className="flex gap-2">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${color}`} />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}

function ActionButton({ icon, label, helper, onClick, disabled }: { icon: React.ReactNode; label: string; helper: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="outline" className="h-auto w-full justify-start border-border px-3 py-2 text-left" onClick={onClick} disabled={disabled}>
      <span className="mr-3">{icon}</span>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs font-normal text-muted-foreground">{helper}</span>
      </span>
    </Button>
  );
}
