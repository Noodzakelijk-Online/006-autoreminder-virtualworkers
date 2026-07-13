import { createHash } from "crypto";
import type { CardStateValue, PriorityTier, TrelloCardContext } from "./aptlssEngine";
import type { AptlssPortfolioSignal } from "./aptlssPortfolio";
import type { AptlssForecast, AptlssRuntimeSignal } from "./aptlssRuntime";
import type { AptlssWaitingSignal } from "./aptlssWaitingReason";
import type { AptlssExternalEvidenceSignal } from "./workspaceEvidence";

export const APTLSS_ASSESSMENT_VERSION = "4.3.0";
export const APTLSS_NEAR_CERTAINTY_TARGET = 99;

export type AssessmentTrigger = "generation" | "webhook" | "scheduled" | "manual" | "timer";

export type AssessmentStep = {
  status: string;
  category: string;
  requiresRobert: boolean;
  blockedBy?: string | null;
  dependsOnCards?: string | null;
  estimatedMinutes?: number | null;
  completionCriteria?: string | null;
  riskIfSkipped?: string | null;
};

export type AssessmentEvidence = {
  key: string;
  source: "trello" | "aptlss" | "derived" | "runtime" | "portfolio" | "schedule" | "workspace";
  value: string | number | boolean | null;
  quality: "strong" | "moderate" | "weak";
  detail: string;
  observedAt?: string;
};

export type AssessmentCalibrationContext = {
  sampleSize: number;
  accuracyScore: number | null;
  byState: Record<string, { samples: number; accuracyScore: number; commonCorrection?: string | null }>;
};

export type AptlssAssessmentPolicy = {
  stallThresholdDays: number;
  confidenceFlagThreshold: number;
};

export type AppliedAssessmentCalibration = {
  applied: boolean;
  scope: "state" | "global" | "none";
  sampleSize: number;
  validatedAccuracy: number | null;
  confidenceBeforeCalibration: number;
  confidenceAfterCalibration: number;
};

export type AptlssConfidenceProfile = {
  targetScore: number;
  ceiling: number;
  gapToTarget: number;
  eligibleForNearCertainty: boolean;
  dimensions: {
    evidence: number;
    forecast: number;
    humanValidation: number;
    consistency: number;
  };
  blockers: string[];
};

export type AptlssAssessment = {
  engineVersion: string;
  cardId: string;
  contextHash: string;
  primaryState: CardStateValue;
  stateReason: string;
  secondarySignals: string[];
  actionability: "actionable" | "decision" | "waiting" | "blocked" | "complete" | "repair";
  priorityScore: number;
  priorityTier: PriorityTier;
  priorityBreakdown: Record<string, number>;
  confidenceScore: number;
  confidenceBand: "high" | "medium" | "low";
  confidenceReason: string;
  confidenceProfile: AptlssConfidenceProfile;
  evidenceCoverage: Record<string, boolean>;
  evidence: AssessmentEvidence[];
  uncertainties: string[];
  recommendations: string[];
  waiting: AptlssWaitingSignal | null;
  externalEvidence: AptlssExternalEvidenceSignal;
  portfolio: AptlssPortfolioSignal;
  runtime: AptlssRuntimeSignal;
  forecast: AptlssForecast;
  calibration: AppliedAssessmentCalibration;
  lastMeaningfulProgressAt: string | null;
  daysSinceMeaningfulProgress: number;
  nextAssessmentAt: string;
  assessedAt: string;
  trigger: AssessmentTrigger;
};

export type AssessmentRefreshCandidate = {
  cardId?: string;
  cardName?: string;
  dateLastActivity?: string | null;
};

export type PreviousAssessmentSchedule = {
  nextAssessmentAt: Date | string;
  lastEvaluatedAt: Date | string;
};

function scheduleTimestamp(value: Date | string | null | undefined) {
  if (!value) return Number.NaN;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * Webhooks refresh changed cards immediately. Scheduled maintenance therefore
 * only needs to revisit cards that are new, changed, or due for re-evaluation.
 */
export function assessmentNeedsRefresh(
  candidate: AssessmentRefreshCandidate,
  previous: PreviousAssessmentSchedule | null | undefined,
  options: { force?: boolean; nowMs?: number } = {},
) {
  if (options.force || !previous) return true;
  const nowMs = options.nowMs ?? Date.now();
  const nextAssessmentMs = scheduleTimestamp(previous.nextAssessmentAt);
  if (!Number.isFinite(nextAssessmentMs) || nextAssessmentMs <= nowMs) return true;

  const activityMs = scheduleTimestamp(candidate.dateLastActivity);
  if (!Number.isFinite(activityMs)) return false;
  const lastEvaluatedMs = scheduleTimestamp(previous.lastEvaluatedAt);
  return !Number.isFinite(lastEvaluatedMs) || activityMs > lastEvaluatedMs;
}

const EMPTY_PORTFOLIO: AptlssPortfolioSignal = {
  directDependentCount: 0,
  transitiveDependentCount: 0,
  unresolvedDependencyIds: [],
  unresolvedDependencyNames: [],
  orphanReferences: [],
  criticalPathDepth: 0,
  isInDependencyCycle: false,
  cycleCardIds: [],
  bottleneckScore: 0,
};

const EMPTY_RUNTIME: AptlssRuntimeSignal = {
  trackedMinutes: 0,
  recentTrackedMinutes: 0,
  sessionCount: 0,
  activeTimer: false,
  activeTimerMinutes: 0,
  replyStatus: null,
  replyAgeHours: null,
  replyOverdue: false,
  openDecisionAgeHours: null,
  decisionStale: false,
  scheduledToday: false,
  scheduledMinutes: 0,
  scheduleStatus: null,
  estimateOverrun: false,
};

const DAY_MS = 86_400_000;
const JOYCE_PATTERN = /\b(joyce|angel|assistant)\b/i;
const ROBERT_PATTERN = /\brobert\b/i;

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function parseDateMs(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

function safeJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

export function buildAssessmentContextHash(
  ctx: TrelloCardContext,
  steps: AssessmentStep[],
  waiting: AptlssWaitingSignal | null = null,
  externalEvidence?: AptlssExternalEvidenceSignal,
) {
  const normalized = {
    id: ctx.id,
    name: ctx.name.trim(),
    desc: ctx.desc.trim(),
    start: ctx.start ?? null,
    due: ctx.due,
    dueComplete: ctx.dueComplete,
    labels: ctx.labels.map((label) => label.name || label.color).sort(),
    listName: ctx.listName,
    boardName: ctx.boardName,
    members: (ctx.members ?? []).map((member) => member.username || member.fullName).sort(),
    customFields: (ctx.customFields ?? []).map((field) => [field.id, field.name, field.value]).sort(),
    checklists: ctx.checklists.map((checklist) => ({
      name: checklist.name,
      items: checklist.checkItems.map((item) => [item.id, item.name, item.state]),
    })),
    comments: ctx.comments.slice(0, 20).map((comment) => [comment.date, comment.memberName, comment.text]),
    activity: (ctx.activity ?? []).slice(0, 40).map((event) => [event.type, event.date, event.memberName, event.detail]),
    steps: steps.map((step) => [step.status, step.category, step.requiresRobert, step.blockedBy, step.dependsOnCards, step.estimatedMinutes, step.completionCriteria, step.riskIfSkipped]),
    waiting: waiting ? [waiting.reasonId, waiting.rawReason, waiting.category, waiting.waitingOn, waiting.waitingOnName, waiting.requestedItem, waiting.nextAction, waiting.followUpAt, waiting.urgency, waiting.confidenceScore] : null,
    externalEvidence: externalEvidence?.items.map((item) => [
      item.source,
      item.sourceId,
      item.modifiedAt,
      item.relevanceScore,
      item.title,
      item.summary,
      item.contentSnippet,
    ]) ?? [],
  };
  return createHash("sha256").update(safeJson(normalized)).digest("hex");
}

function checklistProgress(ctx: TrelloCardContext) {
  const aptlss = ctx.checklists.find((checklist) => checklist.name.toLowerCase().includes("aptlss"));
  const items = aptlss?.checkItems ?? [];
  const completed = items.filter((item) => item.state === "complete").length;
  return { total: items.length, completed, ratio: items.length ? completed / items.length : 0 };
}

function riskSeverity(text: string | null | undefined) {
  if (!text) return 0;
  const value = text.toLowerCase();
  if (/legal|contract|payment|financial|client loss|security|privacy|compliance/.test(value)) return 15;
  if (/deadline|blocked|escalat|urgent|reputation|rework/.test(value)) return 10;
  if (/delay|miss|slow|confusion/.test(value)) return 6;
  return 3;
}

function labelUrgency(labels: TrelloCardContext["labels"]) {
  let score = 0;
  for (const label of labels) {
    const value = `${label.name} ${label.color}`.toLowerCase();
    if (/critical|urgent|asap|red/.test(value)) score = Math.max(score, 20);
    else if (/high|important|orange/.test(value)) score = Math.max(score, 14);
    else if (/medium|yellow/.test(value)) score = Math.max(score, 7);
    if (/legal|financial|payment|invoice|client/.test(value)) score = Math.min(20, score + 6);
  }
  return score;
}

function customFieldUrgency(fields: TrelloCardContext["customFields"] = []) {
  const combined = fields.map((field) => `${field.name} ${field.value}`).join(" ").toLowerCase();
  if (/critical|urgent|p0|severity 1|priority 1/.test(combined)) return 16;
  if (/high|p1|severity 2|priority 2/.test(combined)) return 10;
  if (/medium|p2/.test(combined)) return 5;
  if (/low|p3/.test(combined)) return -3;
  return 0;
}

function duePressure(due: string | null, nowMs: number) {
  const dueMs = parseDateMs(due);
  if (dueMs == null) return { pressure: 0, overdue: false, daysUntilDue: null as number | null };
  const daysUntilDue = (dueMs - nowMs) / DAY_MS;
  if (daysUntilDue < 0) return { pressure: 30, overdue: true, daysUntilDue };
  if (daysUntilDue <= 1) return { pressure: 25, overdue: false, daysUntilDue };
  if (daysUntilDue <= 3) return { pressure: 18, overdue: false, daysUntilDue };
  if (daysUntilDue <= 7) return { pressure: 11, overdue: false, daysUntilDue };
  if (daysUntilDue <= 14) return { pressure: 5, overdue: false, daysUntilDue };
  return { pressure: 1, overdue: false, daysUntilDue };
}

function latestQuestionSignal(ctx: TrelloCardContext) {
  const latest = [...ctx.comments]
    .filter((comment) => comment.text.includes("?"))
    .sort((a, b) => (parseDateMs(b.date) ?? 0) - (parseDateMs(a.date) ?? 0))[0];
  if (!latest) return null;
  const newerReplyExists = ctx.comments.some((comment) => (parseDateMs(comment.date) ?? 0) > (parseDateMs(latest.date) ?? 0));
  if (newerReplyExists) return null;
  const fromJoyce = JOYCE_PATTERN.test(latest.memberName);
  return {
    direction: fromJoyce ? (ROBERT_PATTERN.test(latest.text) ? "robert" : "external") : "joyce",
    comment: latest,
  } as const;
}

function meaningfulProgressMs(ctx: TrelloCardContext) {
  const meaningfulTypes = new Set([
    "updateCheckItemStateOnCard",
    "createCheckItem",
    "addChecklistToCard",
    "updateCard:list",
    "createAttachmentToCard",
    "addAttachmentToCard",
  ]);
  const eventTimes = (ctx.activity ?? [])
    .filter((event) => meaningfulTypes.has(event.type) || (event.type === "commentCard" && JOYCE_PATTERN.test(event.memberName) && event.detail.trim().length >= 40))
    .map((event) => parseDateMs(event.date))
    .filter((value): value is number => value != null);
  const completedStepTimes = ctx.checklists
    .flatMap((checklist) => checklist.checkItems)
    .some((item) => item.state === "complete")
    ? [ctx.lastActivityMs]
    : [];
  const candidates = [...eventTimes, ...completedStepTimes];
  if (candidates.length) return Math.max(...candidates);
  return ctx.lastActivityMs || null;
}

export function assessAptlssCard({
  ctx,
  steps,
  dependentCardCount = 0,
  portfolio,
  runtime,
  forecast,
  calibration,
  waiting = null,
  externalEvidence,
  duplicateCardNames = [],
  planMissingNextAction = false,
  nowMs = Date.now(),
  trigger = "manual",
  policy = { stallThresholdDays: 5, confidenceFlagThreshold: 65 },
}: {
  ctx: TrelloCardContext;
  steps: AssessmentStep[];
  dependentCardCount?: number;
  portfolio?: AptlssPortfolioSignal;
  runtime?: AptlssRuntimeSignal;
  forecast?: AptlssForecast;
  calibration?: AssessmentCalibrationContext;
  waiting?: AptlssWaitingSignal | null;
  externalEvidence?: AptlssExternalEvidenceSignal;
  duplicateCardNames?: string[];
  planMissingNextAction?: boolean;
  nowMs?: number;
  trigger?: AssessmentTrigger;
  policy?: AptlssAssessmentPolicy;
}): AptlssAssessment {
  const portfolioWasProvided = Boolean(portfolio);
  const runtimeWasProvided = Boolean(runtime);
  const portfolioSignal: AptlssPortfolioSignal = portfolio ?? {
    ...EMPTY_PORTFOLIO,
    directDependentCount: dependentCardCount,
    transitiveDependentCount: dependentCardCount,
  };
  const runtimeSignal = runtime ?? EMPTY_RUNTIME;
  const externalEvidenceSignal: AptlssExternalEvidenceSignal = externalEvidence ?? {
    total: 0,
    sourceCounts: { gmail: 0, google_drive: 0, trello: 0, communication: 0 },
    highConfidenceLinks: 0,
    latestObservedAt: null,
    items: [],
  };
  const openSteps = steps.filter((step) => step.status === "open");
  const completedSteps = steps.filter((step) => step.status === "complete");
  const progress = checklistProgress(ctx);
  const due = duePressure(ctx.due, nowMs);
  const startMs = parseDateMs(ctx.start);
  const startsInFuture = startMs != null && startMs > nowMs + DAY_MS;
  const question = latestQuestionSignal(ctx);
  const waitingFollowUpMs = parseDateMs(waiting?.followUpAt);
  const waitingFollowUpDue = waitingFollowUpMs != null && waitingFollowUpMs <= nowMs;
  const waitingFollowUpSoon = waitingFollowUpMs != null && waitingFollowUpMs > nowMs && waitingFollowUpMs - nowMs <= DAY_MS;
  const lastProgressMs = meaningfulProgressMs(ctx);
  const daysSinceProgress = lastProgressMs == null ? 0 : Math.max(0, Math.floor((nowMs - lastProgressMs) / DAY_MS));
  const inDoneList = /done|complete|archive/i.test(ctx.listName);
  const hasRobertStep = openSteps.some((step) => step.requiresRobert || step.category === "robert_decision");
  const hasBlockedStep = openSteps.some((step) => Boolean(step.blockedBy));
  const hasExternalStep = openSteps.some((step) => step.category === "external_follow_up");
  const hasVerificationStep = openSteps.some((step) => step.category === "verification");
  const allItems = ctx.checklists.flatMap((checklist) => checklist.checkItems);
  const lacksStructure = !ctx.desc.trim() && allItems.length === 0 && ctx.comments.length === 0;
  const tooLarge = allItems.length > 15 || openSteps.length > 12;
  const missingOwner = openSteps.length > 0 && (ctx.members?.length ?? 0) === 0;
  const missingDue = openSteps.length > 0 && !ctx.due;
  const remainingMinutes = openSteps.reduce((sum, step) => sum + Math.max(0, step.estimatedMinutes ?? 15), 0);
  const forecastSignal: AptlssForecast = forecast ?? {
    rawEstimatedRemainingMinutes: remainingMinutes,
    calibratedP50Minutes: remainingMinutes,
    calibratedP90Minutes: remainingMinutes ? Math.round(remainingMinutes * 1.8) : 0,
    calibrationFactor: 1,
    calibrationSampleSize: 0,
    uncertainty: "high",
  };

  const secondarySignals: string[] = [];
  if (due.overdue) secondarySignals.push("overdue");
  if (daysSinceProgress >= policy.stallThresholdDays) secondarySignals.push("stale_progress");
  if (hasRobertStep) secondarySignals.push("robert_decision_open");
  if (hasBlockedStep) secondarySignals.push("dependency_blocked");
  if (hasExternalStep) secondarySignals.push("external_wait");
  if (question?.direction === "joyce") secondarySignals.push("inbound_question_unanswered");
  if (missingOwner) secondarySignals.push("owner_missing");
  if (missingDue) secondarySignals.push("due_date_missing");
  if (tooLarge) secondarySignals.push("oversized");
  if (startsInFuture) secondarySignals.push("future_start");
  if (duplicateCardNames.length) secondarySignals.push("possible_duplicate");
  if (planMissingNextAction) secondarySignals.push("plan_missing_next_action");
  if (portfolioSignal.isInDependencyCycle) secondarySignals.push("dependency_cycle");
  if (portfolioSignal.unresolvedDependencyIds.length) secondarySignals.push("unresolved_dependency");
  if (portfolioSignal.orphanReferences.length) secondarySignals.push("orphan_dependency_reference");
  if (portfolioSignal.bottleneckScore >= 40) secondarySignals.push("portfolio_bottleneck");
  if (runtimeSignal.replyOverdue) secondarySignals.push("reply_overdue");
  if (runtimeSignal.decisionStale) secondarySignals.push("decision_stale");
  if (runtimeSignal.activeTimer) secondarySignals.push("timer_active");
  if (runtimeSignal.scheduledToday) secondarySignals.push("scheduled_today");
  if (runtimeSignal.estimateOverrun) secondarySignals.push("estimate_overrun");
  if (waiting) secondarySignals.push("waiting_reason_recorded", `waiting_category:${waiting.category}`, `waiting_on:${waiting.waitingOn}`);
  if (waitingFollowUpDue) secondarySignals.push("waiting_follow_up_due");
  else if (waitingFollowUpSoon) secondarySignals.push("waiting_follow_up_soon");
  if (waiting && waiting.confidenceScore < 60) secondarySignals.push("waiting_reason_low_confidence");
  if (externalEvidenceSignal.total > 0) secondarySignals.push("cross_source_context_linked");
  if (externalEvidenceSignal.sourceCounts.gmail > 0) secondarySignals.push("gmail_context_linked");
  if (externalEvidenceSignal.sourceCounts.google_drive > 0) secondarySignals.push("drive_context_linked");
  if (externalEvidenceSignal.sourceCounts.communication > 0) secondarySignals.push("communication_context_linked");
  const externalRiskText = externalEvidenceSignal.items
    .filter((item) => item.relevanceScore >= 80)
    .map((item) => `${item.title} ${item.summary ?? ""} ${item.contentSnippet ?? ""}`)
    .join(" ");
  const externalRiskScore = /\b(overdue|urgent|deadline|blocked|breach|payment due|approval required)\b/i.test(externalRiskText) ? 6 : 0;
  if (externalRiskScore > 0) secondarySignals.push("cross_source_risk_signal");

  let primaryState: CardStateValue;
  let stateReason: string;
  let actionability: AptlssAssessment["actionability"];
  if ((inDoneList || ctx.closed) && ctx.dueComplete) {
    primaryState = "DONE_CONFIRMED";
    stateReason = "Card is in a completion list and Trello marks the due item complete.";
    actionability = "complete";
  } else if (inDoneList || ctx.closed) {
    primaryState = "NEEDS_ARCHIVE";
    stateReason = "Card is in a completion list but its completion metadata is inconsistent.";
    actionability = "repair";
  } else if (portfolioSignal.isInDependencyCycle) {
    primaryState = "BLOCKED_BY_OTHER_CARD";
    stateReason = `A dependency cycle connects ${portfolioSignal.cycleCardIds.length} cards and must be broken before execution can be trusted.`;
    actionability = "blocked";
  } else if (portfolioSignal.unresolvedDependencyIds.length > 0) {
    primaryState = "BLOCKED_BY_OTHER_CARD";
    stateReason = `Execution depends on ${portfolioSignal.unresolvedDependencyNames.join(", ")}.`;
    actionability = "blocked";
  } else if (hasBlockedStep) {
    primaryState = "BLOCKED_BY_OTHER_CARD";
    stateReason = "An open step names another card as a blocker.";
    actionability = "blocked";
  } else if (waiting?.waitingOn === "dependency" || waiting?.category === "dependency") {
    primaryState = "BLOCKED_BY_OTHER_CARD";
    stateReason = `VA-recorded waiting evidence: ${waiting.summary}`;
    actionability = "blocked";
  } else if (waiting?.waitingOn === "robert") {
    primaryState = "WAITING_FOR_ROBERT";
    stateReason = `VA-recorded waiting evidence: ${waiting.summary}`;
    actionability = "decision";
  } else if (waiting?.waitingOn === "external_party") {
    primaryState = "WAITING_FOR_EXTERNAL_PARTY";
    stateReason = `VA-recorded waiting evidence: ${waiting.summary}`;
    actionability = waitingFollowUpDue ? "actionable" : "waiting";
  } else if (waiting?.waitingOn === "joyce") {
    primaryState = "WAITING_FOR_JOYCE";
    stateReason = `VA-recorded waiting evidence: ${waiting.summary}`;
    actionability = "actionable";
  } else if (waiting) {
    primaryState = "WAITING_FOR_JOYCE";
    stateReason = `The saved waiting reason is ambiguous and needs clarification: ${waiting.rawReason}`;
    actionability = "repair";
  } else if (progress.total > 0 && progress.ratio === 1) {
    primaryState = "READY_FOR_DONE";
    stateReason = "All APTLSS checklist items are complete; final verification and handoff remain.";
    actionability = "actionable";
  } else if (hasRobertStep || question?.direction === "robert") {
    primaryState = "WAITING_FOR_ROBERT";
    stateReason = "Execution depends on an unresolved Robert decision.";
    actionability = "decision";
  } else if (runtimeSignal.replyOverdue) {
    primaryState = "WAITING_FOR_JOYCE";
    stateReason = `An inbound message has waited ${Math.max(1, Math.round(runtimeSignal.replyAgeHours ?? 0))} hour(s) for Joyce's reply.`;
    actionability = "actionable";
  } else if (hasExternalStep || question?.direction === "external") {
    primaryState = "WAITING_FOR_EXTERNAL_PARTY";
    stateReason = "Joyce has asked a question or an open step requires an external response.";
    actionability = "waiting";
  } else if (question?.direction === "joyce") {
    primaryState = "WAITING_FOR_JOYCE";
    stateReason = `The latest unresolved question came from ${question.comment.memberName || "another participant"}.`;
    actionability = "actionable";
  } else if (due.overdue) {
    primaryState = "OVERDUE";
    stateReason = `The due date passed ${Math.max(1, Math.ceil(Math.abs(due.daysUntilDue ?? 0)))} day(s) ago.`;
    actionability = "actionable";
  } else if (daysSinceProgress >= policy.stallThresholdDays && (progress.completed > 0 || completedSteps.length > 0)) {
    primaryState = "STALLED";
    stateReason = `No meaningful work evidence has been detected for ${daysSinceProgress} day(s).`;
    actionability = "repair";
  } else if (lacksStructure || tooLarge || planMissingNextAction || portfolioSignal.orphanReferences.length > 0 || (missingDue && missingOwner)) {
    primaryState = "NEEDS_RESTRUCTURING";
    stateReason = planMissingNextAction
      ? "The generated plan does not contain an executable next action."
      : lacksStructure
      ? "The card lacks description, steps, and discussion evidence."
      : portfolioSignal.orphanReferences.length > 0
        ? "The plan contains dependency references that do not resolve to known cards."
      : tooLarge
        ? "The work unit is too large for a reliable single-card plan."
        : "The card has executable steps but lacks both ownership and a due date.";
    actionability = "repair";
  } else if (!progress.total && !steps.length) {
    primaryState = "NEW_UNTRIAGED";
    stateReason = "No APTLSS steps exist yet.";
    actionability = "repair";
  } else if (hasVerificationStep && completedSteps.length > 0) {
    primaryState = "READY_FOR_REVIEW";
    stateReason = "Execution work has evidence of completion and the next open gate is verification.";
    actionability = "actionable";
  } else if (completedSteps.length > 0 || progress.completed > 0 || /doing|progress/i.test(ctx.listName)) {
    primaryState = "IN_PROGRESS";
    stateReason = "Completed work evidence exists and executable steps remain.";
    actionability = "actionable";
  } else {
    primaryState = "READY_TO_START";
    stateReason = "The card has a usable execution path and no blocking signal.";
    actionability = "actionable";
  }

  const effortFit = remainingMinutes === 0 ? 0 : remainingMinutes <= 30 ? 10 : remainingMinutes <= 90 ? 7 : remainingMinutes <= 240 ? 4 : 1;
  const risk = openSteps.reduce((max, step) => Math.max(max, riskSeverity(step.riskIfSkipped)), 0);
  const stateModifier = primaryState === "WAITING_FOR_ROBERT" ? 8
    : primaryState === "WAITING_FOR_JOYCE" ? 10
      : primaryState === "STALLED" || primaryState === "NEEDS_RESTRUCTURING" ? 7
        : primaryState === "WAITING_FOR_EXTERNAL_PARTY" ? -5
          : primaryState === "DONE_CONFIRMED" || primaryState === "NEEDS_ARCHIVE" ? -20
            : 0;
  const priorityBreakdown = {
    activeBase: actionability === "complete" ? 0 : 15,
    duePressure: due.pressure,
    labelUrgency: labelUrgency(ctx.labels),
    customFieldUrgency: customFieldUrgency(ctx.customFields),
    dependencyImpact: Math.min(18,
      portfolioSignal.directDependentCount * 5
      + Math.max(0, portfolioSignal.transitiveDependentCount - portfolioSignal.directDependentCount) * 3
      + (portfolioSignal.isInDependencyCycle ? 8 : 0)),
    portfolioBottleneck: Math.min(10, Math.round(portfolioSignal.bottleneckScore / 10)),
    riskIfIgnored: risk,
    communicationRisk: Math.max(runtimeSignal.replyOverdue ? 10 : 0, waitingFollowUpDue && waiting?.waitingOn === "external_party" ? 12 : 0),
    decisionDelay: runtimeSignal.decisionStale ? 8 : 0,
    waitingUrgency: waiting?.urgency === "critical" ? 18 : waiting?.urgency === "high" ? 12 : waiting?.urgency === "normal" ? 4 : 0,
    waitingFollowUp: waitingFollowUpDue ? 12 : waitingFollowUpSoon ? 5 : 0,
    activeCommitment: runtimeSignal.activeTimer ? 8 : runtimeSignal.scheduledToday ? 4 : 0,
    estimateRisk: runtimeSignal.estimateOverrun ? 7 : 0,
    staleEscalation: daysSinceProgress >= 10 ? 10 : daysSinceProgress >= 5 ? 6 : 0,
    effortFit,
    stateModifier: stateModifier + (startsInFuture ? -8 : 0),
    duplicateReview: duplicateCardNames.length ? 4 : 0,
    crossSourceRisk: externalRiskScore,
  };
  const priorityScore = clamp(Object.values(priorityBreakdown).reduce((sum, value) => sum + value, 0));
  const priorityTier: PriorityTier = actionability === "blocked"
    ? "BLOCKED"
    : priorityScore >= 80 ? "CRITICAL" : priorityScore >= 60 ? "HIGH" : priorityScore >= 35 ? "MEDIUM" : "LOW";

  const evidenceCoverage = {
    description: Boolean(ctx.desc.trim()),
    dueDate: Boolean(ctx.due),
    owner: (ctx.members?.length ?? 0) > 0,
    labels: ctx.labels.length > 0,
    checklist: progress.total > 0,
    aptlssSteps: steps.length > 0,
    comments: ctx.comments.length > 0,
    activityHistory: (ctx.activity?.length ?? 0) > 0,
    completionCriteria: steps.some((step) => Boolean(step.completionCriteria?.trim())),
    riskEvidence: steps.some((step) => Boolean(step.riskIfSkipped?.trim())),
    customFields: (ctx.customFields?.length ?? 0) > 0,
    portfolioContext: portfolioWasProvided,
    timeHistory: runtimeWasProvided && runtimeSignal.sessionCount > 0,
    communicationContext: runtimeWasProvided && runtimeSignal.replyStatus !== null,
    scheduleContext: runtimeWasProvided && runtimeSignal.scheduledToday,
    estimateCalibration: forecastSignal.calibrationSampleSize > 0,
    humanCalibration: (calibration?.byState?.[primaryState]?.samples ?? 0) >= 5 || (calibration?.sampleSize ?? 0) >= 10,
    waitingReason: Boolean(waiting),
    gmailContext: externalEvidenceSignal.sourceCounts.gmail > 0,
    driveContext: externalEvidenceSignal.sourceCounts.google_drive > 0,
    crossSourceLinks: externalEvidenceSignal.highConfidenceLinks > 0,
  };
  const coverageWeights: Record<keyof typeof evidenceCoverage, number> = {
    description: 14,
    dueDate: 8,
    owner: 8,
    labels: 5,
    checklist: 12,
    aptlssSteps: 15,
    comments: 8,
    activityHistory: 12,
    completionCriteria: 10,
    riskEvidence: 8,
    customFields: 5,
    portfolioContext: 5,
    timeHistory: 5,
    communicationContext: 4,
    scheduleContext: 3,
    estimateCalibration: 5,
    humanCalibration: 4,
    waitingReason: 12,
    gmailContext: 4,
    driveContext: 5,
    crossSourceLinks: 5,
  };
  let confidence = 10;
  for (const key of Object.keys(evidenceCoverage) as Array<keyof typeof evidenceCoverage>) {
    if (evidenceCoverage[key]) confidence += coverageWeights[key];
  }
  const uncertainties: string[] = [];
  if (!evidenceCoverage.description) uncertainties.push("Card description is missing.");
  if (!evidenceCoverage.owner) uncertainties.push("No card owner is assigned.");
  if (!evidenceCoverage.dueDate) uncertainties.push("No due date is available for urgency calibration.");
  if (!evidenceCoverage.activityHistory) uncertainties.push("Only a coarse last-activity timestamp is available; progress freshness is less reliable.");
  if (!steps.length) uncertainties.push("No persisted APTLSS steps are available.");
  if (externalEvidenceSignal.total === 0) uncertainties.push("No Gmail, Drive, communication, or retained Trello evidence is linked to this card yet.");
  if (remainingMinutes > 0 && forecastSignal.calibrationSampleSize === 0) {
    uncertainties.push("No completed-work sample is available to calibrate the remaining-time estimate.");
  }
  if (forecastSignal.uncertainty === "high" && remainingMinutes > 0) {
    uncertainties.push("The completion forecast has a wide uncertainty range.");
    confidence -= 4;
  }
  if (portfolioSignal.orphanReferences.length) {
    uncertainties.push(`Unresolved dependency reference${portfolioSignal.orphanReferences.length > 1 ? "s" : ""}: ${portfolioSignal.orphanReferences.join(", ")}.`);
    confidence -= 10;
  }
  if (duplicateCardNames.length) {
    uncertainties.push(`Possible duplicate card${duplicateCardNames.length > 1 ? "s" : ""}: ${duplicateCardNames.join(", ")}.`);
    confidence -= 8;
  }
  if (planMissingNextAction) {
    uncertainties.push("The current generated plan has no executable next action.");
    confidence -= 15;
  }
  if (waiting && waiting.confidenceScore < 60) {
    uncertainties.push(`The saved waiting reason was interpreted with only ${waiting.confidenceScore}% confidence.`);
    confidence -= 8;
  }
  if (waiting) {
    for (const missing of waiting.missingInformation) uncertainties.push(`Waiting reason: ${missing}`);
  }
  if (ctx.dueComplete && !inDoneList && progress.ratio < 1) {
    uncertainties.push("Trello marks the due item complete while execution evidence remains incomplete.");
    confidence -= 12;
  }
  if (lastProgressMs != null && nowMs - lastProgressMs > 30 * DAY_MS) confidence -= 8;
  const evidenceDimension = clamp(confidence);
  let confidenceCeiling = 100;
  if (lacksStructure) confidenceCeiling = Math.min(confidenceCeiling, 35);
  if (!steps.length) confidenceCeiling = Math.min(confidenceCeiling, 55);
  if (remainingMinutes > 0 && forecastSignal.calibrationSampleSize === 0) confidenceCeiling = Math.min(confidenceCeiling, 88);
  else if (remainingMinutes > 0 && forecastSignal.calibrationSampleSize < 2) confidenceCeiling = Math.min(confidenceCeiling, 92);
  if (!evidenceCoverage.humanCalibration) confidenceCeiling = Math.min(confidenceCeiling, 95);
  const waitingConfidenceCeiling = waiting && ["WAITING_FOR_ROBERT", "WAITING_FOR_EXTERNAL_PARTY", "WAITING_FOR_JOYCE", "BLOCKED_BY_OTHER_CARD"].includes(primaryState)
    ? Math.min(95, waiting.confidenceScore + 10)
    : 100;
  confidenceCeiling = Math.min(confidenceCeiling, waitingConfidenceCeiling);
  confidence = Math.min(confidenceCeiling, clamp(confidence));
  const confidenceBeforeCalibration = confidence;
  const stateCalibration = calibration?.byState?.[primaryState];
  const calibrationScope = stateCalibration && stateCalibration.samples >= 5
    ? "state" as const
    : calibration && calibration.sampleSize >= 10 && calibration.accuracyScore != null
      ? "global" as const
      : "none" as const;
  const calibrationSamples = calibrationScope === "state" ? stateCalibration!.samples
    : calibrationScope === "global" ? calibration!.sampleSize
      : 0;
  const validatedAccuracy = calibrationScope === "state" ? stateCalibration!.accuracyScore
    : calibrationScope === "global" ? calibration!.accuracyScore
      : null;
  if (validatedAccuracy != null) {
    const maximumWeight = calibrationScope === "state" ? 0.35 : 0.25;
    const fullWeightSamples = calibrationScope === "state" ? 30 : 60;
    const weight = maximumWeight * Math.min(1, calibrationSamples / fullWeightSamples);
    confidence = Math.min(confidenceCeiling, clamp(confidence * (1 - weight) + validatedAccuracy * weight));
  }
  const appliedCalibration: AppliedAssessmentCalibration = {
    applied: calibrationScope !== "none",
    scope: calibrationScope,
    sampleSize: calibrationSamples,
    validatedAccuracy,
    confidenceBeforeCalibration,
    confidenceAfterCalibration: confidence,
  };
  const confidenceBand = confidence >= 80 ? "high" : confidence >= 60 ? "medium" : "low";
  const confidenceBlockers: string[] = [];
  if (lacksStructure) confidenceBlockers.push("Add a usable description, owner, and due date.");
  if (!steps.length) confidenceBlockers.push("Generate and persist executable APTLSS steps.");
  if (remainingMinutes > 0 && forecastSignal.calibrationSampleSize < 2) {
    confidenceBlockers.push(`Complete ${2 - forecastSignal.calibrationSampleSize} more fully timed card${2 - forecastSignal.calibrationSampleSize === 1 ? "" : "s"} to calibrate forecasts.`);
  }
  if (!evidenceCoverage.humanCalibration) {
    const stateSamples = calibration?.byState?.[primaryState]?.samples ?? 0;
    confidenceBlockers.push(`Review ${Math.min(Math.max(0, 5 - stateSamples), Math.max(0, 10 - (calibration?.sampleSize ?? 0)))} more comparable assessment${Math.min(Math.max(0, 5 - stateSamples), Math.max(0, 10 - (calibration?.sampleSize ?? 0))) === 1 ? "" : "s"} for empirical validation.`);
  }
  if (waitingConfidenceCeiling < APTLSS_NEAR_CERTAINTY_TARGET) {
    confidenceBlockers.push("Clarify the waiting party, requested item, and explicit follow-up time.");
  }
  const contradictionCount = [
    forecastSignal.uncertainty === "high" && remainingMinutes > 0,
    portfolioSignal.orphanReferences.length > 0,
    duplicateCardNames.length > 0,
    Boolean(planMissingNextAction),
    ctx.dueComplete && !inDoneList && progress.ratio < 1,
  ].filter(Boolean).length;
  const confidenceProfile: AptlssConfidenceProfile = {
    targetScore: APTLSS_NEAR_CERTAINTY_TARGET,
    ceiling: confidenceCeiling,
    gapToTarget: Math.max(0, APTLSS_NEAR_CERTAINTY_TARGET - confidence),
    eligibleForNearCertainty: confidence >= APTLSS_NEAR_CERTAINTY_TARGET && confidenceBlockers.length === 0,
    dimensions: {
      evidence: evidenceDimension,
      forecast: remainingMinutes === 0 ? 100
        : forecastSignal.calibrationSampleSize >= 6 && forecastSignal.uncertainty === "low" ? 100
          : forecastSignal.calibrationSampleSize >= 2 ? (forecastSignal.uncertainty === "high" ? 82 : 94)
            : forecastSignal.calibrationSampleSize === 1 ? 70 : 40,
      humanValidation: validatedAccuracy ?? 0,
      consistency: clamp(100 - contradictionCount * 15),
    },
    blockers: Array.from(new Set(confidenceBlockers)),
  };
  const confidenceReason = `${Object.values(evidenceCoverage).filter(Boolean).length}/${Object.keys(evidenceCoverage).length} evidence categories available; ${uncertainties.length} material uncertaint${uncertainties.length === 1 ? "y" : "ies"}; verified ceiling ${confidenceCeiling}%.${appliedCalibration.applied ? ` Human calibration adjusted ${confidenceBeforeCalibration}% to ${confidence}% from ${calibrationSamples} ${calibrationScope} review(s).` : " Human calibration is not yet applied because the review sample is too small."}`;

  const recommendations: string[] = [];
  if (waiting) recommendations.push(waiting.nextAction);
  if (primaryState === "WAITING_FOR_JOYCE") recommendations.push("Answer the latest inbound question with a concrete decision or next action.");
  if (primaryState === "WAITING_FOR_ROBERT") recommendations.push("Present Robert with one bounded decision, a recommendation, and the cost of delay.");
  if (primaryState === "WAITING_FOR_EXTERNAL_PARTY") recommendations.push("Confirm the follow-up deadline and prepare a specific follow-up if it has passed.");
  if (primaryState === "BLOCKED_BY_OTHER_CARD") recommendations.push("Inspect the named blocker and reassess immediately when it changes.");
  if (externalRiskScore > 0) recommendations.push("Review the recent linked Gmail or Drive evidence before committing the next action.");
  if (due.overdue) recommendations.push("Resolve or explicitly renegotiate the overdue commitment today.");
  if (missingOwner) recommendations.push("Assign a clear owner before relying on execution timing.");
  if (missingDue) recommendations.push("Add a due date or explicitly mark the work as undated maintenance.");
  if (duplicateCardNames.length) recommendations.push("Compare the possible duplicate cards and merge, link, or clearly differentiate them.");
  if (planMissingNextAction) recommendations.push("Regenerate or repair the APTLSS plan before scheduling this card.");
  if (portfolioSignal.isInDependencyCycle) recommendations.push("Break the dependency cycle by choosing one card that can proceed without the other cycle members.");
  else if (portfolioSignal.unresolvedDependencyIds.length) recommendations.push(`Unblock ${portfolioSignal.unresolvedDependencyNames[0]} first, then reassess this card.`);
  if (portfolioSignal.orphanReferences.length) recommendations.push("Repair the unresolved dependency references so portfolio sequencing uses real card IDs.");
  if (portfolioSignal.bottleneckScore >= 40) recommendations.push(`Treat this as a portfolio bottleneck: ${portfolioSignal.transitiveDependentCount} downstream card(s) may be affected.`);
  if (runtimeSignal.replyOverdue) recommendations.push("Reply to the waiting inbound message before starting lower-impact work.");
  if (runtimeSignal.decisionStale) recommendations.push("Escalate the open Robert decision with a recommendation and a clear cost-of-delay statement.");
  if (runtimeSignal.estimateOverrun) recommendations.push("Re-estimate the remaining steps from observed execution time before committing to a completion date.");
  if (runtimeSignal.activeTimer) recommendations.push("Continue the active timed block or stop it explicitly before changing focus.");
  if (confidence < policy.confidenceFlagThreshold) recommendations.push("Improve the missing evidence before using this assessment for autonomous planning.");
  if (!recommendations.length) recommendations.push("Execute the highest-priority open step and record completion evidence.");

  const reassessmentMinutes = runtimeSignal.activeTimer ? 15
    : due.overdue || priorityTier === "CRITICAL" || portfolioSignal.isInDependencyCycle || runtimeSignal.replyOverdue ? 30
    : primaryState === "IN_PROGRESS" || primaryState === "WAITING_FOR_JOYCE" ? 60
      : actionability === "waiting" || actionability === "decision" ? 180
        : actionability === "complete" ? 1440
          : 360;

  let nextAssessmentMs = nowMs + reassessmentMinutes * 60_000;
  if (waitingFollowUpDue) nextAssessmentMs = Math.min(nextAssessmentMs, nowMs + 30 * 60_000);
  else if (waitingFollowUpMs != null && (waiting?.waitingOn === "external_party" || waiting?.waitingOn === "dependency")) {
    nextAssessmentMs = Math.min(waitingFollowUpMs, nowMs + DAY_MS);
  }

  const assessedAt = new Date(nowMs).toISOString();
  return {
    engineVersion: APTLSS_ASSESSMENT_VERSION,
    cardId: ctx.id,
    contextHash: buildAssessmentContextHash(ctx, steps, waiting, externalEvidenceSignal),
    primaryState,
    stateReason,
    secondarySignals,
    actionability,
    priorityScore,
    priorityTier,
    priorityBreakdown,
    confidenceScore: confidence,
    confidenceBand,
    confidenceReason,
    confidenceProfile,
    evidenceCoverage,
    evidence: [
      { key: "due", source: "trello", value: ctx.due, quality: ctx.due ? "strong" : "weak", detail: due.overdue ? "Due date has passed." : "Current Trello due-date signal." },
      { key: "progress", source: "derived", value: daysSinceProgress, quality: evidenceCoverage.activityHistory ? "strong" : "weak", detail: "Days since the latest meaningful progress evidence.", observedAt: lastProgressMs ? new Date(lastProgressMs).toISOString() : undefined },
      { key: "steps", source: "aptlss", value: openSteps.length, quality: steps.length ? "strong" : "weak", detail: `${openSteps.length} open and ${completedSteps.length} completed persisted steps.` },
      { key: "dependencies", source: "aptlss", value: portfolioSignal.directDependentCount, quality: portfolioWasProvided ? "strong" : "moderate", detail: "Number of other cards directly depending on this card." },
      { key: "question_direction", source: "derived", value: question?.direction ?? null, quality: question ? "moderate" : "weak", detail: "Direction of the latest unresolved question." },
      { key: "waiting_reason", source: "aptlss", value: waiting?.rawReason ?? null, quality: waiting ? (waiting.confidenceScore >= 80 ? "strong" : waiting.confidenceScore >= 60 ? "moderate" : "weak") : "weak", detail: waiting ? `${waiting.summary} Next: ${waiting.nextAction}` : "No VA-supplied waiting reason is active.", observedAt: waiting?.recordedAt },
      { key: "waiting_follow_up", source: "schedule", value: waiting?.followUpAt ?? null, quality: waiting?.followUpSource === "explicit" ? "strong" : waiting ? "moderate" : "weak", detail: waiting?.followUpReason ?? "No waiting follow-up is scheduled." },
      { key: "portfolio_impact", source: "portfolio", value: portfolioSignal.transitiveDependentCount, quality: portfolioWasProvided ? "strong" : "weak", detail: `${portfolioSignal.transitiveDependentCount} downstream card(s); bottleneck score ${portfolioSignal.bottleneckScore}.` },
      { key: "dependency_depth", source: "portfolio", value: portfolioSignal.criticalPathDepth, quality: portfolioWasProvided ? "strong" : "weak", detail: "Longest unresolved dependency chain from this card." },
      { key: "tracked_minutes", source: "runtime", value: runtimeSignal.trackedMinutes, quality: runtimeSignal.sessionCount ? "strong" : "weak", detail: `${runtimeSignal.sessionCount} persisted timer session(s).` },
      { key: "reply_age_hours", source: "runtime", value: runtimeSignal.replyAgeHours, quality: runtimeSignal.replyStatus ? "strong" : "weak", detail: runtimeSignal.replyStatus ? `Reply monitor status: ${runtimeSignal.replyStatus}.` : "No linked reply-monitor thread." },
      { key: "decision_age_hours", source: "runtime", value: runtimeSignal.openDecisionAgeHours, quality: runtimeSignal.openDecisionAgeHours == null ? "weak" : "strong", detail: "Age of the oldest open Robert-required step." },
      { key: "scheduled_today", source: "schedule", value: runtimeSignal.scheduledToday, quality: runtimeWasProvided ? "strong" : "weak", detail: runtimeSignal.scheduledToday ? `${runtimeSignal.scheduledMinutes} minute(s) scheduled today.` : "No block in today's persisted plan." },
      { key: "forecast_p50", source: "derived", value: forecastSignal.calibratedP50Minutes, quality: forecastSignal.calibrationSampleSize >= 6 ? "strong" : forecastSignal.calibrationSampleSize >= 2 ? "moderate" : "weak", detail: `P50 ${forecastSignal.calibratedP50Minutes}m; P90 ${forecastSignal.calibratedP90Minutes}m from ${forecastSignal.calibrationSampleSize} calibration sample(s).` }, // gitleaks:allow - evidence key, not a credential
      { key: "validated_accuracy", source: "derived", value: validatedAccuracy, quality: calibrationScope === "state" ? "strong" : calibrationScope === "global" ? "moderate" : "weak", detail: appliedCalibration.applied ? `Confidence calibrated from ${calibrationSamples} human review(s).` : "Human review sample is below the calibration threshold." },
      { key: "workspace_evidence", source: "workspace", value: externalEvidenceSignal.total, quality: externalEvidenceSignal.highConfidenceLinks > 0 ? "strong" : externalEvidenceSignal.total > 0 ? "moderate" : "weak", detail: `${externalEvidenceSignal.sourceCounts.gmail} Gmail, ${externalEvidenceSignal.sourceCounts.google_drive} Drive, ${externalEvidenceSignal.sourceCounts.communication} communication, and ${externalEvidenceSignal.sourceCounts.trello} Trello evidence item(s) linked.` },
      { key: "workspace_high_confidence_links", source: "workspace", value: externalEvidenceSignal.highConfidenceLinks, quality: externalEvidenceSignal.highConfidenceLinks > 0 ? "strong" : "weak", detail: "Links backed by an explicit identifier or full card-name match." },
      { key: "workspace_latest_observation", source: "workspace", value: externalEvidenceSignal.latestObservedAt, quality: externalEvidenceSignal.latestObservedAt ? "moderate" : "weak", detail: "Latest observation time across linked workspace sources.", observedAt: externalEvidenceSignal.latestObservedAt ?? undefined },
    ],
    uncertainties,
    recommendations: Array.from(new Set(recommendations)),
    waiting,
    externalEvidence: externalEvidenceSignal,
    portfolio: portfolioSignal,
    runtime: runtimeSignal,
    forecast: forecastSignal,
    calibration: appliedCalibration,
    lastMeaningfulProgressAt: lastProgressMs ? new Date(lastProgressMs).toISOString() : null,
    daysSinceMeaningfulProgress: daysSinceProgress,
    nextAssessmentAt: new Date(nextAssessmentMs).toISOString(),
    assessedAt,
    trigger,
  };
}
