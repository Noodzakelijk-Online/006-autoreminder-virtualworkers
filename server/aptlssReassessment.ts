import type { AssessmentTrigger } from "./aptlssAssessment";
import { assessAndSaveCardIntelligence } from "./aptlssEngine";
import { loadAptlssIntelligenceForCard } from "./aptlssIntelligenceContext";
import { broadcast } from "./sse";
import { fetchCardContext } from "./trelloCardContext";

const inFlight = new Map<string, Promise<unknown>>();
const queued = new Map<string, AssessmentTrigger>();
const MAX_CONCURRENT_REASSESSMENTS = 2;
let activeQueuedReassessments = 0;

export function reassessCardById(cardId: string, trigger: AssessmentTrigger = "manual") {
  const existing = inFlight.get(cardId);
  if (existing) return existing;
  const task = (async () => {
    const apiKey = process.env.TrelloAPIKey;
    const apiToken = process.env.TrelloAPIToken;
    if (!apiKey || !apiToken) return null;
    const ctx = await fetchCardContext(cardId, apiKey, apiToken);
    const intelligence = await loadAptlssIntelligenceForCard({ cardId: ctx.id, cardName: ctx.name });
    return assessAndSaveCardIntelligence(ctx, trigger, {
      steps: intelligence.steps,
      portfolio: intelligence.portfolio,
      runtime: intelligence.runtime,
      forecast: intelligence.forecast,
      calibration: intelligence.calibration,
      waiting: intelligence.waiting,
      externalEvidence: intelligence.externalEvidence,
    });
  })().finally(() => inFlight.delete(cardId));
  inFlight.set(cardId, task);
  return task;
}

function drainReassessmentQueue() {
  while (activeQueuedReassessments < MAX_CONCURRENT_REASSESSMENTS && queued.size > 0) {
    const next = queued.entries().next().value as [string, AssessmentTrigger] | undefined;
    if (!next) return;
    const [cardId, trigger] = next;
    queued.delete(cardId);
    activeQueuedReassessments++;
    void reassessCardById(cardId, trigger).then((assessment) => {
      if (assessment) broadcast("aptlss-invalidate");
    }).catch((error) => {
      console.warn(`[APTLSS] Event-driven reassessment failed for ${cardId}:`, error instanceof Error ? error.message : String(error));
    }).finally(() => {
      activeQueuedReassessments--;
      drainReassessmentQueue();
    });
  }
}

/** Deduplicated, bounded queue for event-driven refreshes that should not block the caller. */
export function queueCardReassessment(cardId: string, trigger: AssessmentTrigger = "manual") {
  if (inFlight.has(cardId)) return;
  queued.set(cardId, trigger);
  drainReassessmentQueue();
}
