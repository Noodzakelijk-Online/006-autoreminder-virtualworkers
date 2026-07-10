import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Activity,
  AlertCircle,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  ClipboardList,
  ExternalLink,
  FileText,
  Loader2,
  Lock,
  MoreHorizontal,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  StopCircle,
  Target,
} from "lucide-react";

type BlockStatus = "planned" | "active" | "done" | "skipped";
type PlanView = "Day Plan" | "Board View" | "Timeline (Compact)" | "Workload" | "Plan History";

type DailyPlanBlock = {
  id: string;
  startTime: string;
  endTime: string;
  cardId: string | null;
  cardName: string;
  cardUrl: string | null;
  boardName: string;
  listName: string;
  action: string;
  stepIds: number[];
  priority: string;
  score: number;
  state: string;
  status: BlockStatus;
  notes: string;
  flags: string[];
};

type DailyPlanPayload = {
  version: 1;
  dateKey: string;
  generatedAt: string;
  generatedBy: "manual" | "auto" | "replan" | "edited";
  blocks: DailyPlanBlock[];
  totalScheduledMinutes: number;
  dailySummary: string;
  topPriority: string;
  robertItems: Array<{ stepId?: number; cardId: string; cardName: string; decision: string; due?: string }>;
  unscheduledCards: Array<{ cardId: string; cardName: string; reason: string; priority?: string }>;
  planHealth: {
    workloadMinutes: number;
    focusMinutes: number;
    bufferMinutes: number;
    overlaps: number;
    gaps: number;
    confidence: number;
    status: "good" | "warning" | "blocked";
    source?: "aptlss" | "trello_fallback" | "off_day" | "legacy";
    warnings?: string[];
  };
  constraints: {
    timezone: "EAT";
    workStart: string;
    workEnd: string;
    isWorkday?: boolean;
    dayType?: "workday" | "off_day";
    offDayReason?: string;
    breaks: Array<{ startTime: string; endTime: string; label: string }>;
  };
  audit: Array<{ at: string; action: string; detail: string }>;
};

type HandoffDraft = {
  dateKey: string;
  draft: string;
  checklist: Array<{ id: string; label: string; done: boolean }>;
};

const timeRows = ["08:00", "09:00", "10:30", "12:00", "13:00", "14:30", "16:30", "17:30", "19:00", "20:00", "21:00", "22:00", "23:00"];
const planViews: PlanView[] = ["Day Plan", "Board View", "Timeline (Compact)", "Workload", "Plan History"];

function todayInEat() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function buildEmptyPlan(dateKey: string): DailyPlanPayload {
  return {
    version: 1,
    dateKey,
    generatedAt: new Date().toISOString(),
    generatedBy: "manual",
    blocks: [],
    totalScheduledMinutes: 0,
    dailySummary: "No saved plan has been generated for this date.",
    topPriority: "Generate today's plan",
    robertItems: [],
    unscheduledCards: [],
    planHealth: {
      workloadMinutes: 0,
      focusMinutes: 0,
      bufferMinutes: 0,
      overlaps: 0,
      gaps: 0,
      confidence: 0,
      status: "warning",
    },
    constraints: {
      timezone: "EAT",
      workStart: "08:00",
      workEnd: "23:00",
      isWorkday: true,
      dayType: "workday",
      breaks: [],
    },
    audit: [],
  };
}

function durationMinutes(block: DailyPlanBlock) {
  return Math.max(0, toMinutes(block.endTime) - toMinutes(block.startTime));
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes < 0) return "-";
  if (minutes === 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function formatGeneratedAt(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function priorityTone(priority: string) {
  const p = priority.toLowerCase();
  if (p.includes("high") || p.includes("critical")) return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  if (p.includes("robert")) return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";
  if (p.includes("low")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (p.includes("blocked")) return "bg-muted text-muted-foreground border-border";
  return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

function accentFor(block: DailyPlanBlock) {
  const p = block.priority.toLowerCase();
  if (p.includes("high") || p.includes("critical")) return "bg-red-500";
  if (p.includes("robert")) return "bg-violet-500";
  if (p.includes("low")) return "bg-emerald-500";
  return "bg-amber-500";
}

function statusTone(status: BlockStatus) {
  if (status === "done") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "active") return "bg-primary/10 text-primary border-primary/30";
  if (status === "skipped") return "bg-muted text-muted-foreground border-border";
  return "bg-card text-muted-foreground border-border";
}

function compactAction(action: string) {
  return action.length > 72 ? `${action.slice(0, 69)}...` : action;
}

function doneLabel(block: DailyPlanBlock) {
  return block.stepIds.length > 0 ? "Mark Step Done" : "Mark Block Done";
}

function planAppliedAt(plan: DailyPlanPayload) {
  return [...(plan.audit ?? [])].reverse().find((entry) => entry.action === "applied")?.at ?? null;
}

function plannerErrorMessage(message?: string) {
  if (!message) return "Generate a plan from the current Trello and APTLSS state. No sample tasks are shown as live work.";
  if (message.includes("Please login") || message.includes("UNAUTHORIZED")) {
    return "Login required: sign in to load, generate, or persist daily plans.";
  }
  if (message.includes("Database not available") || message.includes("Failed query") || message.includes("daily_plans")) {
    return "Database unavailable: daily plan persistence is disabled until DATABASE_URL is configured.";
  }
  if (message.includes("Trello API credentials")) {
    return "Trello credentials missing: configure TrelloAPIKey and TrelloAPIToken before generating a trusted plan.";
  }
  if (message.includes("BUILT_IN_FORGE_API_KEY")) {
    return "AI planner unavailable: configure BUILT_IN_FORGE_API_KEY before generating APTLSS card plans or full daily plans.";
  }
  if (message.includes("No APTLSS plans")) {
    return "No APTLSS plans found: generate card plans first, then return here to build the daily schedule.";
  }
  return message;
}

function isPlannerAuthError(message?: string) {
  return Boolean(message && (message.includes("Please login") || message.includes("UNAUTHORIZED")));
}

export default function PlanMyDay() {
  const [dateKey] = useState(todayInEat);
  const [activeView, setActiveView] = useState<PlanView>("Day Plan");
  const [handoff, setHandoff] = useState<HandoffDraft | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [localChecks, setLocalChecks] = useState<Record<string, boolean>>({});
  const [startingBlockId, setStartingBlockId] = useState<string | null>(null);
  const [stoppingBlockId, setStoppingBlockId] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const auth = useAuth();

  const planQuery = trpc.aptlss.getDailyPlan.useQuery({ dateKey }, { retry: false, staleTime: 30_000 });
  const activeTimer = trpc.timer.getActive.useQuery(undefined, { staleTime: 15_000 });
  const plan = planQuery.data?.plan as DailyPlanPayload | null | undefined;
  const isPreview = !plan;
  const displayPlan = useMemo(() => plan ?? buildEmptyPlan(dateKey), [dateKey, plan]);
  const appliedAt = useMemo(() => planAppliedAt(displayPlan), [displayPlan]);

  const generatePlan = trpc.aptlss.generateDailyPlan.useMutation({
    onSuccess: () => {
      toast.success("Daily plan generated");
      void utils.aptlss.getDailyPlan.invalidate({ dateKey });
    },
    onError: (err) => toast.error("Planner unavailable", { description: err.message }),
  });

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
    onSuccess: (data) => setHandoff(data as HandoffDraft),
    onError: (err) => toast.error("Handoff draft failed", { description: err.message }),
  });

  const startTimer = trpc.timer.start.useMutation({
    onError: (err) => toast.error("Timer failed", { description: err.message }),
  });
  const stopTimer = trpc.timer.stop.useMutation({
    onError: (err) => toast.error("Timer stop failed", { description: err.message }),
  });
  const completeSteps = trpc.aptlss.completeSteps.useMutation({
    onError: (err) => toast.error("Step update failed", { description: err.message }),
  });

  const eatNowMinutes = toMinutes(new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(11, 16));
  const plannedCardBlocks = displayPlan.blocks
    .filter((block) => block.cardId && block.status === "planned")
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  const nowBlock = displayPlan.blocks.find((block) => block.status === "active")
    ?? plannedCardBlocks.find((block) => toMinutes(block.startTime) <= eatNowMinutes && toMinutes(block.endTime) > eatNowMinutes)
    ?? plannedCardBlocks.find((block) => toMinutes(block.startTime) >= eatNowMinutes)
    ?? displayPlan.blocks.find((block) => block.cardId)
    ?? displayPlan.blocks[0];
  const nextBlock = plannedCardBlocks.find((block) => block.id !== nowBlock?.id && toMinutes(block.startTime) >= toMinutes(nowBlock?.endTime ?? "00:00"));
  const completedIds = displayPlan.blocks.filter((block) => block.status === "done").map((block) => block.id);
  const runningCardId = activeTimer.data?.cardId ?? null;

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
    if (!auth.isAuthenticated) {
      toast.error("Sign in required", {
        description: "Starting timers is locked to the signed-in owner.",
      });
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
    if (!auth.isAuthenticated) {
      toast.error("Sign in required", {
        description: "Stopping timers is locked to the signed-in owner.",
      });
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
        isGenerating={generatePlan.isPending}
        appliedAt={appliedAt}
        dateKey={dateKey}
        onGenerate={() => generatePlan.mutate({ dateKey, force: true })}
        onOpenControls={() => setControlsOpen(true)}
      />

      <div className="border-b border-border px-4 md:px-6">
        <div className="flex min-h-14 items-end gap-6 overflow-x-auto">
          {planViews.map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={activeView === tab}
              onClick={() => setActiveView(tab)}
              className={`h-14 shrink-0 border-b-2 px-1 text-sm font-medium ${activeView === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl space-y-4 p-3 md:p-4">
        <PlannerFocusPanel
          nowBlock={nowBlock}
          nextBlock={nextBlock}
          runningCardId={runningCardId}
          timerBusyBlockId={startingBlockId ?? stoppingBlockId}
          onStart={queueStartTimer}
          onStop={queueStopTimer}
          onDone={queueMarkDone}
        />
        <section className="min-w-0">
          {(planQuery.error || isPreview) && (
            <Alert className="mb-3 border-primary/30 bg-primary/10 text-foreground">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{planQuery.error ? "Planner degraded" : "No saved plan yet"}</AlertTitle>
              <AlertDescription>
                <p>{plannerErrorMessage(planQuery.error?.message)}</p>
                {isPlannerAuthError(planQuery.error?.message) && (
                  <LocalPlannerLogin
                    onSuccess={() => {
                      void auth.refresh();
                      void utils.aptlss.getDailyPlan.invalidate({ dateKey });
                      void utils.timer.getActive.invalidate();
                    }}
                  />
                )}
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
              </AlertDescription>
            </Alert>
          )}

          {planQuery.isLoading ? (
            <Card className="rounded-md border-border bg-card py-0 text-foreground shadow-none">
              <CardContent className="space-y-3 p-4">
                {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}
              </CardContent>
            </Card>
          ) : isPreview ? null : (
            <PlannerMainView
              activeView={activeView}
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
          <SheetTitle className="sr-only">Day controls</SheetTitle>
          <SheetDescription className="sr-only">Review plan context, the end-of-day handoff, and approval-gated controls.</SheetDescription>
          <div className="border-b border-border px-4 py-4"><p className="text-sm font-semibold text-foreground">Day controls</p><p className="mt-1 text-xs text-muted-foreground">Plan context, handoff, and approval-gated actions.</p></div>
          <div className="p-4"><CommandRail
            plan={displayPlan}
            isPreview={isPreview}
            handoff={handoff}
            localChecks={localChecks}
            setLocalChecks={setLocalChecks}
            onApply={queueApplyPlan}
            onReplan={() => replan.mutate({ dateKey, completedBlockIds: completedIds, activeBlockId: nowBlock?.status === "active" ? nowBlock.id : undefined })}
            onDraft={() => draftHandoff.mutate({ dateKey })}
            isApplied={Boolean(appliedAt)}
            appliedAt={appliedAt}
            busy={generatePlan.isPending || replan.isPending || draftHandoff.isPending || updatePlan.isPending}
          /></div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LocalPlannerLogin({ onSuccess }: { onSuccess: () => void }) {
  const [token, setToken] = useState("");
  const utils = trpc.useUtils();
  const localLogin = trpc.auth.localLogin.useMutation({
    onSuccess: async () => {
      toast.success("Planner access unlocked");
      await utils.auth.me.invalidate();
      onSuccess();
    },
    onError: (err) => {
      toast.error("Local login failed", { description: err.message });
    },
  });

  return (
    <form
      className="mt-2 flex w-full max-w-xl flex-col gap-2 rounded-md border border-primary/30 bg-card p-3 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        localLogin.mutate({ token });
      }}
    >
      <Input
        type="password"
        value={token}
        onChange={(event) => setToken(event.target.value)}
        placeholder="Local access token"
        className="h-9 border-primary/30 bg-card text-foreground"
        autoComplete="current-password"
      />
      <Button
        type="submit"
        disabled={!token.trim() || localLogin.isPending}
        className="h-9 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {localLogin.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
        Unlock planner
      </Button>
    </form>
  );
}

function PlannerHeader({
  plan,
  isPreview,
  isLoading,
  isGenerating,
  appliedAt,
  dateKey,
  onGenerate,
  onOpenControls,
}: {
  plan: DailyPlanPayload;
  isPreview: boolean;
  isLoading: boolean;
  isGenerating: boolean;
  appliedAt: string | null;
  dateKey: string;
  onGenerate: () => void;
  onOpenControls: () => void;
}) {
  const isOffDay = plan.constraints.dayType === "off_day" || plan.constraints.isWorkday === false;
  const timelineMinutes = plan.blocks.reduce((sum, block) => sum + durationMinutes(block), 0);
  return (
    <header className="flex min-h-[72px] flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-normal text-foreground">Plan My Day</h1>
            {isPreview && <Badge variant="outline">Not generated</Badge>}
            {isOffDay && <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Off day</Badge>}
            {appliedAt && <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Applied {formatGeneratedAt(appliedAt)} EAT</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDate(dateKey)}</span>
            <span>{isPreview ? "Waiting for a trusted plan" : `Generated: ${isLoading ? "loading" : formatGeneratedAt(plan.generatedAt)} EAT`}</span>
            {!isPreview && <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${plan.planHealth.confidence >= 80 ? "bg-emerald-500" : plan.planHealth.confidence >= 60 ? "bg-amber-500" : "bg-red-500"}`} />{isOffDay ? "Off-day" : plan.planHealth.confidence >= 80 ? "High" : plan.planHealth.confidence >= 60 ? "Medium" : "Low"} confidence</span>}
            {!isPreview && <Badge className={`border-0 ${plan.planHealth.confidence >= 80 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : plan.planHealth.confidence >= 60 ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-red-500/10 text-red-700 dark:text-red-300"}`}>{plan.planHealth.confidence}%</Badge>}
            <span>Focus work: {formatDuration(plan.planHealth.workloadMinutes)}</span>
            <span>Full timeline: {formatDuration(timelineMinutes)}</span>
            {isOffDay && plan.constraints.offDayReason && <span>{plan.constraints.offDayReason}</span>}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button className="h-9 bg-primary text-white hover:bg-primary/90" onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {isPreview ? "Generate Plan" : "Regenerate Plan"}
        </Button>
        <Button variant="outline" className="h-9 border-border" onClick={onOpenControls}><MoreHorizontal className="mr-2 h-4 w-4" />Day controls</Button>
      </div>
    </header>
  );
}

function PlannerFocusPanel({
  nowBlock,
  nextBlock,
  runningCardId,
  timerBusyBlockId,
  onStart,
  onStop,
  onDone,
}: {
  nowBlock?: DailyPlanBlock;
  nextBlock?: DailyPlanBlock;
  runningCardId: string | null;
  timerBusyBlockId: string | null;
  onStart: (block: DailyPlanBlock) => void;
  onStop: (block: DailyPlanBlock) => void;
  onDone: (block: DailyPlanBlock) => void;
}) {
  if (!nowBlock) return null;
  const running = runningCardId === nowBlock.cardId;
  return (
    <section className="rounded-md border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /><p className="text-xs font-semibold uppercase tracking-wide text-primary">Now</p></div>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><h2 className="truncate text-lg font-semibold text-foreground">{nowBlock.cardName}</h2><p className="mt-1 text-sm text-muted-foreground">{nowBlock.boardName} / {nowBlock.listName}</p></div>
            <Badge className={`border-0 ${priorityTone(nowBlock.priority)}`}>{nowBlock.priority}</Badge>
          </div>
          <div className="mt-4 border-l-2 border-primary pl-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exactly next</p><p className="mt-1 text-sm font-medium text-foreground">{nowBlock.action}</p><p className="mt-1 text-xs text-muted-foreground">{nowBlock.notes}</p></div>
          {nextBlock && <p className="mt-4 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Next:</span> {nextBlock.cardName} at {nextBlock.startTime}</p>}
        </div>
        <div className="flex flex-col justify-end gap-2">
          <Button className={running ? "bg-foreground text-white hover:bg-foreground/90" : "bg-primary text-white hover:bg-primary/90"} onClick={() => running ? onStop(nowBlock) : onStart(nowBlock)} disabled={!nowBlock.cardId || timerBusyBlockId === nowBlock.id}>
            {running ? <StopCircle className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}{running ? "Stop timer" : "Start timer"}
          </Button>
          <Button variant="outline" onClick={() => onDone(nowBlock)} disabled={nowBlock.status === "done"}><Check className="mr-2 h-4 w-4" />{doneLabel(nowBlock)}</Button>
        </div>
      </div>
    </section>
  );
}

function PlannerMainView({
  activeView,
  plan,
  focusBlockId,
  runningCardId,
  timerBusyBlockId,
  onStart,
  onStop,
  onDone,
  onSkip,
}: {
  activeView: PlanView;
  plan: DailyPlanPayload;
  focusBlockId?: string;
  runningCardId: string | null;
  timerBusyBlockId: string | null;
  onStart: (block: DailyPlanBlock) => void;
  onStop: (block: DailyPlanBlock) => void;
  onDone: (block: DailyPlanBlock) => void;
  onSkip: (block: DailyPlanBlock) => void;
}) {
  if (activeView === "Board View") return <BoardViewPanel plan={plan} focusBlockId={focusBlockId} runningCardId={runningCardId} timerBusyBlockId={timerBusyBlockId} onStart={onStart} onStop={onStop} onDone={onDone} />;
  if (activeView === "Timeline (Compact)") return <CompactTimelinePanel plan={plan} runningCardId={runningCardId} />;
  if (activeView === "Workload") return <WorkloadPanel plan={plan} />;
  if (activeView === "Plan History") return <PlanHistoryPanel plan={plan} />;

  return (
    <TimelineTable
      plan={plan}
      focusBlockId={focusBlockId}
      runningCardId={runningCardId}
      timerBusyBlockId={timerBusyBlockId}
      onStart={onStart}
      onStop={onStop}
      onDone={onDone}
      onSkip={onSkip}
    />
  );
}

function BoardViewPanel({
  plan,
  focusBlockId,
  runningCardId,
  timerBusyBlockId,
  onStart,
  onStop,
  onDone,
}: {
  plan: DailyPlanPayload;
  focusBlockId?: string;
  runningCardId: string | null;
  timerBusyBlockId: string | null;
  onStart: (block: DailyPlanBlock) => void;
  onStop: (block: DailyPlanBlock) => void;
  onDone: (block: DailyPlanBlock) => void;
}) {
  const columns = [
    { id: "high", title: "High Focus", blocks: plan.blocks.filter((block) => block.priority.toLowerCase().includes("high")) },
    { id: "robert", title: "Robert Decisions", blocks: plan.blocks.filter((block) => block.priority.toLowerCase().includes("robert") || block.flags.includes("Robert")) },
    { id: "medium", title: "Medium / Ops", blocks: plan.blocks.filter((block) => block.priority.toLowerCase().includes("medium")) },
    { id: "protected", title: "Protected / Buffer", blocks: plan.blocks.filter((block) => block.flags.includes("Protected") || block.priority.toLowerCase().includes("low")) },
  ];

  return (
    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
      {columns.map((column) => (
        <Card key={column.id} className="rounded-md border-border bg-card py-0 text-foreground shadow-none">
          <CardHeader className="border-b border-border p-4">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>{column.title}</span>
              <Badge variant="outline" className="rounded-md border-border bg-muted/40">{column.blocks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-3">
            {column.blocks.length ? column.blocks.map((block) => (
              <div key={block.id} className="rounded-md border border-border bg-card p-3">
                {(() => {
                  const running = runningCardId === block.cardId;
                  const busy = timerBusyBlockId === block.id;
                  return (
                    <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{block.cardName}</div>
                    <div className="mt-1 text-xs tabular-nums text-muted-foreground">{block.startTime} - {block.endTime}</div>
                  </div>
                  <Badge className={`shrink-0 border-0 ${priorityTone(block.priority)}`}>{block.priority}</Badge>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">{block.action}</div>
                {block.id === focusBlockId ? <Badge variant="outline" className="mt-3">Use Now controls</Badge> : <div className="mt-3 flex items-center gap-2">
                  <Button
                    variant={running ? "default" : "outline"}
                    size="sm"
                    className={`h-8 ${running ? "bg-foreground text-white hover:bg-foreground/90" : "border-border"}`}
                    onClick={() => running ? onStop(block) : onStart(block)}
                    disabled={!block.cardId || busy}
                  >
                    {running ? <StopCircle className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
                    {running ? "Stop" : "Timer"}
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 border-border" onClick={() => onDone(block)} disabled={block.status === "done"}>
                    <Check className="mr-1.5 h-3.5 w-3.5" />{block.stepIds.length > 0 ? "Step" : "Block"}
                  </Button>
                </div>}
                    </>
                  );
                })()}
              </div>
            )) : <EmptyLine text="Nothing in this lane" />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CompactTimelinePanel({ plan, runningCardId }: { plan: DailyPlanPayload; runningCardId: string | null }) {
  return (
    <Card className="rounded-md border-border bg-card py-0 text-foreground shadow-none">
      <CardContent className="p-0">
        {plan.blocks.map((block) => (
          <div key={block.id} className={`grid gap-3 border-b border-border px-4 py-3 text-sm md:grid-cols-[120px_minmax(0,1fr)_120px_90px] ${runningCardId === block.cardId ? "bg-primary/10" : "bg-card"}`}>
            <div className="font-medium tabular-nums text-muted-foreground">{block.startTime} - {block.endTime}</div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-foreground">{block.cardName}</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">{block.action}</div>
            </div>
            <Badge className={`w-fit border-0 ${priorityTone(block.priority)}`}>{block.priority}</Badge>
            <div className="text-right text-xs tabular-nums text-muted-foreground">{formatDuration(durationMinutes(block))}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function WorkloadPanel({ plan }: { plan: DailyPlanPayload }) {
  const focusBlocks = plan.blocks.filter((block) => !block.flags.includes("Protected") && block.cardId);
  const robertMinutes = plan.blocks.filter((block) => block.priority.toLowerCase().includes("robert")).reduce((sum, block) => sum + durationMinutes(block), 0);
  const highMinutes = plan.blocks.filter((block) => block.priority.toLowerCase().includes("high")).reduce((sum, block) => sum + durationMinutes(block), 0);
  const protectedMinutes = plan.blocks.filter((block) => block.flags.includes("Protected")).reduce((sum, block) => sum + durationMinutes(block), 0);

  return (
    <div className="grid gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="rounded-md border-border bg-card py-0 text-foreground shadow-none">
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-sm">Workload Mix</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <WorkloadBar label="High priority" value={highMinutes} total={plan.totalScheduledMinutes} tone="bg-red-500" />
          <WorkloadBar label="Robert windows" value={robertMinutes} total={plan.totalScheduledMinutes} tone="bg-violet-500" />
          <WorkloadBar label="Protected time" value={protectedMinutes} total={plan.totalScheduledMinutes} tone="bg-emerald-500" />
          <WorkloadBar label="Focused cards" value={plan.planHealth.focusMinutes} total={plan.totalScheduledMinutes} tone="bg-blue-600" />
        </CardContent>
      </Card>
      <Card className="rounded-md border-border bg-card py-0 text-foreground shadow-none">
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-sm">Scheduled Work</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {focusBlocks.map((block) => (
            <div key={block.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground">{block.cardName}</div>
                <div className="mt-1 text-xs text-muted-foreground">{block.boardName} - {block.listName}</div>
              </div>
              <div className="shrink-0 text-right">
                <Badge className={`border-0 ${priorityTone(block.priority)}`}>{block.priority}</Badge>
                <div className="mt-1 text-xs tabular-nums text-muted-foreground">{formatDuration(durationMinutes(block))}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function WorkloadBar({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">{formatDuration(value)}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-muted">
        <div className={`h-2 rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PlanHistoryPanel({ plan }: { plan: DailyPlanPayload }) {
  return (
    <Card className="rounded-md border-border bg-card py-0 text-foreground shadow-none">
      <CardHeader className="border-b border-border p-4">
        <CardTitle className="text-sm">Plan History</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border p-0">
        {plan.audit.length ? plan.audit.map((event, index) => (
          <div key={`${event.at}-${index}`} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[150px_140px_minmax(0,1fr)]">
            <div className="text-xs tabular-nums text-muted-foreground">{formatGeneratedAt(event.at)} EAT</div>
            <Badge variant="outline" className="w-fit rounded-md border-border bg-muted/40">{event.action}</Badge>
            <div className="text-muted-foreground">{event.detail}</div>
          </div>
        )) : <div className="p-4"><EmptyLine text="No audit events saved for this plan" /></div>}
      </CardContent>
    </Card>
  );
}

function TimelineTable({
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
  const isOffDay = plan.constraints.dayType === "off_day" || plan.constraints.isWorkday === false;
  const gridColumns = isOffDay
    ? "grid-cols-[64px_minmax(145px,200px)_minmax(0,1fr)_76px]"
    : "min-w-[860px] grid-cols-[72px_220px_minmax(260px,1fr)_92px_172px_72px]";
  return (
    <Card className="overflow-hidden rounded-md border-border bg-card py-0 text-foreground shadow-none">
      <div className={`grid ${gridColumns} border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground`}>
        <div className="px-4 py-3">Time</div>
        <div className="px-4 py-3">Block</div>
        <div className="px-4 py-3">Focus & Next Action</div>
        <div className="px-4 py-3">Priority</div>
        {!isOffDay && <div className="px-4 py-3">Actions</div>}
        {!isOffDay && <div className="px-4 py-3 text-right">Est.</div>}
      </div>
      <div className={isOffDay ? "overflow-hidden" : "overflow-x-auto"}>
        <div className={isOffDay ? "" : "min-w-[860px]"}>
          {plan.blocks.map((block, index) => (
            <TimelineRow
              key={block.id}
              block={block}
              isFocusBlock={block.id === focusBlockId}
              index={index}
              isOffDay={isOffDay}
              running={runningCardId === block.cardId}
              busy={timerBusyBlockId === block.id}
              onStart={onStart}
              onStop={onStop}
              onDone={onDone}
              onSkip={onSkip}
            />
          ))}
          <div className="grid grid-cols-[72px_1fr] border-t border-border bg-muted/40 text-xs text-muted-foreground">
            <div className="px-4 py-3 font-medium">{plan.constraints.workEnd}</div>
            <div className="px-4 py-3">End of Day - system handoff</div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>All times in EAT</span>
        <span>-</span>
        <span>{isOffDay ? plan.constraints.offDayReason ?? "Protected off day" : `Plan respects working window ${plan.constraints.workStart}-${plan.constraints.workEnd}`}</span>
        <span>-</span>
        <span>{isOffDay ? "No routine work scheduled" : "Breaks protected"}</span>
        <span>-</span>
        <span>Robert decision windows prioritized</span>
      </div>
    </Card>
  );
}

function TimelineRow({
  block,
  isFocusBlock,
  index,
  isOffDay,
  running,
  busy,
  onStart,
  onStop,
  onDone,
  onSkip,
}: {
  block: DailyPlanBlock;
  isFocusBlock: boolean;
  index: number;
  isOffDay: boolean;
  running: boolean;
  busy: boolean;
  onStart: (block: DailyPlanBlock) => void;
  onStop: (block: DailyPlanBlock) => void;
  onDone: (block: DailyPlanBlock) => void;
  onSkip: (block: DailyPlanBlock) => void;
}) {
  const hasCard = Boolean(block.cardId);
  const gridColumns = isOffDay
    ? "grid-cols-[64px_minmax(145px,200px)_minmax(0,1fr)_76px]"
    : "grid-cols-[72px_220px_minmax(260px,1fr)_92px_172px_72px]";
  return (
    <div className={`grid ${gridColumns} border-b border-border text-sm ${running ? "bg-primary/10" : "bg-card"}`}>
      <div className="relative px-4 py-4 text-xs font-medium tabular-nums text-muted-foreground">
        <span>{block.startTime}</span>
        <span className={`absolute right-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-card ${running ? "bg-primary" : index % 2 ? "bg-muted-foreground/50" : "bg-muted-foreground/70"}`} />
      </div>
      <div className="flex gap-3 px-4 py-4">
        <span className={`mt-0.5 h-12 w-1 rounded-full ${accentFor(block)}`} />
        <div className="min-w-0">
          <div className={`truncate font-semibold ${block.priority === "Robert" ? "text-violet-700 dark:text-violet-300" : "text-foreground"}`}>{block.cardName}</div>
          <div className="mt-1 text-xs tabular-nums text-muted-foreground">{block.startTime} - {block.endTime}</div>
        </div>
      </div>
      <div className="flex min-w-0 gap-3 px-4 py-4">
        {hasCard && <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
        <div className="min-w-0">
          <div className="truncate font-semibold text-foreground">{compactAction(block.action)}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{block.notes || `${block.boardName} - ${block.listName}`}</div>
          {block.flags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {block.flags.slice(0, 3).map((flag) => <Badge key={flag} variant="outline" className="h-5 rounded-md border-border bg-muted/40 px-1.5 text-[10px]">{flag}</Badge>)}
            </div>
          )}
        </div>
      </div>
      <div className="px-4 py-4">
        <Badge variant="outline" className={`rounded-md border px-2 py-1 text-xs ${priorityTone(block.priority)}`}>{block.priority}</Badge>
      </div>
      {!isOffDay && (isFocusBlock ? <div className="px-4 py-4"><Badge variant="outline">Use Now controls</Badge></div> : <div className="flex items-start gap-2 px-4 py-3">
        <Button
          variant={running ? "default" : "outline"}
          size="icon"
          className={`h-8 w-8 rounded-full ${running ? "bg-foreground text-white hover:bg-foreground/90" : "border-border"}`}
          onClick={() => running ? onStop(block) : onStart(block)}
          disabled={!hasCard || busy}
          title={running ? "Stop timer" : "Start timer"}
          aria-label={running ? `Stop timer for ${block.cardName}` : `Start timer for ${block.cardName}`}
        >
          {running ? <StopCircle className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full border-border"
          onClick={() => onDone(block)}
          disabled={block.status === "done"}
          title={doneLabel(block)}
          aria-label={`${doneLabel(block)}: ${block.cardName}`}
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full border-border"
          onClick={() => onSkip(block)}
          disabled={block.status === "skipped"}
          title="Skip block"
          aria-label={`Skip ${block.cardName}`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
        </Button>
        {block.cardUrl && (
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-border" asChild>
            <a href={block.cardUrl} target="_blank" rel="noreferrer" aria-label={`Open ${block.cardName} in Trello`}><ExternalLink className="h-3.5 w-3.5" /></a>
          </Button>
        )}
      </div>)}
      {!isOffDay && <div className="px-4 py-4 text-right text-sm tabular-nums text-muted-foreground">{formatDuration(durationMinutes(block))}</div>}
    </div>
  );
}

function CommandRail({
  plan,
  isPreview,
  handoff,
  localChecks,
  setLocalChecks,
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
  setLocalChecks: (value: Record<string, boolean>) => void;
  onApply: () => void;
  onReplan: () => void;
  onDraft: () => void;
  isApplied: boolean;
  appliedAt: string | null;
  busy: boolean;
}) {
  const risks = plan.blocks.filter((block) => block.flags.some((flag) => ["Blocked", "Waiting", "Robert"].includes(flag))).slice(0, 4);

  return (
    <aside className="space-y-3">
      <div className="grid grid-cols-1 gap-3">
        <RailCard>
          <RailHeading icon={<AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />} label="RISKS & BLOCKERS" count={risks.length} />
          <div className="mt-3 space-y-3">
            {risks.length ? risks.map((block) => (
              <MiniItem key={block.id} color={block.priority === "Robert" ? "bg-violet-500" : "bg-amber-500"} title={block.cardName} subtitle={block.action} />
            )) : <EmptyLine text="No current blockers" />}
          </div>
          <RailLink label="View all risks" />
        </RailCard>

        <RailCard>
          <RailHeading icon={<Target className="h-3.5 w-3.5 text-violet-700 dark:text-violet-300" />} label="ROBERT DECISIONS" count={plan.robertItems.length} />
          <div className="mt-3 space-y-3">
            {plan.robertItems.length ? plan.robertItems.slice(0, 4).map((item) => (
              <MiniItem key={`${item.cardId}-${item.decision}`} color="bg-violet-500" title={item.cardName} subtitle={item.due ?? item.decision} />
            )) : <EmptyLine text="No Robert decisions open" />}
          </div>
          <RailLink label="Open all" />
        </RailCard>
      </div>

      <RailCard>
        <RailHeading icon={<ClipboardList className="h-3.5 w-3.5 text-primary" />} label="UNSCHEDULED CARDS" count={plan.unscheduledCards.length} />
        <div className="mt-3 space-y-2">
          {plan.unscheduledCards.length ? plan.unscheduledCards.slice(0, 6).map((card) => (
            <div key={card.cardId} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-foreground">{card.cardName}</span>
              <Badge className={`shrink-0 border-0 ${priorityTone(card.priority ?? "Medium")}`}>{card.priority ?? "Medium"}</Badge>
            </div>
          )) : <EmptyLine text="All candidate cards are scheduled" />}
        </div>
        <RailLink label="View all unscheduled" />
      </RailCard>

      <RailCard>
        <RailHeading icon={<Activity className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />} label="PLAN HEALTH" />
        <div className="mt-3 grid grid-cols-5 divide-x divide-border text-xs">
          <HealthMetric label="Workload" value={formatDuration(plan.planHealth.workloadMinutes)} state={plan.planHealth.status === "blocked" ? "Blocked" : "On track"} />
          <HealthMetric label="Focus Time" value={formatDuration(plan.planHealth.focusMinutes)} state="Good" />
          <HealthMetric label="Buffer" value={formatDuration(plan.planHealth.bufferMinutes)} state={plan.planHealth.bufferMinutes >= 60 ? "Ok" : "Tight"} />
          <HealthMetric label="Overlaps" value={String(plan.planHealth.overlaps)} state="Good" />
          <HealthMetric label="Gaps" value={String(plan.planHealth.gaps)} state="Good" />
        </div>
      </RailCard>

      <div className="grid grid-cols-1 gap-3">
        <RailCard>
          <RailHeading icon={<CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />} label="END-OF-DAY HANDOFF" />
          <div className="mt-3 space-y-3">
            {["send_daily_update", "post_updates", "log_time", "prepare_tomorrow"].map((id) => (
              <label key={id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={Boolean(localChecks[id])} onCheckedChange={(checked) => setLocalChecks({ ...localChecks, [id]: checked === true })} />
                {id === "send_daily_update" ? "Send daily update to Robert" : id === "post_updates" ? "Post key updates on Trello cards" : id === "log_time" ? "Log time and close timers" : "Prepare tomorrow's plan"}
              </label>
            ))}
          </div>
          <Button variant="ghost" className="mt-3 h-8 px-0 text-primary" onClick={onDraft} disabled={isPreview || busy}>View template<ChevronRight className="ml-1 h-3.5 w-3.5" /></Button>
          {handoff && <Textarea className="mt-3 min-h-36 text-xs" value={handoff.draft} readOnly />}
        </RailCard>

        <RailCard>
          <RailHeading icon={<ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />} label="APPROVAL-GATED ACTIONS" />
          <div className="mt-3 space-y-2">
            <ActionButton
              icon={<Check className="h-4 w-4" />}
              label={isApplied ? "Plan Applied" : "Apply Plan"}
              helper={isApplied && appliedAt ? `Applied ${formatGeneratedAt(appliedAt)} EAT` : "Record approval; no Trello side effects"}
              onClick={onApply}
              disabled={isPreview || isApplied || busy}
            />
            <ActionButton icon={<RefreshCw className="h-4 w-4" />} label="Replan Remaining Day" helper="Adjust with current context" onClick={onReplan} disabled={isPreview || busy} />
            <ActionButton icon={<ExternalLink className="h-4 w-4" />} label="Draft Trello Updates" helper="Create comments & moves" onClick={onDraft} disabled={isPreview || busy} />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
            <span>Autopilot Level</span>
            <span className="inline-flex items-center gap-1 text-muted-foreground"><Lock className="h-3.5 w-3.5" />Approval gated</span>
          </div>
        </RailCard>
      </div>
    </aside>
  );
}

function RailCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <Card className={`rounded-md border-border bg-card py-0 text-foreground shadow-none ${className}`}><CardContent className="p-4">{children}</CardContent></Card>;
}

function RailHeading({ icon, label, count }: { icon: React.ReactNode; label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold tracking-normal text-foreground">
      {icon}
      <span>{label}</span>
      {typeof count === "number" && count > 0 && <Badge className="h-5 border-0 bg-red-500/10 px-1.5 text-[10px] text-red-700 dark:text-red-300">{count}</Badge>}
    </div>
  );
}

function BlockSummary({ block, compact = false }: { block: DailyPlanBlock; compact?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
        <p className="truncate text-sm font-bold text-foreground">{block.action}</p>
      </div>
      <p className={`mt-1 ${compact ? "text-xs" : "text-sm"} font-medium text-foreground`}>Next action: <span className="font-normal">{block.notes || block.cardName}</span></p>
      <p className="mt-1 text-xs text-muted-foreground">Board: {block.boardName} <span className="mx-1">List:</span> {block.listName}</p>
      <Badge variant="outline" className={`mt-2 rounded-md ${statusTone(block.status)}`}>{block.status}</Badge>
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

function RailLink({ label }: { label: string }) {
  return <button type="button" className="mt-3 flex w-full items-center justify-between text-xs font-medium text-primary">{label}<ChevronRight className="h-3.5 w-3.5" /></button>;
}

function HealthMetric({ label, value, state }: { label: string; value: string; state: string }) {
  return (
    <div className="px-2 first:pl-0 last:pr-0">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold tabular-nums text-foreground">{value}</p>
      <p className={state === "Tight" || state === "Ok" ? "text-amber-600 dark:text-amber-300" : state === "Blocked" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-300"}>{state}</p>
    </div>
  );
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
