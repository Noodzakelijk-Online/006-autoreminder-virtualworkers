import { randomUUID } from "node:crypto";

export type MaintenanceJobKey =
  | "aptlss_maintenance"
  | "workspace_ingestion"
  | "reply_monitor"
  | "eod_compliance"
  | "weekly_analysis";
export type MaintenanceJobPhase =
  | "preflight"
  | "fact_check"
  | "browser_evidence"
  | "collecting"
  | "analyzing"
  | "ai_review"
  | "source_sync"
  | "linking"
  | "persisting"
  | "notifications"
  | "complete"
  | "failed";

export type MaintenanceJobProgressReporter = (
  phase: Exclude<MaintenanceJobPhase, "complete" | "failed">,
  detail?: string,
  percent?: number,
) => void;

export type MaintenanceJobProgress = {
  runId: string | null;
  jobKey: MaintenanceJobKey;
  status: "idle" | "running" | "completed" | "failed";
  phase: MaintenanceJobPhase | null;
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

export function calibrateMaintenanceProgressEta(
  progress: MaintenanceJobProgress,
  averageDurationMs: number | null,
): MaintenanceJobProgress {
  if (
    progress.status !== "running"
    || averageDurationMs == null
    || !Number.isFinite(averageDurationMs)
    || averageDurationMs <= 0
  ) {
    return progress;
  }

  const historicalSeconds = Math.max(1, Math.round(averageDurationMs / 1_000));
  const lowerCompletionSeconds = Math.max(1, Math.round(historicalSeconds * 0.75));
  const upperCompletionSeconds = Math.max(lowerCompletionSeconds, Math.round(historicalSeconds * 1.25));

  return {
    ...progress,
    etaLowerSeconds: Math.max(0, lowerCompletionSeconds - progress.elapsedSeconds),
    etaUpperSeconds: Math.max(0, upperCompletionSeconds - progress.elapsedSeconds),
    isTakingLongerThanExpected: progress.elapsedSeconds > upperCompletionSeconds,
  };
}

type PhaseDefinition = {
  percent: number;
  step: number;
  label: string;
  detail: string;
  expectedSeconds: [number, number];
};

const jobDefinitions: Record<MaintenanceJobKey, {
  totalSteps: number;
  phases: Partial<Record<Exclude<MaintenanceJobPhase, "complete" | "failed">, PhaseDefinition>>;
}> = {
  aptlss_maintenance: {
    totalSteps: 6,
    phases: {
      preflight: { percent: 4, step: 1, label: "Checking APTLSS readiness", detail: "Verifying Trello access and the maintenance lease.", expectedSeconds: [5, 30] },
      collecting: { percent: 14, step: 2, label: "Collecting card intelligence", detail: "Loading Trello cards, saved plans, evidence, timers, and current states.", expectedSeconds: [10, 90] },
      analyzing: { percent: 30, step: 3, label: "Reassessing active cards", detail: "Refreshing stale assessments and priority signals.", expectedSeconds: [20, 300] },
      ai_review: { percent: 76, step: 4, label: "Preparing plans and follow-ups", detail: "Generating missing plans and approval-gated follow-up drafts.", expectedSeconds: [10, 180] },
      persisting: { percent: 92, step: 5, label: "Saving portfolio signals", detail: "Recording performance, dependencies, and maintenance audit evidence.", expectedSeconds: [5, 45] },
      notifications: { percent: 97, step: 6, label: "Finalizing APTLSS maintenance", detail: "Refreshing queues and completing the scheduled-job record.", expectedSeconds: [2, 20] },
    },
  },
  workspace_ingestion: {
    totalSteps: 5,
    phases: {
      preflight: { percent: 5, step: 1, label: "Checking workspace connections", detail: "Verifying the read-only Google and Trello sources.", expectedSeconds: [4, 25] },
      source_sync: { percent: 18, step: 2, label: "Indexing workspace sources", detail: "Reading Gmail, Google Drive, and Trello evidence in parallel.", expectedSeconds: [15, 180] },
      linking: { percent: 70, step: 3, label: "Connecting evidence to cards", detail: "Matching new evidence to APTLSS cards and preserving reviewed links.", expectedSeconds: [8, 75] },
      analyzing: { percent: 86, step: 4, label: "Queueing reassessments", detail: "Scheduling intelligence refreshes for materially changed card context.", expectedSeconds: [4, 30] },
      persisting: { percent: 96, step: 5, label: "Finalizing the evidence index", detail: "Saving the run summary and refreshing dashboard evidence.", expectedSeconds: [2, 15] },
    },
  },
  reply_monitor: {
    totalSteps: 5,
    phases: {
      preflight: { percent: 5, step: 1, label: "Checking communication sources", detail: "Verifying the reply-monitor lease and available connections.", expectedSeconds: [3, 20] },
      collecting: { percent: 18, step: 2, label: "Reading message threads", detail: "Scanning supported Trello and connected communication threads.", expectedSeconds: [10, 120] },
      analyzing: { percent: 58, step: 3, label: "Evaluating response evidence", detail: "Checking response deadlines, vague replies, and missing signatures.", expectedSeconds: [8, 75] },
      notifications: { percent: 84, step: 4, label: "Preparing communication exceptions", detail: "Creating any required owner alerts without sending replies.", expectedSeconds: [4, 35] },
      persisting: { percent: 96, step: 5, label: "Saving reply-monitor results", detail: "Recording scan freshness and refreshing the inbox.", expectedSeconds: [2, 15] },
    },
  },
  eod_compliance: {
    totalSteps: 5,
    phases: {
      preflight: { percent: 5, step: 1, label: "Checking the workday", detail: "Confirming the date and scheduled-run lease.", expectedSeconds: [3, 20] },
      fact_check: { percent: 18, step: 2, label: "Fact-checking daily compliance", detail: "Verifying Trello activity, communication evidence, and recorded outcomes.", expectedSeconds: [10, 90] },
      browser_evidence: { percent: 68, step: 3, label: "Checking browser organization", detail: "Reading the end-of-day browser-tab evidence.", expectedSeconds: [5, 35] },
      notifications: { percent: 84, step: 4, label: "Preparing exceptions", detail: "Creating any required owner warnings without changing work records.", expectedSeconds: [3, 25] },
      persisting: { percent: 95, step: 5, label: "Saving the EOD result", detail: "Finalizing the durable scheduled-job record.", expectedSeconds: [2, 15] },
    },
  },
  weekly_analysis: {
    totalSteps: 6,
    phases: {
      preflight: { percent: 5, step: 1, label: "Checking the analysis window", detail: "Confirming the week and scheduled-run lease.", expectedSeconds: [3, 20] },
      collecting: { percent: 18, step: 2, label: "Collecting weekly evidence", detail: "Loading APTLSS plans, card states, and priority scores.", expectedSeconds: [8, 60] },
      analyzing: { percent: 38, step: 3, label: "Finding performance patterns", detail: "Calculating stalled work, overdue commitments, blockers, and scope issues.", expectedSeconds: [5, 35] },
      ai_review: { percent: 55, step: 4, label: "Reviewing process improvements", detail: "Using the configured model to verify evidence-grounded improvements.", expectedSeconds: [10, 120] },
      persisting: { percent: 88, step: 5, label: "Saving the weekly analysis", detail: "Persisting the snapshot and audit evidence.", expectedSeconds: [3, 20] },
      notifications: { percent: 96, step: 6, label: "Finalizing the weekly result", detail: "Refreshing dashboards and completing the scheduled-job record.", expectedSeconds: [2, 15] },
    },
  },
};

type StoredProgress = MaintenanceJobProgress & { phaseStartedAtMs: number };
const progressByJob = new Map<MaintenanceJobKey, StoredProgress>();

function withTiming(progress: StoredProgress): MaintenanceJobProgress {
  const elapsedSeconds = progress.startedAt
    ? Math.max(0, Math.floor((Date.now() - Date.parse(progress.startedAt)) / 1000))
    : 0;
  if (progress.status !== "running" || !progress.phase || progress.phase === "complete" || progress.phase === "failed") {
    return { ...progress, elapsedSeconds, etaLowerSeconds: 0, etaUpperSeconds: 0 };
  }
  const definition = jobDefinitions[progress.jobKey].phases[progress.phase];
  if (!definition) return { ...progress, elapsedSeconds };
  const phaseElapsed = Math.max(0, Math.floor((Date.now() - progress.phaseStartedAtMs) / 1000));
  const orderedPhases = Object.entries(jobDefinitions[progress.jobKey].phases);
  const phaseIndex = orderedPhases.findIndex(([phase]) => phase === progress.phase);
  const futureDefinitions = phaseIndex >= 0
    ? orderedPhases.slice(phaseIndex + 1).map(([, phase]) => phase).filter(Boolean) as PhaseDefinition[]
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

export function startMaintenanceJobProgress(jobKey: MaintenanceJobKey): MaintenanceJobProgress {
  const definition = jobDefinitions[jobKey].phases.preflight!;
  const timestamp = new Date().toISOString();
  const progress: StoredProgress = {
    runId: randomUUID(),
    jobKey,
    status: "running",
    phase: "preflight",
    percent: definition.percent,
    label: definition.label,
    detail: definition.detail,
    currentStep: definition.step,
    totalSteps: jobDefinitions[jobKey].totalSteps,
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
  progressByJob.set(jobKey, progress);
  return withTiming(progress);
}

export function updateMaintenanceJobProgress(
  jobKey: MaintenanceJobKey,
  runId: string,
  phase: Exclude<MaintenanceJobPhase, "complete" | "failed">,
  detail?: string,
  percent?: number,
) {
  const current = progressByJob.get(jobKey);
  const definition = jobDefinitions[jobKey].phases[phase];
  if (!current || !definition || current.runId !== runId || current.status !== "running") return null;
  const next: StoredProgress = {
    ...current,
    phase,
    percent: Math.max(current.percent, Math.min(99, percent ?? definition.percent)),
    label: definition.label,
    detail: detail ?? definition.detail,
    currentStep: Math.max(current.currentStep, definition.step),
    updatedAt: new Date().toISOString(),
    phaseStartedAtMs: current.phase === phase ? current.phaseStartedAtMs : Date.now(),
  };
  progressByJob.set(jobKey, next);
  return withTiming(next);
}

export function completeMaintenanceJobProgress(jobKey: MaintenanceJobKey, runId: string) {
  const current = progressByJob.get(jobKey);
  if (!current || current.runId !== runId) return null;
  const timestamp = new Date().toISOString();
  const next: StoredProgress = {
    ...current,
    status: "completed",
    phase: "complete",
    percent: 100,
    label: "Run complete",
    detail: "The result is saved and the dashboard is up to date.",
    currentStep: current.totalSteps,
    updatedAt: timestamp,
    completedAt: timestamp,
    etaLowerSeconds: 0,
    etaUpperSeconds: 0,
    isTakingLongerThanExpected: false,
    phaseStartedAtMs: Date.now(),
  };
  progressByJob.set(jobKey, next);
  return withTiming(next);
}

export function failMaintenanceJobProgress(jobKey: MaintenanceJobKey, runId: string, error: unknown) {
  const current = progressByJob.get(jobKey);
  if (!current || current.runId !== runId) return null;
  const timestamp = new Date().toISOString();
  const next: StoredProgress = {
    ...current,
    status: "failed",
    phase: "failed",
    label: "Run stopped",
    detail: "This maintenance run could not complete.",
    updatedAt: timestamp,
    completedAt: timestamp,
    etaLowerSeconds: 0,
    etaUpperSeconds: 0,
    errorMessage: error instanceof Error ? error.message : String(error),
    phaseStartedAtMs: Date.now(),
  };
  progressByJob.set(jobKey, next);
  return withTiming(next);
}

export async function trackMaintenanceJobProgress<T>(
  jobKey: MaintenanceJobKey,
  run: (reportProgress: MaintenanceJobProgressReporter) => Promise<T>,
): Promise<T> {
  const existing = progressByJob.get(jobKey);
  if (existing?.status === "running") {
    throw new Error(`${jobKey.replaceAll("_", " ")} is already running`);
  }
  const started = startMaintenanceJobProgress(jobKey);
  const runId = started.runId!;
  const reportProgress: MaintenanceJobProgressReporter = (phase, detail, percent) => {
    updateMaintenanceJobProgress(jobKey, runId, phase, detail, percent);
  };
  try {
    const result = await run(reportProgress);
    completeMaintenanceJobProgress(jobKey, runId);
    return result;
  } catch (error) {
    failMaintenanceJobProgress(jobKey, runId, error);
    throw error;
  }
}

function idleProgress(jobKey: MaintenanceJobKey): MaintenanceJobProgress {
  return {
    runId: null,
    jobKey,
    status: "idle",
    phase: null,
    percent: 0,
    label: "Idle",
    detail: "Start a manual run to see progress.",
    currentStep: 0,
    totalSteps: jobDefinitions[jobKey].totalSteps,
    startedAt: null,
    updatedAt: new Date().toISOString(),
    completedAt: null,
    elapsedSeconds: 0,
    etaLowerSeconds: null,
    etaUpperSeconds: null,
    isTakingLongerThanExpected: false,
    errorMessage: null,
  };
}

export function getMaintenanceJobProgress() {
  return {
    aptlssMaintenance: progressByJob.has("aptlss_maintenance")
      ? withTiming(progressByJob.get("aptlss_maintenance")!)
      : idleProgress("aptlss_maintenance"),
    workspaceIngestion: progressByJob.has("workspace_ingestion")
      ? withTiming(progressByJob.get("workspace_ingestion")!)
      : idleProgress("workspace_ingestion"),
    replyMonitor: progressByJob.has("reply_monitor")
      ? withTiming(progressByJob.get("reply_monitor")!)
      : idleProgress("reply_monitor"),
    eodCompliance: progressByJob.has("eod_compliance")
      ? withTiming(progressByJob.get("eod_compliance")!)
      : idleProgress("eod_compliance"),
    weeklyAnalysis: progressByJob.has("weekly_analysis")
      ? withTiming(progressByJob.get("weekly_analysis")!)
      : idleProgress("weekly_analysis"),
  };
}

export function resetMaintenanceJobProgressForTests() {
  progressByJob.clear();
}
