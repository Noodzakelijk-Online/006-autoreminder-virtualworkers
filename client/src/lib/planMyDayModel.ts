export type BlockStatus = "planned" | "active" | "done" | "skipped";
export type PlanView = "Day Plan" | "Board View" | "Timeline (Compact)" | "Workload" | "Plan History";

export type DailyPlanBlock = {
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

export type DailyPlanPayload = {
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

export type HandoffDraft = {
  dateKey: string;
  draft: string;
  checklist: Array<{ id: string; label: string; done: boolean }>;
};

export const timeRows = ["08:00", "09:00", "10:30", "12:00", "13:00", "14:30", "16:30", "17:30", "19:00", "20:00", "21:00", "22:00", "23:00"];
export const planViews: PlanView[] = ["Day Plan", "Board View", "Timeline (Compact)", "Workload", "Plan History"];

export function todayInEat(now = Date.now()) {
  return new Date(now + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function buildEmptyPlan(dateKey: string): DailyPlanPayload {
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

export function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function durationMinutes(block: DailyPlanBlock) {
  return Math.max(0, toMinutes(block.endTime) - toMinutes(block.startTime));
}

export function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes < 0) return "-";
  if (minutes === 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function formatGeneratedAt(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function priorityTone(priority: string) {
  const normalized = priority.toLowerCase();
  if (normalized.includes("high") || normalized.includes("critical")) return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  if (normalized.includes("robert")) return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";
  if (normalized.includes("low")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (normalized.includes("blocked")) return "bg-muted text-muted-foreground border-border";
  return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

export function accentFor(block: DailyPlanBlock) {
  const priority = block.priority.toLowerCase();
  if (priority.includes("high") || priority.includes("critical")) return "bg-red-500";
  if (priority.includes("robert")) return "bg-violet-500";
  if (priority.includes("low")) return "bg-emerald-500";
  return "bg-amber-500";
}

export function statusTone(status: BlockStatus) {
  if (status === "done") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "active") return "bg-primary/10 text-primary border-primary/30";
  if (status === "skipped") return "bg-muted text-muted-foreground border-border";
  return "bg-card text-muted-foreground border-border";
}

export function compactAction(action: string) {
  return action.length > 72 ? `${action.slice(0, 69)}...` : action;
}

export function doneLabel(block: DailyPlanBlock) {
  return block.stepIds.length > 0 ? "Mark Step Done" : "Mark Block Done";
}

export function planAppliedAt(plan: DailyPlanPayload) {
  return [...(plan.audit ?? [])].reverse().find((entry) => entry.action === "applied")?.at ?? null;
}

export function plannerErrorMessage(message?: string) {
  if (!message) return "Generate a plan from the current Trello and APTLSS state. No sample tasks are shown as live work.";
  if (message.includes("Please login") || message.includes("UNAUTHORIZED")) return "Login required: sign in to load, generate, or persist daily plans.";
  if (message.includes("Database not available") || message.includes("Failed query") || message.includes("daily_plans")) return "Database unavailable: daily plan persistence is disabled until DATABASE_URL is configured.";
  if (message.includes("Trello API credentials")) return "Trello credentials missing: configure TrelloAPIKey and TrelloAPIToken before generating a trusted plan.";
  if (message.includes("BUILT_IN_FORGE_API_KEY")) return "AI planner unavailable: configure BUILT_IN_FORGE_API_KEY before generating APTLSS card plans or full daily plans.";
  if (message.includes("No APTLSS plans")) return "No APTLSS plans found: generate card plans first, then return here to build the daily schedule.";
  return message;
}

export function isPlannerAuthError(message?: string) {
  return Boolean(message && (message.includes("Please login") || message.includes("UNAUTHORIZED")));
}
