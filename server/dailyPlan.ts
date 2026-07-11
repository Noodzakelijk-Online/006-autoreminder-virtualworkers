import { invokeLLM } from "./_core/llm";
import { getActiveTimer, getDailyGoalHours, getDailyTimeSummary, getDb, getScheduleSettings } from "./db";
import { getAllAptlssPlans, getDailyPlanByDate, upsertDailyPlan } from "./aptlssDb";
import {
  getAllCardStates,
  getAllPriorityScores,
  getAllRobertDecisionSteps,
  getAllAptlssSteps,
  getOpenStepsForCard,
} from "./aptlssStepsDb";
import { getJoyceCards, getListCategory } from "./trello";
import { getLatestAssessments } from "./aptlssAssessmentDb";
import { getActiveWaitingReasons, toAptlssWaitingSignal } from "./aptlssWaitingReasonDb";

export type PlanBlockStatus = "planned" | "active" | "done" | "skipped";

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
  status: PlanBlockStatus;
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
    isWorkday: boolean;
    dayType: "workday" | "off_day";
    offDayReason?: string;
    breaks: Array<{ startTime: string; endTime: string; label: string }>;
  };
  audit: Array<{ at: string; action: string; detail: string }>;
};

type CardSummary = {
  cardId: string;
  cardName: string;
  cardUrl: string;
  boardName: string;
  listName: string;
  urgency: string;
  nextBestAction: string;
  estimatedMinutes: number;
  requiresRobert: boolean;
  isBlocked: boolean;
  confidenceScore: number;
  priorityScore: number;
  priorityTier: string;
  cardState: string;
  stepIds: number[];
  flags: string[];
};

type LiveTrelloPlanCard = {
  id: string;
  name: string;
  dateLastActivity?: string | null;
  due?: string | null;
  url?: string;
  list?: { name: string };
  boardName?: string;
};

const DEFAULT_CONSTRAINTS: DailyPlanPayload["constraints"] = {
  timezone: "EAT",
  workStart: "08:00",
  workEnd: "23:00",
  isWorkday: true,
  dayType: "workday",
  breaks: [
    { startTime: "09:00", endTime: "09:30", label: "Morning reset" },
    { startTime: "12:00", endTime: "13:00", label: "Lunch break" },
    { startTime: "17:30", endTime: "19:00", label: "Buffer / unplanned" },
  ],
};

const DAILY_PLAN_DB_UNAVAILABLE =
  "Database not available; daily plan persistence is disabled. Configure DATABASE_URL before generating or editing daily plans.";

async function assertDailyPlanDbAvailable() {
  const db = await getDb();
  if (!db) throw new Error(DAILY_PLAN_DB_UNAVAILABLE);
}

function minutesToTime(minutes: number) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

function timeToMinutes(time: string | null | undefined) {
  const match = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function eatDateKey(date = new Date()) {
  return new Date(date.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function durationMinutes(startTime: string, endTime: string) {
  return Math.max(0, (timeToMinutes(endTime) ?? 0) - (timeToMinutes(startTime) ?? 0));
}

function isSundayOffDay(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`).getUTCDay() === 0;
}

function constraintsForDate(dateKey: string): DailyPlanPayload["constraints"] {
  if (!isSundayOffDay(dateKey)) return DEFAULT_CONSTRAINTS;
  return {
    ...DEFAULT_CONSTRAINTS,
    isWorkday: false,
    dayType: "off_day",
    offDayReason: "Sunday is Joyce's protected day off.",
    breaks: [],
  };
}

async function loadConstraintsForDate(dateKey: string): Promise<DailyPlanPayload["constraints"]> {
  const base = constraintsForDate(dateKey);
  if (!base.isWorkday) return base;
  const schedule = await getScheduleSettings();
  return {
    ...base,
    workStart: schedule.startTime,
    workEnd: schedule.endTime,
    breaks: schedule.breaks.map((item) => {
      const start = timeToMinutes(item.startTime) ?? 0;
      return {
        startTime: item.startTime,
        endTime: minutesToTime(start + item.durationMinutes),
        label: item.name,
      };
    }),
  };
}

function currentEatMinutes(dateKey: string) {
  if (dateKey !== eatDateKey()) return null;
  const eatTime = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(11, 16);
  const minutes = timeToMinutes(eatTime);
  return minutes === null ? null : Math.ceil(minutes / 15) * 15;
}

function stableBlockId(seed: string, index: number) {
  return `${seed || "block"}-${index}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64);
}

function parseJsonObject(raw: string | null | undefined) {
  try {
    return JSON.parse(raw ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizePriority(priority: string | null | undefined) {
  const upper = (priority ?? "MEDIUM").toUpperCase();
  if (upper === "CRITICAL") return "High";
  if (upper === "HIGH") return "High";
  if (upper === "LOW") return "Low";
  if (upper === "ROBERT") return "Robert";
  if (upper === "BLOCKED") return "Blocked";
  return "Medium";
}

function flagsFor(summary: CardSummary) {
  const flags = [...summary.flags];
  if (summary.requiresRobert && !flags.includes("Robert")) flags.push("Robert");
  if (summary.isBlocked && !flags.includes("Blocked")) flags.push("Blocked");
  if (summary.cardState.includes("WAITING") && !flags.includes("Waiting")) flags.push("Waiting");
  return flags;
}

function makeBreakBlock(label: string, startTime: string, endTime: string, index: number): DailyPlanBlock {
  return {
    id: stableBlockId(label, index),
    startTime,
    endTime,
    cardId: null,
    cardName: label,
    cardUrl: null,
    boardName: "Routine",
    listName: "Protected time",
    action: label === "Buffer / unplanned" ? "Reserve space for overruns or urgent cards" : "Step away from desk",
    stepIds: [],
    priority: "Low",
    score: 0,
    state: "ROUTINE",
    status: "planned",
    notes: "Protected schedule block",
    flags: ["Protected"],
  };
}

function makeOffDayBlock(dateKey: string): DailyPlanBlock {
  return {
    id: stableBlockId(`${dateKey}-sunday-off`, 0),
    startTime: "08:00",
    endTime: "23:00",
    cardId: null,
    cardName: "Sunday Off",
    cardUrl: null,
    boardName: "Routine",
    listName: "Protected time",
    action: "No scheduled work. Preserve Joyce's weekly rest day and handle only true emergencies.",
    stepIds: [],
    priority: "Low",
    score: 0,
    state: "OFF_DAY",
    status: "planned",
    notes: "Sunday is protected time off; generate the next working plan on Monday.",
    flags: ["Off day", "Protected"],
  };
}

function isProtectedBreakBlock(block: Pick<DailyPlanBlock, "cardId" | "cardName"> & { flags?: string[] }) {
  const name = block.cardName.toLowerCase();
  return !block.cardId && (block.flags?.includes("Protected") || name.includes("lunch") || name.includes("buffer"));
}

function hasTimeOverlap(
  block: Pick<DailyPlanBlock, "startTime" | "endTime">,
  window: { start: number; end: number },
) {
  const start = timeToMinutes(block.startTime) ?? 0;
  const end = timeToMinutes(block.endTime) ?? 0;
  return start < window.end && end > window.start;
}

function protectedBreakBlocks(constraints: DailyPlanPayload["constraints"], minimumStart: number) {
  return constraints.breaks
    .map((item, index) => makeBreakBlock(item.label, item.startTime, item.endTime, 900 + index))
    .filter((block) => (timeToMinutes(block.endTime) ?? 0) > minimumStart);
}

function normalizeBlocks(
  rawBlocks: Array<Partial<DailyPlanBlock> & { time?: string; estimatedMinutes?: number }> | undefined,
  summaries: CardSummary[],
  dateKey: string,
  constraints = constraintsForDate(dateKey),
  maxWorkMinutes = Number.POSITIVE_INFINITY,
) {
  const summaryByCard = new Map(summaries.map((summary) => [summary.cardId, summary]));
  const configuredStart = timeToMinutes(constraints.workStart) ?? 8 * 60;
  const workStart = Math.max(configuredStart, currentEatMinutes(dateKey) ?? configuredStart);
  const workEnd = timeToMinutes(constraints.workEnd) ?? 23 * 60;
  let cursor = workStart;

  const source: Array<Partial<DailyPlanBlock> & { time?: string; estimatedMinutes?: number }> =
    rawBlocks && rawBlocks.length > 0
      ? rawBlocks
      : deterministicBlocks(summaries).map((block) => ({ ...block }));

  const blocks: DailyPlanBlock[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const item = source[index];
    const itemEnd = timeToMinutes(item.endTime);
    if (!item.cardId && item.state === "ROUTINE" && itemEnd !== null && itemEnd <= workStart) continue;
    const summary = item.cardId ? summaryByCard.get(item.cardId) : undefined;
    const requestedStart = timeToMinutes(item.startTime ?? item.time);
    const estimate = Math.max(15, Math.min(120, (item.estimatedMinutes ?? durationMinutes(item.startTime ?? "", item.endTime ?? "")) || summary?.estimatedMinutes || 45));
    const start = Math.max(workStart, Math.min(requestedStart ?? cursor, workEnd - 15));
    const end = Math.min(workEnd, Math.max(start + 15, start + estimate));
    cursor = end;

    const cardId = item.cardId ?? summary?.cardId ?? null;
    const seed = cardId ?? item.cardName ?? `block-${index}`;
    blocks.push({
      id: item.id ?? stableBlockId(seed, index),
      startTime: minutesToTime(start),
      endTime: minutesToTime(end),
      cardId,
      cardName: item.cardName ?? summary?.cardName ?? "Work block",
      cardUrl: item.cardUrl ?? summary?.cardUrl ?? (cardId ? `https://trello.com/c/${cardId}` : null),
      boardName: item.boardName ?? summary?.boardName ?? "Unknown board",
      listName: item.listName ?? summary?.listName ?? "Unknown list",
      action: item.action ?? summary?.nextBestAction ?? "Continue next available step",
      stepIds: item.stepIds ?? summary?.stepIds ?? [],
      priority: normalizePriority(item.priority ?? summary?.priorityTier),
      score: item.score ?? summary?.priorityScore ?? 0,
      state: item.state ?? summary?.cardState ?? "READY_TO_WORK",
      status: item.status ?? "planned",
      notes: item.notes ?? "",
      flags: item.flags ?? (summary ? flagsFor(summary) : []),
    });
  }

  const breaks = protectedBreakBlocks(constraints, workStart);
  const breakWindows = breaks.map((block) => ({
    start: timeToMinutes(block.startTime) ?? 0,
    end: timeToMinutes(block.endTime) ?? 0,
  }));
  const workBlocks = blocks
    .filter((block) => !isProtectedBreakBlock(block))
    .sort((a, b) => (timeToMinutes(a.startTime) ?? 0) - (timeToMinutes(b.startTime) ?? 0));

  let nextCursor = workStart;
  let scheduledCardMinutes = 0;
  const placedBlocks: DailyPlanBlock[] = [];
  for (const block of workBlocks) {
    const requestedStart = timeToMinutes(block.startTime) ?? nextCursor;
    const requestedLength = Math.max(15, durationMinutes(block.startTime, block.endTime) || 45);
    const remainingWorkMinutes = block.cardId ? Math.max(0, maxWorkMinutes - scheduledCardMinutes) : Number.POSITIVE_INFINITY;
    if (block.cardId && remainingWorkMinutes < 15) continue;
    const length = Math.min(requestedLength, remainingWorkMinutes);
    let start = Math.max(workStart, requestedStart, nextCursor);
    let placed: DailyPlanBlock | null = null;

    while (start < workEnd) {
      const containingBreak = breakWindows.find((window) => start >= window.start && start < window.end);
      if (containingBreak) {
        start = containingBreak.end;
        continue;
      }

      let end = Math.min(workEnd, start + length);
      const blockingBreak = breakWindows.find((window) => start < window.start && end > window.start);
      if (blockingBreak) {
        const availableBeforeBreak = blockingBreak.start - start;
        if (availableBeforeBreak >= 15) {
          end = blockingBreak.start;
        } else {
          start = blockingBreak.end;
          continue;
        }
      }

      if (end - start >= 15) {
        placed = { ...block, startTime: minutesToTime(start), endTime: minutesToTime(end) };
        nextCursor = end;
        if (block.cardId) scheduledCardMinutes += end - start;
      }
      break;
    }

    if (placed) placedBlocks.push(placed);
  }

  const withBreaks = [...breaks, ...placedBlocks]
    .filter((block, index, allBlocks) => (
      isProtectedBreakBlock(block) ||
      !breakWindows.some((window) => hasTimeOverlap(block, window)) ||
      allBlocks[index].cardId === null
    ))
    .sort((a, b) => (timeToMinutes(a.startTime) ?? 0) - (timeToMinutes(b.startTime) ?? 0));

  return withBreaks.map((block, index) => ({ ...block, id: block.id || stableBlockId(`${dateKey}-${block.cardName}`, index) }));
}

function deterministicBlocks(summaries: CardSummary[]) {
  let cursor = 8 * 60;
  const blocks: DailyPlanBlock[] = [
    {
      id: "morning-triage",
      startTime: "08:00",
      endTime: "09:00",
      cardId: null,
      cardName: "Morning Triage & Planning",
      cardUrl: null,
      boardName: "Routine",
      listName: "Daily operations",
      action: "Review overnight activity, new cards, inbox, and blockers",
      stepIds: [],
      priority: "Medium",
      score: 50,
      state: "ROUTINE",
      status: "planned",
      notes: "Start by choosing the first critical card and checking Robert blockers.",
      flags: ["Routine"],
    },
  ];
  cursor = 9 * 60 + 30;

  for (const summary of summaries.slice(0, 7)) {
    if (cursor >= 21 * 60) break;
    const estimate = Math.max(30, Math.min(120, summary.estimatedMinutes || 45));
    const start = cursor;
    const end = Math.min(21 * 60, start + estimate);
    blocks.push({
      id: stableBlockId(summary.cardId, blocks.length),
      startTime: minutesToTime(start),
      endTime: minutesToTime(end),
      cardId: summary.cardId,
      cardName: summary.cardName,
      cardUrl: summary.cardUrl,
      boardName: summary.boardName,
      listName: summary.listName,
      action: summary.nextBestAction || "Work the highest-priority open step",
      stepIds: summary.stepIds,
      priority: normalizePriority(summary.priorityTier),
      score: summary.priorityScore,
      state: summary.cardState,
      status: "planned",
      notes: summary.requiresRobert ? "Needs Robert input; use this block to prepare the exact decision request." : "",
      flags: flagsFor(summary),
    });
    cursor = end >= 12 * 60 && end < 13 * 60 ? 13 * 60 : end;
    if (cursor >= 17 * 60 + 30 && cursor < 19 * 60) cursor = 19 * 60;
  }

  blocks.push({
    id: "eod-handoff",
    startTime: "21:00",
    endTime: "22:00",
    cardId: null,
    cardName: "Robert Daily Update",
    cardUrl: null,
    boardName: "Routine",
    listName: "Daily operations",
    action: "Summarize completed work, blockers, decisions, and tomorrow's first step",
    stepIds: [],
    priority: "Robert",
    score: 60,
    state: "HANDOFF",
    status: "planned",
    notes: "Approval-gated draft only; do not post automatically.",
    flags: ["Robert"],
  });

  return blocks;
}

async function buildSummaries() {
  const [allPlans, allScores, allStates, robertSteps, allSteps, assessments, waitingRecords] = await Promise.all([
    getAllAptlssPlans(),
    getAllPriorityScores(),
    getAllCardStates(),
    getAllRobertDecisionSteps(),
    getAllAptlssSteps(),
    getLatestAssessments(),
    getActiveWaitingReasons(),
  ]);

  const scoreMap = new Map(allScores.map((score) => [score.cardId, score]));
  const stateMap = new Map(allStates.map((state) => [state.cardId, state]));
  const planMap = new Map(allPlans.map((plan) => [plan.cardId, plan]));
  const assessmentMap = new Map(assessments.map((assessment) => [assessment.cardId, assessment]));
  const waitingMap = new Map(waitingRecords.map((record) => [record.cardId, toAptlssWaitingSignal(record)]));
  const stepsByCard = new Map<string, typeof allSteps>();
  for (const step of allSteps) {
    stepsByCard.set(step.cardId, [...(stepsByCard.get(step.cardId) ?? []), step]);
  }
  const robertByCard = new Map<string, typeof robertSteps>();
  for (const step of robertSteps) {
    robertByCard.set(step.cardId, [...(robertByCard.get(step.cardId) ?? []), step]);
  }

  const summaries = await Promise.all(
    allPlans.slice(0, 30).map(async (planRow): Promise<CardSummary> => {
      const plan = parseJsonObject(planRow.planJson);
      const score = scoreMap.get(planRow.cardId);
      const state = stateMap.get(planRow.cardId);
      const assessment = assessmentMap.get(planRow.cardId);
      const waiting = waitingMap.get(planRow.cardId);
      const steps = stepsByCard.get(planRow.cardId) ?? await getOpenStepsForCard(planRow.cardId);
      const openSteps = steps.filter((step) => step.status === "open");
      const planSteps = (plan.steps as Array<{ estimatedMinutes?: number; requiresRobert?: boolean; title?: string }> | undefined) ?? [];
      const estimatedMinutes =
        assessment?.intelligenceValue.forecast?.calibratedP50Minutes ||
        openSteps.reduce((sum, step) => sum + (step.estimatedMinutes ?? 15), 0) ||
        planSteps.reduce((sum, step) => sum + (step.estimatedMinutes ?? 15), 0) ||
        score?.estimatedRemainingMinutes ||
        45;
      const requiresRobert = Boolean(waiting?.requiresRobert) || assessment?.actionability === "decision" || openSteps.some((step) => step.requiresRobert) || (robertByCard.get(planRow.cardId)?.length ?? 0) > 0;
      const waitingFollowUpDue = waiting?.followUpAt ? new Date(waiting.followUpAt).getTime() <= Date.now() : false;
      const waitingBlocksExecution = waiting?.waitingOn === "dependency"
        || waiting?.category === "dependency"
        || (waiting?.waitingOn === "external_party" && !waitingFollowUpDue);
      const waitingState = waiting?.waitingOn === "dependency" || waiting?.category === "dependency" ? "BLOCKED_BY_OTHER_CARD"
        : waiting?.waitingOn === "robert" ? "WAITING_FOR_ROBERT"
          : waiting?.waitingOn === "external_party" ? "WAITING_FOR_EXTERNAL_PARTY"
            : waiting ? "WAITING_FOR_JOYCE"
              : null;
      const isBlocked = waitingBlocksExecution || assessment?.actionability === "blocked" || !!plan.isBlocked || state?.state === "BLOCKED_BY_OTHER_CARD";
      return {
        cardId: planRow.cardId,
        cardName: planRow.cardName,
        cardUrl: planRow.cardUrl,
        boardName: planRow.boardName,
        listName: planRow.listName,
        urgency: (plan.urgencyLabel as string | undefined) ?? score?.tier ?? "MEDIUM",
        nextBestAction: waiting?.nextAction ?? (plan.nextBestAction as string | undefined) ?? (plan.action as string | undefined) ?? openSteps[0]?.title ?? "",
        estimatedMinutes,
        requiresRobert,
        isBlocked,
        confidenceScore: assessment?.confidenceScore ?? (plan.confidenceScore as number | undefined) ?? 70,
        priorityScore: assessment?.priorityScore ?? score?.score ?? 50,
        priorityTier: assessment?.priorityTier ?? score?.tier ?? "MEDIUM",
        cardState: waitingState ?? assessment?.primaryState ?? state?.state ?? "READY_TO_WORK",
        stepIds: openSteps.map((step) => step.id),
        flags: [
          ...(state?.isOverdue ? ["Overdue"] : []),
          ...(state?.hasUnansweredQuestion ? ["Question"] : []),
          ...(state?.daysSinceProgress && state.daysSinceProgress > 5 ? ["Stale"] : []),
          ...(assessment?.secondarySignalsValue.includes("portfolio_bottleneck") ? ["Bottleneck"] : []),
          ...(assessment?.secondarySignalsValue.includes("dependency_cycle") ? ["Dependency cycle"] : []),
          ...(assessment?.secondarySignalsValue.includes("reply_overdue") ? ["Reply overdue"] : []),
          ...(assessment?.secondarySignalsValue.includes("decision_stale") ? ["Decision stale"] : []),
          ...(assessment?.secondarySignalsValue.includes("estimate_overrun") ? ["Estimate overrun"] : []),
          ...(waiting ? ["Waiting reason"] : []),
          ...(waitingFollowUpDue ? ["Follow-up due"] : []),
        ],
      };
    }),
  );

  const cardsWithRobertSteps = new Set(robertSteps.map((step) => step.cardId));
  const waitingRobertItems = waitingRecords
    .filter((record) => record.requiresRobert && !cardsWithRobertSteps.has(record.cardId))
    .map((record) => ({
      cardId: record.cardId,
      cardName: record.cardName || planMap.get(record.cardId)?.cardName || record.cardId,
      decision: record.requestedItem ?? record.interpretationValue.summary,
    }));

  return {
    summaries: summaries.sort((a, b) => b.priorityScore - a.priorityScore),
    robertItems: [
      ...robertSteps.map((step) => ({
        stepId: step.id,
        cardId: step.cardId,
        cardName: planMap.get(step.cardId)?.cardName ?? step.cardId,
        decision: step.recommendedDecision ?? step.title,
        due: "Today",
      })),
      ...waitingRobertItems,
    ],
  };
}

function daysSince(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
}

function dueStatus(due: string | null | undefined) {
  if (!due) return { overdue: false, dueToday: false };
  const date = new Date(due);
  if (Number.isNaN(date.getTime())) return { overdue: false, dueToday: false };
  const eatToday = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dueKey = new Date(date.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    overdue: dueKey < eatToday,
    dueToday: dueKey === eatToday,
  };
}

function nextActionForLiveCard(cardName: string, listCategory: ReturnType<typeof getListCategory>, overdue: boolean, dueToday: boolean) {
  if (listCategory === "doing") return "Post today's Trello update, then move the next concrete step forward.";
  if (listCategory === "on-hold") return "Review the blocker, decide whether it can resume, and record the follow-up.";
  if (overdue) return "Triage the overdue commitment, set the next action, and update the card.";
  if (dueToday) return "Complete or renegotiate today's due item before the EOD update.";
  return `Define and execute the next concrete action for "${cardName}".`;
}

export function summarizeLiveTrelloCards(cards: LiveTrelloPlanCard[]): CardSummary[] {
  return cards
    .map((card): CardSummary => {
      const listName = card.list?.name ?? "Unknown";
      const listCategory = getListCategory(listName);
      const due = dueStatus(card.due);
      const staleDays = daysSince(card.dateLastActivity);
      const priorityScore =
        (due.overdue ? 95 : due.dueToday ? 90 : listCategory === "doing" ? 85 : listCategory === "on-hold" ? 70 : listCategory === "todo" ? 62 : 45) +
        (staleDays && staleDays > 14 ? 5 : 0);
      const priorityTier = priorityScore >= 90 ? "HIGH" : priorityScore >= 70 ? "MEDIUM" : "LOW";
      const flags = [
        ...(due.overdue ? ["Overdue"] : []),
        ...(due.dueToday ? ["Due today"] : []),
        ...(staleDays && staleDays > 7 ? ["Stale"] : []),
        ...(listCategory === "on-hold" ? ["Blocked"] : []),
      ];

      return {
        cardId: card.id,
        cardName: card.name,
        cardUrl: card.url ?? `https://trello.com/c/${card.id}`,
        boardName: card.boardName ?? "Trello",
        listName,
        urgency: priorityTier,
        nextBestAction: nextActionForLiveCard(card.name, listCategory, due.overdue, due.dueToday),
        estimatedMinutes: listCategory === "doing" ? 75 : listCategory === "on-hold" ? 30 : due.overdue || due.dueToday ? 60 : 45,
        requiresRobert: false,
        isBlocked: listCategory === "on-hold",
        confidenceScore: 62,
        priorityScore,
        priorityTier,
        cardState: listCategory === "doing" ? "IN_PROGRESS" : listCategory === "on-hold" ? "WAITING_FOR_DEPENDENCY" : "READY_TO_WORK",
        stepIds: [],
        flags,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 30);
}

async function buildLiveTrelloSummaries() {
  const apiKey = process.env.TrelloAPIKey;
  const apiToken = process.env.TrelloAPIToken;
  if (!apiKey || !apiToken) return [];
  const cards = await getJoyceCards(apiKey, apiToken);
  return summarizeLiveTrelloCards(cards);
}

async function callPlannerLLM(dateKey: string, summaries: CardSummary[]) {
  const summaryText = summaries
    .slice(0, 20)
    .map(
      (card, index) =>
        `${index + 1}. [${card.priorityTier}] ${card.cardName} (${card.boardName} > ${card.listName})\n` +
        `Next: ${card.nextBestAction}\nEst: ${card.estimatedMinutes}m | Score: ${card.priorityScore} | State: ${card.cardState}` +
        `${card.requiresRobert ? " | NEEDS ROBERT" : ""}${card.isBlocked ? " | BLOCKED" : ""}`,
    )
    .join("\n\n");

  const response = await invokeLLM({
    messages: [
      {
        role: "system" as const,
        content:
          "You create approval-gated daily operator plans for Joyce, a virtual assistant working Trello cards for Robert. " +
          "Return a realistic time-blocked schedule for 08:00-23:00 EAT. Respect lunch 12:00-13:00 and buffer 17:30-19:00. " +
          "Prioritize CRITICAL/HIGH, Robert decisions, overdue cards, then ready work. Keep blocks 30-120 minutes. Return only JSON.",
      },
      {
        role: "user" as const,
        content: `Date: ${dateKey}\nActive work:\n\n${summaryText}\n\nCreate the operator cockpit daily plan.`,
      },
    ],
    response_format: {
      type: "json_schema" as const,
      json_schema: {
        name: "operator_daily_plan",
        strict: true,
        schema: {
          type: "object",
          properties: {
            blocks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  startTime: { type: "string" },
                  endTime: { type: "string" },
                  cardId: { type: ["string", "null"] },
                  cardName: { type: "string" },
                  action: { type: "string" },
                  priority: { type: "string" },
                  notes: { type: "string" },
                },
                required: ["startTime", "endTime", "cardId", "cardName", "action", "priority", "notes"],
                additionalProperties: false,
              },
            },
            dailySummary: { type: "string" },
            topPriority: { type: "string" },
            unscheduledCards: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  cardId: { type: "string" },
                  cardName: { type: "string" },
                  reason: { type: "string" },
                  priority: { type: "string" },
                },
                required: ["cardId", "cardName", "reason", "priority"],
                additionalProperties: false,
              },
            },
          },
          required: ["blocks", "dailySummary", "topPriority", "unscheduledCards"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No schedule generated");
  return JSON.parse(typeof content === "string" ? content : JSON.stringify(content)) as {
    blocks: Array<Partial<DailyPlanBlock> & { time?: string; estimatedMinutes?: number }>;
    dailySummary: string;
    topPriority: string;
    unscheduledCards: Array<{ cardId: string; cardName: string; reason: string; priority?: string }>;
  };
}

export function parseDailyPlanPayload(raw: string | null | undefined, dateKey?: string): DailyPlanPayload | null {
  const parsed = parseJsonObject(raw);
  if (!parsed || Object.keys(parsed).length === 0) return null;
  const resolvedDateKey = dateKey ?? (parsed.dateKey as string | undefined) ?? eatDateKey();
  if (parsed.version === 1 && Array.isArray(parsed.blocks)) {
    const payload = parsed as DailyPlanPayload;
    return isSundayOffDay(resolvedDateKey) && payload.constraints?.dayType !== "off_day"
      ? buildOffDayPayload({
          dateKey: resolvedDateKey,
          generatedBy: "edited",
          sourceBlocks: payload.blocks,
          robertItems: payload.robertItems ?? [],
          audit: [
            ...(payload.audit ?? []),
            { at: new Date().toISOString(), action: "normalized_off_day", detail: "Existing Sunday work plan was converted to an off-day plan." },
          ],
        })
      : {
          ...payload,
          planHealth: {
            ...payload.planHealth,
            source: payload.planHealth?.source ?? "legacy",
            warnings: payload.planHealth?.warnings ?? ["This saved plan predates planner source-quality checks. Regenerate it before relying on the confidence score."],
          },
          constraints: {
            ...constraintsForDate(resolvedDateKey),
            ...(payload.constraints ?? {}),
          },
        };
  }

  const legacySchedule = parsed.schedule as Array<Partial<DailyPlanBlock> & { time?: string; estimatedMinutes?: number }> | undefined;
  if (!legacySchedule) return null;
  if (isSundayOffDay(resolvedDateKey)) {
    return buildOffDayPayload({
      dateKey: resolvedDateKey,
      generatedBy: "auto",
      sourceBlocks: legacySchedule,
      robertItems: (parsed.robertItems as DailyPlanPayload["robertItems"] | undefined) ?? [],
      audit: [{ at: new Date().toISOString(), action: "loaded_legacy_off_day_plan", detail: "Converted legacy Sunday plan to protected off-day payload." }],
    });
  }
  const blocks = normalizeBlocks(legacySchedule, [], resolvedDateKey);
  return buildPayload({
    dateKey: resolvedDateKey,
    blocks,
    generatedBy: "auto",
    dailySummary: (parsed.dailySummary as string | undefined) ?? "Daily plan generated.",
    topPriority: (parsed.topPriority as string | undefined) ?? blocks.find((block) => block.cardId)?.cardName ?? "Plan the day",
    robertItems: (parsed.robertItems as DailyPlanPayload["robertItems"] | undefined) ?? [],
    unscheduledCards: (parsed.unscheduledCards as DailyPlanPayload["unscheduledCards"] | undefined) ?? [],
    audit: [{ at: new Date().toISOString(), action: "loaded_legacy_plan", detail: "Converted legacy daily plan payload." }],
  });
}

function buildOffDayPayload({
  dateKey,
  generatedBy,
  sourceBlocks = [],
  summaries = [],
  robertItems = [],
  audit,
}: {
  dateKey: string;
  generatedBy: DailyPlanPayload["generatedBy"];
  sourceBlocks?: Array<Partial<DailyPlanBlock> & { estimatedMinutes?: number }>;
  summaries?: CardSummary[];
  robertItems?: DailyPlanPayload["robertItems"];
  audit: DailyPlanPayload["audit"];
}): DailyPlanPayload {
  const unscheduledById = new Map<string, { cardId: string; cardName: string; reason: string; priority?: string }>();
  for (const summary of summaries) {
    unscheduledById.set(summary.cardId, {
      cardId: summary.cardId,
      cardName: summary.cardName,
      reason: "Sunday is Joyce's protected day off; schedule this on the next working day unless it is an emergency.",
      priority: normalizePriority(summary.priorityTier),
    });
  }
  for (const block of sourceBlocks) {
    if (!block.cardId) continue;
    unscheduledById.set(block.cardId, {
      cardId: block.cardId,
      cardName: block.cardName ?? block.cardId,
      reason: "Removed from Sunday schedule because Sunday is Joyce's protected day off.",
      priority: normalizePriority(block.priority),
    });
  }
  const blocks = [makeOffDayBlock(dateKey)];
  return {
    version: 1,
    dateKey,
    generatedAt: new Date().toISOString(),
    generatedBy,
    blocks,
    totalScheduledMinutes: 0,
    dailySummary: "Sunday is Joyce's protected day off. No routine work is scheduled; use only for true emergencies.",
    topPriority: "Rest day",
    robertItems,
    unscheduledCards: Array.from(unscheduledById.values()).slice(0, 12),
    planHealth: {
      workloadMinutes: 0,
      focusMinutes: 0,
      bufferMinutes: 0,
      overlaps: 0,
      gaps: 0,
      confidence: 95,
      status: "good",
      source: "off_day",
      warnings: [],
    },
    constraints: constraintsForDate(dateKey),
    audit,
  };
}

export function toLegacyDailySchedule(payload: DailyPlanPayload) {
  return {
    schedule: payload.blocks.map((block) => ({
      time: block.startTime,
      cardId: block.cardId,
      cardName: block.cardName,
      action: block.action,
      estimatedMinutes: durationMinutes(block.startTime, block.endTime),
      priority: block.priority,
      notes: block.notes,
    })),
    totalScheduledMinutes: payload.totalScheduledMinutes,
    unscheduledCards: payload.unscheduledCards.map((card) => ({
      cardId: card.cardId,
      cardName: card.cardName,
      reason: card.reason,
    })),
    dailySummary: payload.dailySummary,
    topPriority: payload.topPriority,
    robertItems: payload.robertItems.map((item) => ({
      cardId: item.cardId,
      cardName: item.cardName,
      decision: item.decision,
    })),
  };
}

function buildPayload({
  dateKey,
  blocks,
  generatedBy,
  dailySummary,
  topPriority,
  robertItems,
  unscheduledCards,
  audit,
  constraints,
  source = "aptlss",
  warnings = [],
  confidenceCap = 95,
}: {
  dateKey: string;
  blocks: DailyPlanBlock[];
  generatedBy: DailyPlanPayload["generatedBy"];
  dailySummary: string;
  topPriority: string;
  robertItems: DailyPlanPayload["robertItems"];
  unscheduledCards: DailyPlanPayload["unscheduledCards"];
  audit: DailyPlanPayload["audit"];
  constraints?: DailyPlanPayload["constraints"];
  source?: NonNullable<DailyPlanPayload["planHealth"]["source"]>;
  warnings?: string[];
  confidenceCap?: number;
}): DailyPlanPayload {
  const overlaps = blocks.reduce((count, block, index) => {
    if (index === 0) return count;
    const prev = blocks[index - 1];
    return (timeToMinutes(block.startTime) ?? 0) < (timeToMinutes(prev.endTime) ?? 0) ? count + 1 : count;
  }, 0);
  const workloadMinutes = blocks.filter((block) => block.cardId).reduce((sum, block) => sum + durationMinutes(block.startTime, block.endTime), 0);
  const bufferMinutes = blocks.filter((block) => block.cardName.toLowerCase().includes("buffer")).reduce((sum, block) => sum + durationMinutes(block.startTime, block.endTime), 0);
  const confidence = Math.max(25, Math.min(confidenceCap, 90 - overlaps * 15 - unscheduledCards.length * 2 - warnings.length * 5));
  return {
    version: 1,
    dateKey,
    generatedAt: new Date().toISOString(),
    generatedBy,
    blocks,
    totalScheduledMinutes: workloadMinutes + bufferMinutes,
    dailySummary,
    topPriority,
    robertItems,
    unscheduledCards,
    planHealth: {
      workloadMinutes,
      focusMinutes: workloadMinutes,
      bufferMinutes,
      overlaps,
      gaps: 0,
      confidence,
      status: overlaps > 0 || robertItems.length > 3 || warnings.length > 0 ? "warning" : "good",
      source,
      warnings,
    },
    constraints: constraints ?? constraintsForDate(dateKey),
    audit,
  };
}

export async function getSavedDailyPlan(dateKey = eatDateKey()) {
  await assertDailyPlanDbAvailable();
  const row = await getDailyPlanByDate(dateKey);
  if (!row) return null;
  return parseDailyPlanPayload(row.scheduleJson, row.dateKey);
}

export async function saveDailyPlan(payload: DailyPlanPayload, autoGenerated = false) {
  await assertDailyPlanDbAvailable();
  await upsertDailyPlan({
    dateKey: payload.dateKey,
    scheduleJson: JSON.stringify(payload),
    dailySummary: payload.dailySummary,
    topPriority: payload.topPriority,
    totalScheduledMinutes: payload.totalScheduledMinutes,
    robertItemsCount: payload.robertItems.length,
    autoGenerated,
    generatedAt: new Date(payload.generatedAt),
  });
}

export async function generateDailyPlan(dateKey = eatDateKey(), generatedBy: DailyPlanPayload["generatedBy"] = "manual") {
  await assertDailyPlanDbAvailable();
  if (isSundayOffDay(dateKey)) {
    const payload = buildOffDayPayload({
      dateKey,
      generatedBy,
      audit: [{
        at: new Date().toISOString(),
        action: "generated_off_day",
        detail: "Sunday plan generated as a protected off-day schedule.",
      }],
    });
    await saveDailyPlan(payload, generatedBy === "auto");
    return payload;
  }

  let { summaries, robertItems } = await buildSummaries();
  let usedLiveTrelloFallback = false;
  if (summaries.length === 0) {
    summaries = await buildLiveTrelloSummaries();
    robertItems = [];
    usedLiveTrelloFallback = summaries.length > 0;
  }
  if (summaries.length === 0) {
    throw new Error("No APTLSS plans or live Trello cards found. Check Trello access, then generate card plans for richer daily planning.");
  }

  const constraints = await loadConstraintsForDate(dateKey);
  const [dailyGoalHours, trackedEntries] = await Promise.all([
    getDailyGoalHours(),
    getDailyTimeSummary(dateKey),
  ]);
  const trackedMinutes = Math.floor(trackedEntries.reduce((sum, entry) => sum + entry.totalSeconds, 0) / 60);
  const remainingGoalMinutes = Math.max(0, Math.round(dailyGoalHours * 60) - trackedMinutes);

  let llmPlan: Awaited<ReturnType<typeof callPlannerLLM>> | null = null;
  try {
    llmPlan = await callPlannerLLM(dateKey, summaries);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("BUILT_IN_FORGE_API_KEY")) {
      console.info("[DailyPlan] AI planner key missing; using deterministic fallback.");
    } else {
      console.error("[DailyPlan] LLM plan failed; using deterministic fallback:", error);
    }
  }

  const blocks = normalizeBlocks(llmPlan?.blocks, summaries, dateKey, constraints, remainingGoalMinutes);
  const scheduledCardIds = new Set(blocks.map((block) => block.cardId).filter(Boolean));
  const unscheduledCards =
    llmPlan?.unscheduledCards?.length
      ? llmPlan.unscheduledCards
      : summaries
          .filter((summary) => !scheduledCardIds.has(summary.cardId))
          .slice(0, 8)
          .map((summary) => ({
            cardId: summary.cardId,
            cardName: summary.cardName,
            reason: summary.isBlocked ? "Blocked or waiting" : "Lower priority than today can safely hold",
            priority: normalizePriority(summary.priorityTier),
          }));

  const warnings = [
    ...(usedLiveTrelloFallback ? ["APTLSS card plans are unavailable; this schedule uses live Trello fallback ordering."] : []),
    ...(!process.env.BUILT_IN_FORGE_API_KEY ? ["AI planning is unavailable; deterministic scheduling was used."] : []),
    ...(remainingGoalMinutes === 0 ? ["The configured daily time goal has already been reached."] : []),
  ];
  const payload = buildPayload({
    dateKey,
    blocks,
    generatedBy,
    dailySummary: llmPlan?.dailySummary ?? (usedLiveTrelloFallback
      ? "Daily plan generated from live Trello cards because no APTLSS card plans were available yet."
      : "Daily plan generated from current APTLSS scores, card states, timers, and Robert blockers."),
    topPriority: llmPlan?.topPriority ?? summaries[0]?.cardName ?? "Plan the day",
    robertItems,
    unscheduledCards,
    audit: [{
      at: new Date().toISOString(),
      action: "generated",
      detail: usedLiveTrelloFallback
        ? "Daily plan generated from live Trello fallback because no APTLSS plans were available."
        : generatedBy === "replan" ? "Remaining day replanned." : "Daily plan generated.",
    }],
    constraints,
    source: usedLiveTrelloFallback ? "trello_fallback" : "aptlss",
    warnings,
    confidenceCap: usedLiveTrelloFallback ? 55 : !process.env.BUILT_IN_FORGE_API_KEY ? 70 : 95,
  });
  await saveDailyPlan(payload, generatedBy === "auto");
  return payload;
}

export async function updateDailyPlan(dateKey: string, payload: DailyPlanPayload) {
  if (isSundayOffDay(dateKey)) {
    const offDay = buildOffDayPayload({
      dateKey,
      generatedBy: "edited",
      sourceBlocks: payload.blocks,
      robertItems: payload.robertItems ?? [],
      audit: [
        ...(payload.audit ?? []),
        { at: new Date().toISOString(), action: "protected_off_day", detail: "Sunday edits were kept as an off-day plan." },
      ].slice(-20),
    });
    await saveDailyPlan(offDay, false);
    return offDay;
  }

  const normalized = buildPayload({
    dateKey,
    blocks: payload.blocks,
    generatedBy: "edited",
    dailySummary: payload.dailySummary,
    topPriority: payload.topPriority,
    robertItems: payload.robertItems ?? [],
    unscheduledCards: payload.unscheduledCards ?? [],
    audit: [
      ...(payload.audit ?? []),
      { at: new Date().toISOString(), action: "updated", detail: "Plan edited from cockpit." },
    ].slice(-20),
    constraints: payload.constraints,
    source: payload.planHealth?.source ?? "legacy",
    warnings: payload.planHealth?.warnings ?? [],
    confidenceCap: payload.planHealth?.source === "trello_fallback" ? 55 : 95,
  });
  await saveDailyPlan(normalized, false);
  return normalized;
}

export async function replanRemainingDay(dateKey: string, completedBlockIds: string[], activeBlockId?: string | null) {
  if (isSundayOffDay(dateKey)) return generateDailyPlan(dateKey, "replan");

  const current = await getSavedDailyPlan(dateKey);
  if (!current) return generateDailyPlan(dateKey, "replan");

  const completed = new Set(completedBlockIds);
  const preserved = current.blocks.filter((block) => completed.has(block.id) || block.id === activeBlockId);
  const future = current.blocks
    .filter((block) => !completed.has(block.id) && block.id !== activeBlockId)
    .map((block) => ({ ...block, status: "planned" as const }));
  const cursor = Math.max(
    timeToMinutes(new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(11, 16)) ?? 8 * 60,
    ...preserved.map((block) => timeToMinutes(block.endTime) ?? 8 * 60),
  );
  let next = Math.min(cursor, 21 * 60);
  const shifted = future.map((block) => {
    const length = Math.max(15, durationMinutes(block.startTime, block.endTime));
    const startTime = minutesToTime(next);
    next = Math.min(23 * 60, next + length);
    return { ...block, startTime, endTime: minutesToTime(next) };
  });

  return updateDailyPlan(dateKey, {
    ...current,
    generatedBy: "replan",
    blocks: [...preserved, ...shifted].sort((a, b) => (timeToMinutes(a.startTime) ?? 0) - (timeToMinutes(b.startTime) ?? 0)),
    audit: [
      ...current.audit,
      { at: new Date().toISOString(), action: "replanned_remaining_day", detail: "Completed and active blocks preserved." },
    ],
  });
}

export async function draftDailyHandoff(dateKey = eatDateKey()) {
  const plan = await getSavedDailyPlan(dateKey);
  if (!plan) throw new Error("No daily plan found for handoff.");
  const [activeTimer, timeSummary] = await Promise.all([getActiveTimer(), getDailyTimeSummary(dateKey)]);
  const done = plan.blocks.filter((block) => block.status === "done");
  const skipped = plan.blocks.filter((block) => block.status === "skipped");
  const planned = plan.blocks.filter((block) => block.status === "planned" && block.cardId);
  const lines = [
    `Daily update for ${dateKey}`,
    "",
    `Completed: ${done.length ? done.map((block) => block.cardName).join(", ") : "No blocks marked done yet."}`,
    `Still planned: ${planned.length ? planned.slice(0, 6).map((block) => block.cardName).join(", ") : "No remaining planned card blocks."}`,
    skipped.length ? `Skipped: ${skipped.map((block) => block.cardName).join(", ")}` : null,
    plan.robertItems.length ? `Robert decisions needed: ${plan.robertItems.map((item) => item.cardName).join(", ")}` : null,
    plan.unscheduledCards.length ? `Not scheduled today: ${plan.unscheduledCards.slice(0, 5).map((card) => card.cardName).join(", ")}` : null,
    activeTimer ? `Timer currently running: ${activeTimer.cardName}` : null,
    `Tracked today: ${timeSummary.reduce((sum, item) => sum + item.totalSeconds, 0)} seconds.`,
  ].filter(Boolean);

  return {
    dateKey,
    draft: lines.join("\n"),
    checklist: [
      { id: "send_daily_update", label: "Send daily update to Robert", done: false },
      { id: "post_key_updates", label: "Post key updates on Trello cards", done: false },
      { id: "log_time", label: "Log time and close timers", done: false },
      { id: "prepare_tomorrow", label: "Prepare tomorrow's plan", done: false },
    ],
  };
}

export function getEatDateKey(date?: Date) {
  return eatDateKey(date);
}
