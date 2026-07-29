import { getAllAptlssPlans } from "./aptlssDb";
import { getAllRunningTimers, getTimeEntriesSince } from "./db";
import { getEatDateKey, getSavedDailyPlan } from "./dailyPlan";
import { getAllReplyThreads } from "./replyMonitorDb";
import { getAllAptlssSteps, getAllCardStates } from "./aptlssStepsDb";
import { analyzeAptlssPortfolio } from "./aptlssPortfolio";
import { buildAptlssRuntimeAnalysis } from "./aptlssRuntime";
import { getAssessmentCalibration } from "./aptlssFeedbackDb";
import { APTLSS_ASSESSMENT_VERSION } from "./aptlssAssessment";
import { getActiveWaitingReason, toAptlssWaitingSignal } from "./aptlssWaitingReasonDb";
import { getAptlssExternalEvidenceForCard } from "./workspaceEvidenceDb";
import { getActiveTaskDependencies, mergeDependencyEdges } from "./taskDependenciesDb";

/** Load a coherent cross-system context for an on-demand card assessment. */
export async function loadAptlssIntelligenceForCard({
  cardId,
  cardName,
  nowMs = Date.now(),
}: {
  cardId: string;
  cardName: string;
  nowMs?: number;
}) {
  const [plans, allSteps, states, timeEntries, activeTimers, dailyPlan, assessmentCalibration, waitingRecord, externalEvidence, durableDependencies] = await Promise.all([
    getAllAptlssPlans(),
    getAllAptlssSteps(),
    getAllCardStates(),
    getTimeEntriesSince(new Date(nowMs - 90 * 86_400_000)),
    getAllRunningTimers(),
    getSavedDailyPlan(getEatDateKey()),
    getAssessmentCalibration(5_000, APTLSS_ASSESSMENT_VERSION),
    getActiveWaitingReason(cardId),
    getAptlssExternalEvidenceForCard(cardId),
    getActiveTaskDependencies(),
  ]);
  let replyThreads: Awaited<ReturnType<typeof getAllReplyThreads>> = [];
  try {
    replyThreads = await getAllReplyThreads(500);
  } catch {
    // Reply monitoring is additive evidence; Trello assessment remains usable.
  }

  const catalog = new Map(plans.map((plan) => [plan.cardId, { id: plan.cardId, name: plan.cardName }]));
  catalog.set(cardId, { id: cardId, name: cardName });
  const stateByCard = new Map(states.map((state) => [state.cardId, state.state]));
  const stepsByCard = new Map<string, typeof allSteps>();
  for (const step of allSteps) {
    stepsByCard.set(step.cardId, [...(stepsByCard.get(step.cardId) ?? []), step]);
  }
  const cards = Array.from(catalog.values());
  const portfolioCards = mergeDependencyEdges(cards.map((card) => ({
    ...card,
    state: stateByCard.get(card.id),
    steps: stepsByCard.get(card.id) ?? [],
  })), durableDependencies);
  const portfolio = analyzeAptlssPortfolio(portfolioCards);
  const runtime = buildAptlssRuntimeAnalysis({
    cardIds: cards.map((card) => card.id),
    steps: allSteps,
    timeEntries,
    activeTimers,
    replyThreads,
    scheduleBlocks: dailyPlan?.blocks ?? [],
    nowMs,
  });
  const cardRuntime = runtime.byCard.get(cardId);

  return {
    steps: stepsByCard.get(cardId) ?? [],
    portfolio: portfolio.byCard.get(cardId),
    runtime: cardRuntime?.runtime,
    forecast: cardRuntime?.forecast,
    calibration: assessmentCalibration,
    waiting: waitingRecord ? toAptlssWaitingSignal(waitingRecord) : null,
    externalEvidence,
    diagnostics: {
      dependencyCycles: portfolio.cycles.length,
      durableDependencyEdges: durableDependencies.length,
      orphanReferences: portfolio.orphanReferenceCount,
      effortCalibration: runtime.calibration,
    },
  };
}
