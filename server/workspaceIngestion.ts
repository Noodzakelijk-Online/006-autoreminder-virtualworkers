import { runGmailIngestion, type GmailIngestionResult } from "./gmailIngestion";
import { runGoogleDriveIngestion, type GoogleDriveIngestionResult } from "./googleDriveIngestion";
import { runTrackedJob, type JobTrigger } from "./scheduledJobsDb";
import { broadcast } from "./sse";
import { runTrelloEvidenceIngestion, type TrelloEvidenceIngestionResult } from "./trelloEvidenceIngestion";
import { getTrelloEvidenceMatchCards, relinkWorkspaceEvidence } from "./workspaceEvidenceDb";
import { queueCardReassessment } from "./aptlssReassessment";
import type { MaintenanceJobProgressReporter } from "./maintenanceJobProgress";

type SourceRun<T> = {
  status: "success" | "error";
  result: T | null;
  error: string | null;
};

export type WorkspaceIngestionResult = {
  gmail: SourceRun<GmailIngestionResult>;
  googleDrive: SourceRun<GoogleDriveIngestionResult>;
  trello: SourceRun<Omit<TrelloEvidenceIngestionResult, "cards">>;
  linking: { evidenceItems: number; linkedItems: number; linksCreated: number; changedCardIds: string[] };
  failures: number;
};

let activeRun: Promise<WorkspaceIngestionResult> | null = null;

function settled<T>(result: PromiseSettledResult<T>): SourceRun<T> {
  if (result.status === "fulfilled") return { status: "success", result: result.value, error: null };
  return {
    status: "error",
    result: null,
    error: result.reason instanceof Error ? result.reason.message : String(result.reason),
  };
}
async function executeWorkspaceIngestion(
  trigger: JobTrigger,
  reportProgress?: MaintenanceJobProgressReporter,
): Promise<WorkspaceIngestionResult> {
  reportProgress?.("source_sync");
  const [gmailSettled, driveSettled, trelloSettled] = await Promise.allSettled([
    runGmailIngestion(trigger),
    runGoogleDriveIngestion(trigger),
    runTrelloEvidenceIngestion(trigger),
  ]);
  const gmail = settled(gmailSettled);
  const googleDrive = settled(driveSettled);
  const trelloFull = settled(trelloSettled);
  const cards = trelloFull.result?.cards ?? await getTrelloEvidenceMatchCards();
  reportProgress?.("linking");
  const linking = cards.length
    ? await relinkWorkspaceEvidence(cards)
    : { evidenceItems: 0, linkedItems: 0, linksCreated: 0, changedCardIds: [] };
  reportProgress?.("analyzing");
  linking.changedCardIds.forEach((cardId) => queueCardReassessment(cardId, "evidence"));
  const trello: WorkspaceIngestionResult["trello"] = trelloFull.status === "success"
    ? {
        status: "success",
        result: trelloFull.result ? {
          scanned: trelloFull.result.scanned,
          imported: trelloFull.result.imported,
          rejected: trelloFull.result.rejected,
        } : null,
        error: null,
      }
    : { status: "error", result: null, error: trelloFull.error };
  const failures = [gmail, googleDrive, trello].filter((source) => source.status === "error").length;
  reportProgress?.("persisting");
  return { gmail, googleDrive, trello, linking, failures };
}

export function runWorkspaceIngestion(
  trigger: JobTrigger = "manual",
  reportProgress?: MaintenanceJobProgressReporter,
) {
  if (activeRun) return activeRun;
  reportProgress?.("preflight");
  activeRun = runTrackedJob({
    jobKey: "workspace_ingestion",
    trigger,
    run: () => executeWorkspaceIngestion(trigger, reportProgress),
    summarize: (result) => ({
      recordsProcessed: (result.gmail.result?.imported ?? 0)
        + (result.googleDrive.result?.indexed ?? 0)
        + (result.trello.result?.imported ?? 0),
      detail: `${result.gmail.result?.imported ?? 0} Gmail, ${result.googleDrive.result?.indexed ?? 0} Drive, ${result.trello.result?.imported ?? 0} Trello indexed; ${result.linking.linksCreated} card links; ${result.linking.changedCardIds.length} reassessment(s) queued; ${result.failures} source failure(s)`,
    }),
  }).then((result) => {
    broadcast("gmail-invalidate");
    broadcast("aptlss-invalidate");
    return result;
  }).finally(() => {
    activeRun = null;
  });
  return activeRun;
}

export function isWorkspaceIngestionRunning() {
  return Boolean(activeRun);
}
