export type RuntimeStep = {
  id?: number;
  cardId: string;
  status: string;
  estimatedMinutes?: number | null;
  requiresRobert?: boolean | null;
  createdAt?: Date | string | null;
};

export type RuntimeTimeEntry = {
  cardId: string;
  aptlssStepId?: number | null;
  startedAt: Date | string;
  stoppedAt?: Date | string | null;
  durationSeconds?: number | null;
};

export type RuntimeReplyThread = {
  cardId: string;
  status: string;
  lastNonJoyceMsgAt?: Date | string | null;
  lastJoyceReplyAt?: Date | string | null;
};

export type RuntimeScheduleBlock = {
  cardId?: string | null;
  startTime?: string;
  endTime?: string;
  status?: string;
  state?: string;
};

export type EffortCalibration = {
  factor: number;
  sampleSize: number;
  confidence: "none" | "low" | "medium" | "high";
  medianAbsoluteDeviation: number | null;
};

export type AptlssRuntimeSignal = {
  trackedMinutes: number;
  recentTrackedMinutes: number;
  sessionCount: number;
  activeTimer: boolean;
  activeTimerMinutes: number;
  replyStatus: string | null;
  replyAgeHours: number | null;
  replyOverdue: boolean;
  openDecisionAgeHours: number | null;
  decisionStale: boolean;
  scheduledToday: boolean;
  scheduledMinutes: number;
  scheduleStatus: string | null;
  estimateOverrun: boolean;
};

export type AptlssForecast = {
  rawEstimatedRemainingMinutes: number;
  calibratedP50Minutes: number;
  calibratedP90Minutes: number;
  calibrationFactor: number;
  calibrationSampleSize: number;
  uncertainty: "low" | "medium" | "high";
};

export type AptlssRuntimeAnalysis = {
  calibration: EffortCalibration;
  byCard: Map<string, { runtime: AptlssRuntimeSignal; forecast: AptlssForecast }>;
};

const DAY_MS = 86_400_000;

function dateMs(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function minutesBetween(startTime?: string, endTime?: string) {
  const parse = (value?: string) => {
    const match = value?.match(/^(\d{1,2}):(\d{2})$/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const start = parse(startTime);
  const end = parse(endTime);
  return start == null || end == null ? 0 : Math.max(0, end - start);
}

export function calculateEffortCalibration(steps: RuntimeStep[], entries: RuntimeTimeEntry[]): EffortCalibration {
  const completedStepById = new Map(
    steps
      .filter((step) => step.id != null && step.status === "complete")
      .map((step) => [step.id!, step]),
  );
  const actualByStep = new Map<number, number>();
  for (const entry of entries) {
    if (!entry.stoppedAt || !entry.durationSeconds || entry.durationSeconds <= 0 || entry.aptlssStepId == null) continue;
    if (!completedStepById.has(entry.aptlssStepId)) continue;
    actualByStep.set(entry.aptlssStepId, (actualByStep.get(entry.aptlssStepId) ?? 0) + entry.durationSeconds / 60);
  }
  const directlyCalibratedCards = new Set<string>();
  const directRatios = Array.from(actualByStep.entries()).flatMap(([stepId, actual]) => {
    const step = completedStepById.get(stepId)!;
    const estimated = Math.max(0, step.estimatedMinutes ?? 0);
    if (estimated < 15 || actual < 5) return [];
    directlyCalibratedCards.add(step.cardId);
    return [clamp(actual / estimated, 0.5, 3)];
  });
  const completedEstimateByCard = new Map<string, number>();
  const cardsWithOpenWork = new Set(steps.filter((step) => step.status === "open").map((step) => step.cardId));
  for (const step of steps) {
    if (step.status !== "complete") continue;
    completedEstimateByCard.set(step.cardId, (completedEstimateByCard.get(step.cardId) ?? 0) + Math.max(0, step.estimatedMinutes ?? 0));
  }
  const trackedByCard = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.stoppedAt || !entry.durationSeconds || entry.durationSeconds <= 0) continue;
    if (entry.aptlssStepId != null) continue;
    trackedByCard.set(entry.cardId, (trackedByCard.get(entry.cardId) ?? 0) + entry.durationSeconds / 60);
  }
  const fallbackRatios = Array.from(completedEstimateByCard.entries())
    .flatMap(([cardId, estimated]) => {
      if (directlyCalibratedCards.has(cardId) || cardsWithOpenWork.has(cardId)) return [];
      const actual = trackedByCard.get(cardId) ?? 0;
      return estimated >= 15 && actual >= 5 ? [clamp(actual / estimated, 0.5, 3)] : [];
    });
  const ratios = [...directRatios, ...fallbackRatios];
  const rawMedian = median(ratios);
  const factor = rawMedian == null ? 1 : clamp(rawMedian, 0.65, 2.5);
  const deviations = ratios.map((ratio) => Math.abs(ratio - factor));
  return {
    factor: Math.round(factor * 100) / 100,
    sampleSize: ratios.length,
    confidence: ratios.length >= 12 ? "high" : ratios.length >= 6 ? "medium" : ratios.length >= 2 ? "low" : "none",
    medianAbsoluteDeviation: deviations.length ? Math.round((median(deviations) ?? 0) * 100) / 100 : null,
  };
}

export function buildAptlssRuntimeAnalysis({
  cardIds,
  steps,
  timeEntries,
  activeTimers = [],
  replyThreads = [],
  scheduleBlocks = [],
  nowMs = Date.now(),
}: {
  cardIds: string[];
  steps: RuntimeStep[];
  timeEntries: RuntimeTimeEntry[];
  activeTimers?: RuntimeTimeEntry[];
  replyThreads?: RuntimeReplyThread[];
  scheduleBlocks?: RuntimeScheduleBlock[];
  nowMs?: number;
}): AptlssRuntimeAnalysis {
  const calibration = calculateEffortCalibration(steps, timeEntries);
  const byCard = new Map<string, { runtime: AptlssRuntimeSignal; forecast: AptlssForecast }>();

  for (const cardId of cardIds) {
    const cardSteps = steps.filter((step) => step.cardId === cardId && step.status !== "obsolete" && step.status !== "replaced");
    const cardEntries = timeEntries.filter((entry) => entry.cardId === cardId && entry.stoppedAt && (entry.durationSeconds ?? 0) > 0);
    const activeTimer = activeTimers.find((entry) => entry.cardId === cardId && !entry.stoppedAt);
    const trackedMinutes = cardEntries.reduce((sum, entry) => sum + (entry.durationSeconds ?? 0) / 60, 0);
    const recentTrackedMinutes = cardEntries
      .filter((entry) => (dateMs(entry.startedAt) ?? 0) >= nowMs - 30 * DAY_MS)
      .reduce((sum, entry) => sum + (entry.durationSeconds ?? 0) / 60, 0);
    const reply = replyThreads
      .filter((thread) => thread.cardId === cardId)
      .sort((left, right) => (dateMs(right.lastNonJoyceMsgAt) ?? 0) - (dateMs(left.lastNonJoyceMsgAt) ?? 0))[0];
    const replyAgeHours = reply?.lastNonJoyceMsgAt ? Math.max(0, (nowMs - (dateMs(reply.lastNonJoyceMsgAt) ?? nowMs)) / 3_600_000) : null;
    const openDecisionDates = cardSteps
      .filter((step) => step.status === "open" && step.requiresRobert)
      .map((step) => dateMs(step.createdAt))
      .filter((value): value is number => value != null);
    const openDecisionAgeHours = openDecisionDates.length
      ? Math.max(0, (nowMs - Math.min(...openDecisionDates)) / 3_600_000)
      : null;
    const blocks = scheduleBlocks.filter((block) => block.cardId === cardId);
    const rawRemaining = cardSteps
      .filter((step) => step.status === "open")
      .reduce((sum, step) => sum + Math.max(0, step.estimatedMinutes ?? 15), 0);
    const totalEstimated = cardSteps.reduce((sum, step) => sum + Math.max(0, step.estimatedMinutes ?? 0), 0);
    const estimateOverrun = rawRemaining > 0 && totalEstimated > 0 && trackedMinutes > totalEstimated * 1.25;
    const p50 = Math.max(rawRemaining ? 5 : 0, Math.round(rawRemaining * calibration.factor));
    const uncertainty = calibration.confidence === "high" && !estimateOverrun ? "low"
      : calibration.confidence === "medium" && !estimateOverrun ? "medium"
        : "high";
    const p90Multiplier = uncertainty === "low" ? 1.3 : uncertainty === "medium" ? 1.5 : 1.8;
    const runtime: AptlssRuntimeSignal = {
      trackedMinutes: Math.round(trackedMinutes),
      recentTrackedMinutes: Math.round(recentTrackedMinutes),
      sessionCount: cardEntries.length,
      activeTimer: Boolean(activeTimer),
      activeTimerMinutes: activeTimer ? Math.max(0, Math.round((nowMs - (dateMs(activeTimer.startedAt) ?? nowMs)) / 60_000)) : 0,
      replyStatus: reply?.status ?? null,
      replyAgeHours: replyAgeHours == null ? null : Math.round(replyAgeHours * 10) / 10,
      replyOverdue: Boolean(reply && (reply.status === "overdue" || (reply.status === "pending" && (replyAgeHours ?? 0) >= 12))),
      openDecisionAgeHours: openDecisionAgeHours == null ? null : Math.round(openDecisionAgeHours * 10) / 10,
      decisionStale: (openDecisionAgeHours ?? 0) >= 24,
      scheduledToday: blocks.length > 0,
      scheduledMinutes: blocks.reduce((sum, block) => sum + minutesBetween(block.startTime, block.endTime), 0),
      scheduleStatus: blocks.find((block) => block.status === "active" || block.state === "active")?.status
        ?? blocks[0]?.status
        ?? blocks[0]?.state
        ?? null,
      estimateOverrun,
    };
    byCard.set(cardId, {
      runtime,
      forecast: {
        rawEstimatedRemainingMinutes: rawRemaining,
        calibratedP50Minutes: p50,
        calibratedP90Minutes: Math.max(p50, Math.round(p50 * p90Multiplier)),
        calibrationFactor: calibration.factor,
        calibrationSampleSize: calibration.sampleSize,
        uncertainty,
      },
    });
  }

  return { calibration, byCard };
}
