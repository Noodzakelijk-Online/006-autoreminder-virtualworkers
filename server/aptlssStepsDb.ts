/**
 * DB helpers for the APTLSS operational engine:
 *   - aptlss_steps  (atomic work units synced with Trello checklist items)
 *   - card_states   (state machine per Trello card)
 *   - priority_scores (calculated priority per card)
 */
import { getDb } from "./db";
import {
  aptlssSteps,
  cardStates,
  priorityScores,
  InsertAptlssStep,
  InsertCardState,
  InsertPriorityScore,
} from "../drizzle/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { inferNonRobertStepCategory, stepRequiresRobertApproval } from "./aptlssApproval";

// ─── aptlss_steps ─────────────────────────────────────────────────────────────

/** Upsert a batch of steps for a card (replaces all non-manual, non-completed steps). */
export async function upsertAptlssSteps(
  cardId: string,
  newSteps: InsertAptlssStep[]
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Load existing steps to preserve manual and completed ones
  const existing = await db
    .select()
    .from(aptlssSteps)
    .where(eq(aptlssSteps.cardId, cardId));

  const manualOrDone = existing.filter(
    (s) => s.isManual || s.status === "complete"
  );
  const manualOrDoneCheckItemIds = new Set(
    manualOrDone.map((s) => s.trelloCheckItemId).filter(Boolean)
  );

  // Mark existing AI-generated open steps as obsolete
  const aiOpenIds = existing
    .filter((s) => !s.isManual && s.status === "open")
    .map((s) => s.id);
  if (aiOpenIds.length > 0) {
    await db
      .update(aptlssSteps)
      .set({ status: "obsolete" })
      .where(
        and(
          eq(aptlssSteps.cardId, cardId),
          inArray(aptlssSteps.id, aiOpenIds)
        )
      );
  }

  // Insert new steps (skip if trelloCheckItemId already exists as manual/done)
  const toInsert = newSteps.filter(
    (s) =>
      !s.trelloCheckItemId ||
      !manualOrDoneCheckItemIds.has(s.trelloCheckItemId)
  );
  if (toInsert.length > 0) {
    await db.insert(aptlssSteps).values(toInsert);
  }
}

/** Get all open (non-obsolete) steps for a card, ordered by stepNumber. */
export async function getOpenStepsForCard(cardId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(aptlssSteps)
    .where(
      and(
        eq(aptlssSteps.cardId, cardId),
        sql`${aptlssSteps.status} != 'obsolete'`
      )
    )
    .orderBy(aptlssSteps.stepNumber);
}

/** Load all current steps once for cross-card dependency and effort analysis. */
export async function getAllAptlssSteps() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(aptlssSteps)
    .where(inArray(aptlssSteps.status, ["open", "complete"]))
    .orderBy(aptlssSteps.cardId, aptlssSteps.stepNumber);
}

/** Get all manual (human-added) steps for a card — used to preserve them during checklist sync. */
export async function getManualStepsForCard(cardId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(aptlssSteps)
    .where(
      and(
        eq(aptlssSteps.cardId, cardId),
        eq(aptlssSteps.isManual, true)
      )
    );
}

/** Get all open steps requiring Robert across all cards. */
export async function getAllRobertDecisionSteps() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(aptlssSteps)
    .where(
      and(
        eq(aptlssSteps.requiresRobert, true),
        eq(aptlssSteps.status, "open")
      )
    )
    .orderBy(desc(aptlssSteps.createdAt));
}

/** Repair legacy rows where a sensitive word in the card title promoted every step to a Robert decision. */
export async function repairRobertDecisionStepFlags(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const candidates = await db
    .select()
    .from(aptlssSteps)
    .where(and(eq(aptlssSteps.requiresRobert, true), eq(aptlssSteps.status, "open")));
  let repaired = 0;
  for (const step of candidates) {
    const knownOperationalFallback = /^(?:Extract|Add clear|Identify|Complete|Verify|Post or prepare)\b/i.test(step.title)
      && !step.recommendedDecision?.trim();
    const stillRequiresRobert = !knownOperationalFallback && stepRequiresRobertApproval({
      title: step.title,
      completionCriteria: step.completionCriteria,
      category: step.category,
      requiresRobert: step.requiresRobert,
      recommendedDecision: step.recommendedDecision,
    }, { trustCategory: false, trustExplicit: false });
    if (stillRequiresRobert) continue;
    await db.update(aptlssSteps).set({
      requiresRobert: false,
      category: inferNonRobertStepCategory(step.title),
      recommendedDecision: null,
    }).where(eq(aptlssSteps.id, step.id));
    repaired++;
  }
  return repaired;
}

/** Mark a step as complete by its Trello check-item ID. */
export async function completeStepByCheckItemId(
  trelloCheckItemId: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(aptlssSteps)
    .set({ status: "complete", completedAt: new Date() })
    .where(eq(aptlssSteps.trelloCheckItemId, trelloCheckItemId));
}

/** Mark one or more internal APTLSS steps as complete by database ID. */
export async function completeStepsByIds(stepIds: number[]): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const ids = Array.from(
    new Set(stepIds.filter((id) => Number.isInteger(id) && id > 0))
  );
  if (ids.length === 0) return 0;

  await db
    .update(aptlssSteps)
    .set({ status: "complete", completedAt: new Date() })
    .where(inArray(aptlssSteps.id, ids));

  return ids.length;
}

/** Mark a step as open (unchecked) by its Trello check-item ID. */
export async function uncompleteStepByCheckItemId(
  trelloCheckItemId: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(aptlssSteps)
    .set({ status: "open", completedAt: null })
    .where(eq(aptlssSteps.trelloCheckItemId, trelloCheckItemId));
}

/** Set a current step's completion state from the Power-Up card view. */
export async function setStepCompletionByCardAndNumber(
  cardId: string,
  stepNumber: number,
  complete: boolean,
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({ id: aptlssSteps.id })
    .from(aptlssSteps)
    .where(and(
      eq(aptlssSteps.cardId, cardId),
      eq(aptlssSteps.stepNumber, stepNumber),
      inArray(aptlssSteps.status, ["open", "complete"]),
    ))
    .orderBy(desc(aptlssSteps.updatedAt))
    .limit(1);
  if (!rows[0]) return false;

  await db
    .update(aptlssSteps)
    .set({
      status: complete ? "complete" : "open",
      completedAt: complete ? new Date() : null,
      lastSyncedAt: new Date(),
    })
    .where(eq(aptlssSteps.id, rows[0].id));
  return true;
}

/** Mark a Robert-required step as resolved (removes from Decision Queue). */
export async function resolveRobertStep(stepId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(aptlssSteps)
    .set({ requiresRobert: false, status: "complete", completedAt: new Date() })
    .where(eq(aptlssSteps.id, stepId));
}

/** Get progress summary for a card: { total, completed, openRobert, openBlocked, estimatedRemainingMinutes } */
export async function getCardStepProgress(cardId: string) {
  const steps = await getOpenStepsForCard(cardId);
  const total = steps.filter((s) => s.status !== "obsolete").length;
  const completed = steps.filter((s) => s.status === "complete").length;
  const openSteps = steps.filter((s) => s.status === "open");
  const openRobert = openSteps.filter((s) => s.requiresRobert).length;
  const openBlocked = openSteps.filter((s) => !!s.blockedBy).length;
  const estimatedRemainingMinutes = openSteps.reduce(
    (sum, s) => sum + (s.estimatedMinutes ?? 15),
    0
  );
  return { total, completed, openRobert, openBlocked, estimatedRemainingMinutes };
}

// ─── card_states ──────────────────────────────────────────────────────────────

/** Upsert the computed state for a card. */
export async function upsertCardState(state: InsertCardState): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(cardStates).values(state).onDuplicateKeyUpdate({
    set: {
      cardName: state.cardName ?? "",
      boardName: state.boardName ?? "",
      listName: state.listName ?? "",
      state: state.state ?? "NEW_UNTRIAGED",
      stateReason: state.stateReason ?? null,
      daysSinceProgress: state.daysSinceProgress ?? 0,
      hasUnansweredQuestion: state.hasUnansweredQuestion ?? false,
      isOverdue: state.isOverdue ?? false,
      checklistComplete: state.checklistComplete ?? false,
      hasFinalSummary: state.hasFinalSummary ?? false,
      calculatedAt: state.calculatedAt ?? new Date(),
    },
  });
}

/** Get the current state for a card (null if never computed). */
export async function getCardState(cardId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(cardStates)
    .where(eq(cardStates.cardId, cardId))
    .limit(1);
  return rows[0] ?? null;
}

/** Get all card states. */
export async function getAllCardStates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cardStates).orderBy(desc(cardStates.calculatedAt));
}

// ─── priority_scores ──────────────────────────────────────────────────────────

/** Upsert the priority score for a card. */
export async function upsertPriorityScore(
  score: InsertPriorityScore
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(priorityScores).values(score).onDuplicateKeyUpdate({
    set: {
      cardName: score.cardName ?? "",
      score: score.score ?? 0,
      breakdown: score.breakdown ?? null,
      tier: score.tier ?? "MEDIUM",
      estimatedRemainingMinutes: score.estimatedRemainingMinutes ?? 0,
      openSteps: score.openSteps ?? 0,
      completedSteps: score.completedSteps ?? 0,
      calculatedAt: score.calculatedAt ?? new Date(),
    },
  });
}

/** Get the priority score for a card (null if never computed). */
export async function getPriorityScore(cardId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(priorityScores)
    .where(eq(priorityScores.cardId, cardId))
    .limit(1);
  return rows[0] ?? null;
}

/** Get all priority scores, ordered by score descending. */
export async function getAllPriorityScores() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(priorityScores)
    .orderBy(desc(priorityScores.score));
}

/** Count how many OTHER cards have this card's ID in their dependsOnCards JSON field.
 * Used for dependencyImpact in priority scoring: more cards blocked by this one → higher score.
 * dependsOnCards is stored as a JSON string array e.g. '["abc123","def456"]'
 */
export async function countDependentCards(cardId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .selectDistinct({ depCardId: aptlssSteps.cardId })
    .from(aptlssSteps)
    .where(
      and(
        sql`${aptlssSteps.dependsOnCards} LIKE ${`%"${cardId}"%`}`,
        sql`${aptlssSteps.cardId} != ${cardId}`,
        sql`${aptlssSteps.status} != 'obsolete'`
      )
    );
  return rows.length;
}

/** Get all card states where state = NEEDS_RESTRUCTURING (cards needing repair). */
export async function getNeedsRepairCards() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(cardStates)
    .where(eq(cardStates.state, "NEEDS_RESTRUCTURING"))
    .orderBy(desc(cardStates.calculatedAt));
}

/** Get all card states where state = READY_FOR_DONE (cards ready to move to Done). */
export async function getReadyForDoneCards() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(cardStates)
    .where(eq(cardStates.state, "READY_FOR_DONE"))
    .orderBy(desc(cardStates.calculatedAt));
}
