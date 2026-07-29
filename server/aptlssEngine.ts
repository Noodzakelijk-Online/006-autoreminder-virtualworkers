/**
 * APTLSS Operational Engine
 *
 * One evidence-calibrated assessment pipeline computes state, priority,
 * forecast, confidence, and portfolio signals from live card evidence. The
 * checklist writer then synchronizes approved execution steps to Trello.
 *
 * These engines are called from:
 *   - aptlss.generate tRPC procedure (on-demand)
 *   - /api/scheduled/aptlss-maintenance (daily silent job)
 *   - Trello webhook handler (on card move / checkItem update)
 */

// Trello API keys are read directly from process.env (not in ENV helper)
import {
  upsertCardState,
  upsertPriorityScore,
  getOpenStepsForCard,
  getManualStepsForCard,
  countDependentCards,
} from "./aptlssStepsDb";
import { InsertCardState, InsertPriorityScore } from "../drizzle/schema";
import { assessAptlssCard, type AssessmentCalibrationContext, type AssessmentTrigger } from "./aptlssAssessment";
import { saveAssessmentSnapshot } from "./aptlssAssessmentDb";
import type { AptlssPortfolioSignal } from "./aptlssPortfolio";
import type { AptlssForecast, AptlssRuntimeSignal } from "./aptlssRuntime";
import type { AptlssCardStateValue } from "./aptlssStateValues";
import { getActiveWaitingReason, toAptlssWaitingSignal } from "./aptlssWaitingReasonDb";
import type { AptlssWaitingSignal } from "./aptlssWaitingReason";
import { getOperationalPolicySnapshot } from "./aptlssPoliciesDb";
import type { AptlssExternalEvidenceSignal } from "./workspaceEvidence";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CardStateValue = AptlssCardStateValue;

export type PriorityTier = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "BLOCKED";

export interface TrelloCardContext {
  id: string;
  name: string;
  desc: string;
  start?: string | null;
  url: string;
  shortUrl: string;
  due: string | null;
  dueComplete: boolean;
  closed?: boolean;
  position?: number | null;
  labels: { name: string; color: string }[];
  listName: string;
  boardName: string;
  checklists: {
    id: string;
    name: string;
    checkItems: { id: string; name: string; state: "complete" | "incomplete" }[];
  }[];
  comments: { text: string; date: string; memberName: string }[];
  attachments: { name: string; url: string }[];
  /** Card members / assignees */
  members?: { username: string; fullName: string }[];
  /** Unix ms of last activity (card move, comment, checklist change) */
  lastActivityMs: number;
  /** Recent card activity used to distinguish meaningful progress from chatter. */
  activity?: { type: string; date: string; memberName: string; detail: string }[];
  customFields?: { id: string; name: string; value: string }[];
}

export interface AptlssStepInput {
  stepNumber: number;
  title: string;
  estimatedMinutes: number;
  category: string;
  requiresRobert: boolean;
  blockedBy?: string;
  dependsOnCards?: string[];
  completionCriteria?: string;
  riskIfSkipped?: string;
  recommendedDecision?: string;
}

export function isFinalSummaryComment(text: string): boolean {
  return /(?:^|\n)\s*(?:final summary|completion summary|completed|done)\s*(?::|[-\u2013\u2014]|\n|$)/i.test(text);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getChecklistProgress(ctx: TrelloCardContext): {
  total: number;
  completed: number;
  ratio: number;
} {
  const aptlssChecklist = ctx.checklists.find((c) =>
    c.name.toLowerCase().includes("aptlss")
  );
  if (!aptlssChecklist) return { total: 0, completed: 0, ratio: 0 };
  const total = aptlssChecklist.checkItems.length;
  const completed = aptlssChecklist.checkItems.filter(
    (i) => i.state === "complete"
  ).length;
  return { total, completed, ratio: total > 0 ? completed / total : 0 };
}

/**
 * Run the complete evidence assessment once and persist its compatible state,
 * priority, and versioned evidence snapshot as one coherent intelligence pass.
 */
export async function assessAndSaveCardIntelligence(
  ctx: TrelloCardContext,
  trigger: AssessmentTrigger = "manual",
  signals: {
    duplicateCardNames?: string[];
    planMissingNextAction?: boolean;
    steps?: Awaited<ReturnType<typeof getOpenStepsForCard>>;
    portfolio?: AptlssPortfolioSignal;
    runtime?: AptlssRuntimeSignal;
    forecast?: AptlssForecast;
    calibration?: AssessmentCalibrationContext;
    waiting?: AptlssWaitingSignal | null;
    externalEvidence?: AptlssExternalEvidenceSignal;
  } = {},
) {
  const steps = signals.steps ?? await getOpenStepsForCard(ctx.id);
  const waitingRecord = signals.waiting === undefined ? await getActiveWaitingReason(ctx.id) : null;
  const waiting = signals.waiting === undefined
    ? waitingRecord ? toAptlssWaitingSignal(waitingRecord) : null
    : signals.waiting;
  const dependentCardCount = signals.portfolio?.directDependentCount ?? await countDependentCards(ctx.id);
  const policy = await getOperationalPolicySnapshot();
  const assessment = assessAptlssCard({
    ctx,
    steps,
    dependentCardCount,
    trigger,
    duplicateCardNames: signals.duplicateCardNames,
    planMissingNextAction: signals.planMissingNextAction,
    portfolio: signals.portfolio,
    runtime: signals.runtime,
    forecast: signals.forecast,
    calibration: signals.calibration,
    waiting,
    externalEvidence: signals.externalEvidence,
    policy: {
      stallThresholdDays: policy.stallDetectionEnabled ? policy.stallThresholdDays : Number.MAX_SAFE_INTEGER,
      confidenceFlagThreshold: policy.confidenceFlaggingEnabled ? policy.confidenceFlagThreshold : 0,
    },
  });
  const progress = getChecklistProgress(ctx);
  const hasFinalSummary = ctx.comments.some((comment) => isFinalSummaryComment(comment.text));

  const stateRow: InsertCardState = {
    cardId: ctx.id,
    cardName: ctx.name,
    boardName: ctx.boardName,
    listName: ctx.listName,
    state: assessment.primaryState,
    stateReason: assessment.stateReason,
    daysSinceProgress: assessment.daysSinceMeaningfulProgress,
    hasUnansweredQuestion: assessment.secondarySignals.includes("inbound_question_unanswered"),
    isOverdue: assessment.secondarySignals.includes("overdue"),
    checklistComplete: progress.total > 0 && progress.completed === progress.total,
    hasFinalSummary,
    calculatedAt: new Date(assessment.assessedAt),
  };

  const openSteps = steps.filter((step) => step.status === "open");
  const completedSteps = steps.filter((step) => step.status === "complete");
  const priorityRow: InsertPriorityScore = {
    cardId: ctx.id,
    cardName: ctx.name,
    score: assessment.priorityScore,
    breakdown: JSON.stringify({
      ...assessment.priorityBreakdown,
      confidenceScore: assessment.confidenceScore,
      actionability: assessment.actionability,
      secondarySignals: assessment.secondarySignals,
      engineVersion: assessment.engineVersion,
      bottleneckScore: assessment.portfolio.bottleneckScore,
      forecastP50Minutes: assessment.forecast.calibratedP50Minutes,
      forecastP90Minutes: assessment.forecast.calibratedP90Minutes,
      trackedMinutes: assessment.runtime.trackedMinutes,
      waitingReasonId: assessment.waiting?.reasonId ?? null,
      waitingFollowUpAt: assessment.waiting?.followUpAt ?? null,
      waitingConfidenceScore: assessment.waiting?.confidenceScore ?? null,
    }),
    tier: assessment.priorityTier,
    estimatedRemainingMinutes: assessment.forecast.calibratedP50Minutes,
    openSteps: openSteps.length,
    completedSteps: completedSteps.length,
    calculatedAt: new Date(assessment.assessedAt),
  };

  await Promise.all([
    upsertCardState(stateRow),
    upsertPriorityScore(priorityRow),
    saveAssessmentSnapshot(ctx.name, assessment),
  ]);
  return assessment;
}

// ─── 1. Card State Machine ────────────────────────────────────────────────────

// ─── 2. Priority Scoring Engine ───────────────────────────────────────────────

// ─── 3. Trello Checklist Writer ───────────────────────────────────────────────

const CHECKLIST_NAME = "APTLSS Execution Checklist";
const TRELLO_API = "https://api.trello.com/1";

function trelloHeaders() {
  return { "Content-Type": "application/json" };
}

function trelloAuth() {
  return `key=${process.env.TrelloAPIKey ?? ''}&token=${process.env.TrelloAPIToken ?? ''}`;
}

/** Fetch the current APTLSS checklist for a card (null if none). */
async function getAptlssChecklist(
  checklists: TrelloCardContext["checklists"]
) {
  return (
    checklists.find((c) => c.name === CHECKLIST_NAME) ?? null
  );
}

/** Create a new APTLSS checklist on a card and add all steps. Returns checklist ID. */
async function createChecklist(
  cardId: string,
  steps: AptlssStepInput[]
): Promise<string> {
  const res = await fetch(
    `${TRELLO_API}/checklists?${trelloAuth()}`,
    {
      method: "POST",
      headers: trelloHeaders(),
      body: JSON.stringify({ idCard: cardId, name: CHECKLIST_NAME }),
    }
  );
  if (!res.ok) throw new Error(`Trello createChecklist failed: ${res.status}`);
  const checklist = await res.json();

  for (const step of steps) {
    await fetch(
      `${TRELLO_API}/checklists/${checklist.id}/checkItems?${trelloAuth()}`,
      {
        method: "POST",
        headers: trelloHeaders(),
        body: JSON.stringify({ name: step.title }),
      }
    );
  }

  return checklist.id;
}

/** Add a new check item to an existing checklist. Returns check item ID. */
async function addCheckItem(
  checklistId: string,
  title: string
): Promise<string> {
  const res = await fetch(
    `${TRELLO_API}/checklists/${checklistId}/checkItems?${trelloAuth()}`,
    {
      method: "POST",
      headers: trelloHeaders(),
      body: JSON.stringify({ name: title }),
    }
  );
  if (!res.ok) throw new Error(`Trello addCheckItem failed: ${res.status}`);
  const item = await res.json();
  return item.id;
}

/** Rename a check item (used to mark as [REPLACED]). */
async function renameCheckItem(
  cardId: string,
  checkItemId: string,
  newName: string
): Promise<void> {
  await fetch(
    `${TRELLO_API}/cards/${cardId}/checkItem/${checkItemId}?${trelloAuth()}`,
    {
      method: "PUT",
      headers: trelloHeaders(),
      body: JSON.stringify({ name: newName }),
    }
  );
}

/**
 * Write the APTLSS Execution Checklist to a Trello card.
 *
 * Safe update rules:
 *   - Completed items are NEVER deleted or renamed.
 *   - Manually added items (not in newSteps) are preserved.
 *   - Obsolete AI-generated items are renamed to "[REPLACED] <original>".
 *   - New steps are appended.
 *   - Returns a map of stepNumber → trelloCheckItemId.
 */
export async function writeChecklistToTrello(
  cardId: string,
  ctx: TrelloCardContext,
  newSteps: AptlssStepInput[]
): Promise<{ checklistId: string; stepCheckItemIds: Record<number, string> }> {
  const existing = await getAptlssChecklist(ctx.checklists);

  const stepCheckItemIds: Record<number, string> = {};

  if (!existing) {
    // No checklist yet — create fresh
    const checklistId = await createChecklist(cardId, newSteps);
    // Fetch the newly created checklist to get check item IDs
    const res = await fetch(
      `${TRELLO_API}/checklists/${checklistId}/checkItems?${trelloAuth()}`
    );
    if (res.ok) {
      const items: { id: string; name: string }[] = await res.json();
      newSteps.forEach((step, idx) => {
        if (items[idx]) stepCheckItemIds[step.stepNumber] = items[idx].id;
      });
    }
    return { checklistId, stepCheckItemIds };
  }

  // Checklist exists — smart merge
  const checklistId = existing.id;
  const existingItems = existing.checkItems;

  // GAP 1: Load manual (human-added) steps from DB so we never mark them as [REPLACED]
  const manualSteps = await getManualStepsForCard(cardId);
  const manualCheckItemIds = new Set(
    manualSteps.map((s) => s.trelloCheckItemId).filter(Boolean)
  );

  // Build sets for comparison
  const newTitles = new Set(newSteps.map((s) => s.title.trim()));
  const completedItems = existingItems.filter((i) => i.state === "complete");
  const completedTitles = new Set(completedItems.map((i) => i.name.trim()));

  // Mark obsolete AI items (not in newTitles, not completed, not manually added)
  for (const item of existingItems) {
    if (item.state === "complete") continue; // never touch completed
    if (newTitles.has(item.name.trim())) continue; // still relevant
    if (manualCheckItemIds.has(item.id)) continue; // human-added: preserve
    if (!item.name.startsWith("[REPLACED]")) {
      await renameCheckItem(cardId, item.id, `[REPLACED] ${item.name}`);
    }
  }

  // Add new steps that don't already exist
  for (const step of newSteps) {
    const alreadyExists = existingItems.find(
      (i) => i.name.trim() === step.title.trim()
    );
    if (alreadyExists) {
      stepCheckItemIds[step.stepNumber] = alreadyExists.id;
    } else if (!completedTitles.has(step.title.trim())) {
      const newId = await addCheckItem(checklistId, step.title);
      stepCheckItemIds[step.stepNumber] = newId;
    }
  }

  return { checklistId, stepCheckItemIds };
}
