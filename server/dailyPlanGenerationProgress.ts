import { randomUUID } from "node:crypto";

export type DailyPlanGenerationPhase =
  | "preflight"
  | "constraints"
  | "work_context"
  | "time_context"
  | "ai_planning"
  | "normalizing"
  | "persisting"
  | "reconciling"
  | "complete"
  | "failed";

export type DailyPlanGenerationStatus = "idle" | "running" | "completed" | "failed";

export type DailyPlanGenerationProgress = {
  runId: string | null;
  dateKey: string;
  status: DailyPlanGenerationStatus;
  phase: DailyPlanGenerationPhase | null;
  percent: number;
  label: string;
  detail: string;
  currentStep: number;
  totalSteps: number;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
  elapsedSeconds: number;
  etaLowerSeconds: number | null;
  etaUpperSeconds: number | null;
  isTakingLongerThanExpected: boolean;
  errorMessage: string | null;
};

type PhaseDefinition = {
  percent: number;
  step: number;
  label: string;
  detail: string;
  expectedSeconds: [number, number];
};

const TOTAL_STEPS = 8;
const RETENTION_MS = 10 * 60 * 1000;
const MAX_RECORDS = 30;

const phases: Record<Exclude<DailyPlanGenerationPhase, "complete" | "failed">, PhaseDefinition> = {
  preflight: {
    percent: 4,
    step: 1,
    label: "Checking planner readiness",
    detail: "Verifying permissions, Trello access, and saved-plan state.",
    expectedSeconds: [12, 90],
  },
  constraints: {
    percent: 10,
    step: 2,
    label: "Loading day constraints",
    detail: "Protecting working hours, breaks, and non-working periods.",
    expectedSeconds: [10, 75],
  },
  work_context: {
    percent: 24,
    step: 3,
    label: "Collecting work context",
    detail: "Reading APTLSS priorities, Trello cards, blockers, and Robert decisions.",
    expectedSeconds: [8, 65],
  },
  time_context: {
    percent: 38,
    step: 4,
    label: "Checking capacity",
    detail: "Reconciling tracked time and the remaining daily target.",
    expectedSeconds: [7, 55],
  },
  ai_planning: {
    percent: 52,
    step: 5,
    label: "Building the work sequence",
    detail: "Sequencing the strongest next actions and reviewing the schedule.",
    expectedSeconds: [10, 120],
  },
  normalizing: {
    percent: 82,
    step: 6,
    label: "Validating the timeline",
    detail: "Removing overlaps, protecting breaks, and assigning unscheduled work.",
    expectedSeconds: [4, 22],
  },
  persisting: {
    percent: 91,
    step: 7,
    label: "Saving the plan",
    detail: "Persisting the validated schedule and its audit record.",
    expectedSeconds: [3, 15],
  },
  reconciling: {
    percent: 96,
    step: 8,
    label: "Finalizing plan health",
    detail: "Refreshing time reconciliation and the final readiness signals.",
    expectedSeconds: [2, 12],
  },
};
const phaseOrder = Object.keys(phases) as Array<Exclude<DailyPlanGenerationPhase, "complete" | "failed">>;

type StoredProgress = DailyPlanGenerationProgress & {
  phaseStartedAtMs: number;
};

const progressByDate = new Map<string, StoredProgress>();

function nowIso() {
  return new Date().toISOString();
}

function pruneProgressRecords() {
  const now = Date.now();
  progressByDate.forEach((progress, dateKey) => {
    if (progress.status !== "running" && now - Date.parse(progress.updatedAt) > RETENTION_MS) {
      progressByDate.delete(dateKey);
    }
  });

  if (progressByDate.size <= MAX_RECORDS) return;
  const oldest = Array.from(progressByDate.entries())
    .filter(([, progress]) => progress.status !== "running")
    .sort((left, right) => Date.parse(left[1].updatedAt) - Date.parse(right[1].updatedAt));
  for (const [dateKey] of oldest.slice(0, progressByDate.size - MAX_RECORDS)) {
    progressByDate.delete(dateKey);
  }
}

function withTiming(progress: StoredProgress): DailyPlanGenerationProgress {
  const elapsedSeconds = progress.startedAt
    ? Math.max(0, Math.floor((Date.now() - Date.parse(progress.startedAt)) / 1000))
    : 0;
  if (progress.status !== "running" || !progress.phase || progress.phase === "complete" || progress.phase === "failed") {
    return { ...progress, elapsedSeconds, etaLowerSeconds: 0, etaUpperSeconds: 0 };
  }

  const definition = phases[progress.phase];
  const phaseElapsed = Math.max(0, Math.floor((Date.now() - progress.phaseStartedAtMs) / 1000));
  const phaseIndex = phaseOrder.indexOf(progress.phase);
  const futureDefinitions = phaseIndex >= 0
    ? phaseOrder.slice(phaseIndex + 1).map((phase) => phases[phase])
    : [];
  return {
    ...progress,
    elapsedSeconds,
    etaLowerSeconds: Math.max(0, definition.expectedSeconds[0] - phaseElapsed)
      + futureDefinitions.reduce((sum, phase) => sum + phase.expectedSeconds[0], 0),
    etaUpperSeconds: Math.max(0, definition.expectedSeconds[1] - phaseElapsed)
      + futureDefinitions.reduce((sum, phase) => sum + phase.expectedSeconds[1], 0),
    isTakingLongerThanExpected: phaseElapsed > definition.expectedSeconds[1],
  };
}

export function startDailyPlanGeneration(dateKey: string): DailyPlanGenerationProgress {
  pruneProgressRecords();
  const timestamp = nowIso();
  const definition = phases.preflight;
  const progress: StoredProgress = {
    runId: randomUUID(),
    dateKey,
    status: "running",
    phase: "preflight",
    percent: definition.percent,
    label: definition.label,
    detail: definition.detail,
    currentStep: definition.step,
    totalSteps: TOTAL_STEPS,
    startedAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    elapsedSeconds: 0,
    etaLowerSeconds: definition.expectedSeconds[0],
    etaUpperSeconds: definition.expectedSeconds[1],
    isTakingLongerThanExpected: false,
    errorMessage: null,
    phaseStartedAtMs: Date.now(),
  };
  progressByDate.set(dateKey, progress);
  return withTiming(progress);
}

export function updateDailyPlanGeneration(
  dateKey: string,
  runId: string,
  phase: Exclude<DailyPlanGenerationPhase, "complete" | "failed">,
  detail?: string,
): DailyPlanGenerationProgress | null {
  const current = progressByDate.get(dateKey);
  if (!current || current.runId !== runId || current.status !== "running") return null;

  const definition = phases[phase];
  const timestamp = nowIso();
  const next: StoredProgress = {
    ...current,
    phase,
    percent: Math.max(current.percent, definition.percent),
    label: definition.label,
    detail: detail ?? definition.detail,
    currentStep: Math.max(current.currentStep, definition.step),
    updatedAt: timestamp,
    phaseStartedAtMs: current.phase === phase ? current.phaseStartedAtMs : Date.now(),
  };
  progressByDate.set(dateKey, next);
  return withTiming(next);
}

export function completeDailyPlanGeneration(dateKey: string, runId: string): DailyPlanGenerationProgress | null {
  const current = progressByDate.get(dateKey);
  if (!current || current.runId !== runId) return null;
  const timestamp = nowIso();
  const next: StoredProgress = {
    ...current,
    status: "completed",
    phase: "complete",
    percent: 100,
    label: "Plan ready",
    detail: "The plan is saved and ready to use.",
    currentStep: TOTAL_STEPS,
    updatedAt: timestamp,
    completedAt: timestamp,
    etaLowerSeconds: 0,
    etaUpperSeconds: 0,
    isTakingLongerThanExpected: false,
    phaseStartedAtMs: Date.now(),
  };
  progressByDate.set(dateKey, next);
  return withTiming(next);
}

export function failDailyPlanGeneration(
  dateKey: string,
  runId: string,
  error: unknown,
): DailyPlanGenerationProgress | null {
  const current = progressByDate.get(dateKey);
  if (!current || current.runId !== runId) return null;
  const timestamp = nowIso();
  const message = error instanceof Error ? error.message : String(error);
  const next: StoredProgress = {
    ...current,
    status: "failed",
    phase: "failed",
    label: "Plan generation stopped",
    detail: "The planner could not complete this run.",
    updatedAt: timestamp,
    completedAt: timestamp,
    etaLowerSeconds: 0,
    etaUpperSeconds: 0,
    errorMessage: message,
    phaseStartedAtMs: Date.now(),
  };
  progressByDate.set(dateKey, next);
  return withTiming(next);
}

export function getDailyPlanGenerationProgress(dateKey: string): DailyPlanGenerationProgress {
  pruneProgressRecords();
  const progress = progressByDate.get(dateKey);
  if (progress) return withTiming(progress);
  const timestamp = nowIso();
  return {
    runId: null,
    dateKey,
    status: "idle",
    phase: null,
    percent: 0,
    label: "Planner idle",
    detail: "Generate a plan to begin.",
    currentStep: 0,
    totalSteps: TOTAL_STEPS,
    startedAt: null,
    updatedAt: timestamp,
    completedAt: null,
    elapsedSeconds: 0,
    etaLowerSeconds: null,
    etaUpperSeconds: null,
    isTakingLongerThanExpected: false,
    errorMessage: null,
  };
}

export function resetDailyPlanGenerationProgressForTests() {
  progressByDate.clear();
}
