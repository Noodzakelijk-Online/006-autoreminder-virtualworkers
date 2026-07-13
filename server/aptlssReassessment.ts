import type { AssessmentTrigger } from "./aptlssAssessment";
import { assessAndSaveCardIntelligence } from "./aptlssEngine";
import { loadAptlssIntelligenceForCard } from "./aptlssIntelligenceContext";
import { fetchCardContext } from "./trelloCardContext";

const inFlight = new Map<string, Promise<unknown>>();

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

/** Fire-and-observe for local mutations that should not wait on Trello latency. */
export function queueCardReassessment(cardId: string, trigger: AssessmentTrigger = "manual") {
  void reassessCardById(cardId, trigger).catch((error) => {
    console.warn(`[APTLSS] Event-driven reassessment failed for ${cardId}:`, error instanceof Error ? error.message : String(error));
  });
}
