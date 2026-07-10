import { createHash } from "crypto";
import type { CardStateValue, PriorityTier, TrelloCardContext } from "./aptlssEngine";

export const APTLSS_ASSESSMENT_VERSION = "3.0.0";

export type AssessmentTrigger = "generation" | "webhook" | "scheduled" | "manual";

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
  source: "trello" | "aptlss" | "derived";
  value: string | number | boolean | null;
  quality: "strong" | "moderate" | "weak";
  detail: string;
  observedAt?: string;
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
  evidenceCoverage: Record<string, boolean>;
  evidence: AssessmentEvidence[];
  uncertainties: string[];
  recommendations: string[];
  lastMeaningfulProgressAt: string | null;
  daysSinceMeaningfulProgress: number;
  nextAssessmentAt: string;
  assessedAt: string;
  trigger: AssessmentTrigger;
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

export function buildAssessmentContextHash(ctx: TrelloCardContext, steps: AssessmentStep[]) {
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
  duplicateCardNames = [],
  planMissingNextAction = false,
  nowMs = Date.now(),
  trigger = "manual",
}: {
  ctx: TrelloCardContext;
  steps: AssessmentStep[];
  dependentCardCount?: number;
  duplicateCardNames?: string[];
  planMissingNextAction?: boolean;
  nowMs?: number;
  trigger?: AssessmentTrigger;
}): AptlssAssessment {
  const openSteps = steps.filter((step) => step.status === "open");
  const completedSteps = steps.filter((step) => step.status === "complete");
  const progress = checklistProgress(ctx);
  const due = duePressure(ctx.due, nowMs);
  const startMs = parseDateMs(ctx.start);
  const startsInFuture = startMs != null && startMs > nowMs + DAY_MS;
  const question = latestQuestionSignal(ctx);
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

  const secondarySignals: string[] = [];
  if (due.overdue) secondarySignals.push("overdue");
  if (daysSinceProgress >= 5) secondarySignals.push("stale_progress");
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
  } else if (progress.total > 0 && progress.ratio === 1) {
    primaryState = "READY_FOR_DONE";
    stateReason = "All APTLSS checklist items are complete; final verification and handoff remain.";
    actionability = "actionable";
  } else if (hasBlockedStep) {
    primaryState = "BLOCKED_BY_OTHER_CARD";
    stateReason = "An open step names another card as a blocker.";
    actionability = "blocked";
  } else if (hasRobertStep || question?.direction === "robert") {
    primaryState = "WAITING_FOR_ROBERT";
    stateReason = "Execution depends on an unresolved Robert decision.";
    actionability = "decision";
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
  } else if (daysSinceProgress >= 5 && (progress.completed > 0 || completedSteps.length > 0)) {
    primaryState = "STALLED";
    stateReason = `No meaningful work evidence has been detected for ${daysSinceProgress} day(s).`;
    actionability = "repair";
  } else if (lacksStructure || tooLarge || planMissingNextAction || (missingDue && missingOwner)) {
    primaryState = "NEEDS_RESTRUCTURING";
    stateReason = planMissingNextAction
      ? "The generated plan does not contain an executable next action."
      : lacksStructure
      ? "The card lacks description, steps, and discussion evidence."
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

  const remainingMinutes = openSteps.reduce((sum, step) => sum + Math.max(0, step.estimatedMinutes ?? 15), 0);
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
    dependencyImpact: Math.min(15, dependentCardCount * 4),
    riskIfIgnored: risk,
    staleEscalation: daysSinceProgress >= 10 ? 10 : daysSinceProgress >= 5 ? 6 : 0,
    effortFit,
    stateModifier: stateModifier + (startsInFuture ? -8 : 0),
    duplicateReview: duplicateCardNames.length ? 4 : 0,
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
  if (duplicateCardNames.length) {
    uncertainties.push(`Possible duplicate card${duplicateCardNames.length > 1 ? "s" : ""}: ${duplicateCardNames.join(", ")}.`);
    confidence -= 8;
  }
  if (planMissingNextAction) {
    uncertainties.push("The current generated plan has no executable next action.");
    confidence -= 15;
  }
  if (ctx.dueComplete && !inDoneList && progress.ratio < 1) {
    uncertainties.push("Trello marks the due item complete while execution evidence remains incomplete.");
    confidence -= 12;
  }
  if (lastProgressMs != null && nowMs - lastProgressMs > 30 * DAY_MS) confidence -= 8;
  if (lacksStructure) confidence = Math.min(confidence, 35);
  if (!steps.length) confidence = Math.min(confidence, 55);
  confidence = clamp(confidence);
  const confidenceBand = confidence >= 80 ? "high" : confidence >= 60 ? "medium" : "low";
  const confidenceReason = `${Object.values(evidenceCoverage).filter(Boolean).length}/${Object.keys(evidenceCoverage).length} evidence categories available; ${uncertainties.length} material uncertaint${uncertainties.length === 1 ? "y" : "ies"}.`;

  const recommendations: string[] = [];
  if (primaryState === "WAITING_FOR_JOYCE") recommendations.push("Answer the latest inbound question with a concrete decision or next action.");
  if (primaryState === "WAITING_FOR_ROBERT") recommendations.push("Present Robert with one bounded decision, a recommendation, and the cost of delay.");
  if (primaryState === "WAITING_FOR_EXTERNAL_PARTY") recommendations.push("Confirm the follow-up deadline and prepare a specific follow-up if it has passed.");
  if (primaryState === "BLOCKED_BY_OTHER_CARD") recommendations.push("Inspect the named blocker and reassess immediately when it changes.");
  if (due.overdue) recommendations.push("Resolve or explicitly renegotiate the overdue commitment today.");
  if (missingOwner) recommendations.push("Assign a clear owner before relying on execution timing.");
  if (missingDue) recommendations.push("Add a due date or explicitly mark the work as undated maintenance.");
  if (duplicateCardNames.length) recommendations.push("Compare the possible duplicate cards and merge, link, or clearly differentiate them.");
  if (planMissingNextAction) recommendations.push("Regenerate or repair the APTLSS plan before scheduling this card.");
  if (confidence < 60) recommendations.push("Improve the missing evidence before using this assessment for autonomous planning.");
  if (!recommendations.length) recommendations.push("Execute the highest-priority open step and record completion evidence.");

  const reassessmentMinutes = due.overdue || priorityTier === "CRITICAL" ? 30
    : primaryState === "IN_PROGRESS" || primaryState === "WAITING_FOR_JOYCE" ? 60
      : actionability === "waiting" || actionability === "decision" ? 180
        : actionability === "complete" ? 1440
          : 360;

  const assessedAt = new Date(nowMs).toISOString();
  return {
    engineVersion: APTLSS_ASSESSMENT_VERSION,
    cardId: ctx.id,
    contextHash: buildAssessmentContextHash(ctx, steps),
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
    evidenceCoverage,
    evidence: [
      { key: "due", source: "trello", value: ctx.due, quality: ctx.due ? "strong" : "weak", detail: due.overdue ? "Due date has passed." : "Current Trello due-date signal." },
      { key: "progress", source: "derived", value: daysSinceProgress, quality: evidenceCoverage.activityHistory ? "strong" : "weak", detail: "Days since the latest meaningful progress evidence.", observedAt: lastProgressMs ? new Date(lastProgressMs).toISOString() : undefined },
      { key: "steps", source: "aptlss", value: openSteps.length, quality: steps.length ? "strong" : "weak", detail: `${openSteps.length} open and ${completedSteps.length} completed persisted steps.` },
      { key: "dependencies", source: "aptlss", value: dependentCardCount, quality: "moderate", detail: "Number of other cards depending on this card." },
      { key: "question_direction", source: "derived", value: question?.direction ?? null, quality: question ? "moderate" : "weak", detail: "Direction of the latest unresolved question." },
    ],
    uncertainties,
    recommendations: Array.from(new Set(recommendations)),
    lastMeaningfulProgressAt: lastProgressMs ? new Date(lastProgressMs).toISOString() : null,
    daysSinceMeaningfulProgress: daysSinceProgress,
    nextAssessmentAt: new Date(nowMs + reassessmentMinutes * 60_000).toISOString(),
    assessedAt,
    trigger,
  };
}
