import { queueCardReassessment } from "./aptlssReassessment";
import {
  autoStopAllRunningTimers,
  deleteTimeEntry,
  startTimer,
  stopTimer,
  updateTimeEntry,
} from "./db";
import { broadcast } from "./sse";

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

export async function startManagedTimer(input: StartManagedTimerInput) {
  const entry = await startTimer(
    input.cardId,
    input.cardName,
    input.cardUrl,
    input.boardName,
    input.listName,
  );
  refreshAffectedCards([input.cardId, ...entry.stoppedCardIds]);
  broadcast("timer-invalidate");
  return entry;
}

export async function stopManagedTimer(cardId: string) {
  const entry = await stopTimer(cardId);
  if (entry) {
    refreshAffectedCards([entry.cardId]);
    broadcast("timer-invalidate");
  }
  return entry;
}

export async function deleteManagedTimeEntry(id: number) {
  const result = await deleteTimeEntry(id);
  refreshAffectedCards([result.cardId]);
  broadcast("timer-invalidate");
  return result;
}

export async function updateManagedTimeEntry(id: number, durationSeconds: number) {
  const result = await updateTimeEntry(id, durationSeconds);
  refreshAffectedCards([result.cardId]);
  broadcast("timer-invalidate");
  return result;
}

export async function autoStopManagedTimers(maxSeconds = 12 * 60 * 60) {
  const entries = await autoStopAllRunningTimers(maxSeconds);
  if (entries.length > 0) {
    refreshAffectedCards(entries.map((entry) => entry.cardId));
    broadcast("timer-invalidate");
  }
  return entries;
}
