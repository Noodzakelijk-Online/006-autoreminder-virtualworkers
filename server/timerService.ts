import { queueCardReassessment } from "./aptlssReassessment";
import { autoStopAllRunningTimers, startTimer, stopTimer } from "./db";
import { broadcast } from "./sse";
import { dateKeyInEat, timeKeyInEat } from "../shared/eatTime";
import { refreshStoredComplianceTimeEvidence } from "./timeEvidence";
import {
  correctTimeEntry,
  createManualTimeEntry,
  markTimeDayNeedsReview,
  recordTimeEntryEvent,
  voidTimeEntry,
  type ManualTimeEntryInput,
  type TimeCategory,
} from "./timeAccountability";
import { getSavedDailyPlan } from "./dailyPlan";

export type StartManagedTimerInput = {
  cardId: string;
  cardName: string;
  cardUrl: string;
  boardName: string;
  listName: string;
  source?: string;
  category?: TimeCategory;
  planDateKey?: string | null;
  planBlockId?: string | null;
  aptlssStepId?: number | null;
  notes?: string | null;
};

function refreshAffectedCards(cardIds: Iterable<string>) {
  for (const cardId of Array.from(new Set(cardIds)))
    queueCardReassessment(cardId, "timer");
}

async function refreshCurrentOvertimeEvidence(dateKey = dateKeyInEat()) {
  try {
    await refreshStoredComplianceTimeEvidence(dateKey, dateKey);
  } catch (error) {
    console.warn(
      "[Timer] Could not refresh compliance overtime evidence:",
      error
    );
  }
}

async function enrichWithCurrentPlan(
  input: StartManagedTimerInput
): Promise<StartManagedTimerInput> {
  if (input.planBlockId) return input;
  const dateKey = dateKeyInEat();
  try {
    const plan = await getSavedDailyPlan(dateKey);
    if (!plan) return input;
    const minute = (value: string) => {
      const [hour, part] = value.split(":").map(Number);
      return hour * 60 + part;
    };
    const now = minute(timeKeyInEat());
    const candidates = plan.blocks.filter(
      block =>
        block.cardId === input.cardId &&
        !["done", "skipped"].includes(block.status)
    );
    const block =
      candidates.find(item => item.status === "active") ??
      candidates.find(
        item => minute(item.startTime) <= now && minute(item.endTime) > now
      ) ??
      candidates.sort(
        (left, right) => minute(left.startTime) - minute(right.startTime)
      )[0];
    if (!block) return input;
    const action = `${block.cardName} ${block.action}`.toLowerCase();
    const category =
      input.category ??
      (/email|reply|message|communication/.test(action)
        ? "communication"
        : /meeting|call/.test(action)
          ? "meeting"
          : /admin|review|planning/.test(action)
            ? "administration"
            : "client_work");
    return {
      ...input,
      category,
      planDateKey: dateKey,
      planBlockId: block.id,
      aptlssStepId: input.aptlssStepId ?? block.stepIds[0] ?? null,
      notes: input.notes ?? block.action,
    };
  } catch (error) {
    console.warn(
      "[Timer] Could not link timer to the current daily plan:",
      error
    );
    return input;
  }
}

export async function startManagedTimer(input: StartManagedTimerInput) {
  const linkedInput = await enrichWithCurrentPlan(input);
  const entry = await startTimer(
    linkedInput.cardId,
    linkedInput.cardName,
    linkedInput.cardUrl,
    linkedInput.boardName,
    linkedInput.listName,
    {
      source: linkedInput.source,
      category: linkedInput.category,
      planDateKey: linkedInput.planDateKey,
      planBlockId: linkedInput.planBlockId,
      aptlssStepId: linkedInput.aptlssStepId,
      notes: linkedInput.notes,
    }
  );
  refreshAffectedCards([linkedInput.cardId, ...entry.stoppedCardIds]);
  await markTimeDayNeedsReview(dateKeyInEat());
  await refreshCurrentOvertimeEvidence();
  broadcast("timer-invalidate");
  return entry;
}

export async function stopManagedTimer(cardId: string) {
  const entry = await stopTimer(cardId);
  if (entry) {
    refreshAffectedCards([entry.cardId]);
    await markTimeDayNeedsReview(dateKeyInEat(entry.startedAt));
    await refreshCurrentOvertimeEvidence();
    broadcast("timer-invalidate");
  }
  return entry;
}

export async function deleteManagedTimeEntry(id: number, reason: string) {
  const result = await voidTimeEntry(id, reason);
  refreshAffectedCards([result.cardId]);
  await refreshCurrentOvertimeEvidence(dateKeyInEat(result.startedAt));
  broadcast("timer-invalidate");
  return result;
}

export async function updateManagedTimeEntry(
  id: number,
  durationSeconds: number,
  reason: string
) {
  const result = await correctTimeEntry(id, durationSeconds, reason);
  refreshAffectedCards([result.cardId]);
  await refreshCurrentOvertimeEvidence(dateKeyInEat(result.startedAt));
  broadcast("timer-invalidate");
  return result;
}

export async function createManagedManualTimeEntry(
  input: ManualTimeEntryInput
) {
  const result = await createManualTimeEntry(input);
  refreshAffectedCards([result.cardId]);
  await refreshCurrentOvertimeEvidence(input.dateKey);
  broadcast("timer-invalidate");
  return result;
}

export async function autoStopManagedTimers(maxSeconds = 12 * 60 * 60) {
  const entries = await autoStopAllRunningTimers(maxSeconds);
  if (entries.length > 0) {
    await Promise.all(
      entries.flatMap(entry => [
        recordTimeEntryEvent({
          timeEntryId: entry.id,
          eventType: entry.wasCapped ? "auto_stopped_capped" : "auto_stopped",
          reason: entry.wasCapped
            ? `Automatic safety cap at ${maxSeconds} seconds`
            : "Automatic timer safety stop",
          after: {
            stoppedAt: entry.stoppedAt,
            durationSeconds: entry.durationSeconds,
          },
        }),
        markTimeDayNeedsReview(dateKeyInEat(entry.startedAt)),
      ])
    );
    refreshAffectedCards(entries.map(entry => entry.cardId));
    await refreshCurrentOvertimeEvidence();
    broadcast("timer-invalidate");
  }
  return entries;
}
