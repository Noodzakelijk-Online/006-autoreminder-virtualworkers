import { queueCardReassessment } from "./aptlssReassessment";
import {
  autoStopAllRunningTimers,
  deleteTimeEntry,
  startTimer,
  stopTimer,
  updateTimeEntry,
} from "./db";
import { broadcast } from "./sse";
import { dateKeyInEat } from "../shared/eatTime";
import { refreshStoredComplianceTimeEvidence } from "./timeEvidence";

export type StartManagedTimerInput = {
  cardId: string;
  cardName: string;
  cardUrl: string;
  boardName: string;
  listName: string;
};

function refreshAffectedCards(cardIds: Iterable<string>) {
  for (const cardId of Array.from(new Set(cardIds))) queueCardReassessment(cardId, "timer");
}

async function refreshCurrentOvertimeEvidence() {
  const dateKey = dateKeyInEat();
  try {
    await refreshStoredComplianceTimeEvidence(dateKey, dateKey);
  } catch (error) {
    console.warn("[Timer] Could not refresh compliance overtime evidence:", error);
  }
}

export async function startManagedTimer(input: StartManagedTimerInput) {
  const entry = await startTimer(
    input.cardId,
    input.cardName,
    input.cardUrl,
    input.boardName,
    input.listName,
  );
  refreshAffectedCards([input.cardId, ...entry.stoppedCardIds]);
  await refreshCurrentOvertimeEvidence();
  broadcast("timer-invalidate");
  return entry;
}

export async function stopManagedTimer(cardId: string) {
  const entry = await stopTimer(cardId);
  if (entry) {
    refreshAffectedCards([entry.cardId]);
    await refreshCurrentOvertimeEvidence();
    broadcast("timer-invalidate");
  }
  return entry;
}

export async function deleteManagedTimeEntry(id: number) {
  const result = await deleteTimeEntry(id);
  refreshAffectedCards([result.cardId]);
  await refreshCurrentOvertimeEvidence();
  broadcast("timer-invalidate");
  return result;
}

export async function updateManagedTimeEntry(id: number, durationSeconds: number) {
  const result = await updateTimeEntry(id, durationSeconds);
  refreshAffectedCards([result.cardId]);
  await refreshCurrentOvertimeEvidence();
  broadcast("timer-invalidate");
  return result;
}

export async function autoStopManagedTimers(maxSeconds = 12 * 60 * 60) {
  const entries = await autoStopAllRunningTimers(maxSeconds);
  if (entries.length > 0) {
    refreshAffectedCards(entries.map((entry) => entry.cardId));
    await refreshCurrentOvertimeEvidence();
    broadcast("timer-invalidate");
  }
  return entries;
}
