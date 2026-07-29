import { runTrackedJob, type JobTrigger } from "./scheduledJobsDb";
import { getJoyceCards, type TrelloCard } from "./trello";
import {
  deactivateMissingWorkspaceEvidence,
  upsertWorkspaceEvidence,
} from "./workspaceEvidenceDb";
import type { EvidenceMatchCard } from "./workspaceEvidence";

export type TrelloEvidenceIngestionResult = {
  scanned: number;
  imported: number;
  rejected: number;
  cards: EvidenceMatchCard[];
};

let activeRun: Promise<TrelloEvidenceIngestionResult> | null = null;

function cardContent(card: TrelloCard) {
  return [
    card.desc,
    `Board: ${card.boardName ?? "Unknown"}`,
    `List: ${card.list?.name ?? "Unknown"}`,
    card.due ? `Due: ${card.due}${card.dueComplete ? " (complete)" : ""}` : "Due: not set",
    ...(card.labels ?? []).map((label) => `Label: ${label.name || label.color || "Unlabelled"}`),
    ...(card.attachments ?? []).map((attachment) => `Attachment: ${attachment.name ?? "file"} ${attachment.url ?? ""}`),
  ].filter(Boolean).join("\n");
}
async function executeTrelloEvidenceIngestion(): Promise<TrelloEvidenceIngestionResult> {
  const apiKey = process.env.TrelloAPIKey;
  const apiToken = process.env.TrelloAPIToken;
  if (!apiKey || !apiToken) throw new Error("Trello credentials are not configured");

  const cards = await getJoyceCards(apiKey, apiToken);
  let imported = 0;
  let rejected = 0;
  const observedAt = new Date();

  for (const card of cards) {
    try {
      await upsertWorkspaceEvidence({
        source: "trello",
        sourceId: card.id,
        sourceContainerId: card.idBoard ?? null,
        kind: "card",
        title: card.name,
        summary: `${card.boardName ?? "Unknown board"} / ${card.list?.name ?? "Unknown list"}`,
        content: cardContent(card),
        sourceUrl: card.shortUrl ?? card.url,
        mimeType: "application/vnd.trello.card+json",
        modifiedAt: new Date(card.dateLastActivity),
        observedAt,
        metadataJson: JSON.stringify({
          boardName: card.boardName ?? null,
          listName: card.list?.name ?? null,
          due: card.due,
          dueComplete: card.dueComplete ?? false,
          labels: card.labels ?? [],
          attachments: card.attachments ?? [],
        }),
        active: true,
      });
      imported++;
    } catch (error) {
      rejected++;
      console.error(`[TrelloEvidence] Failed to persist ${card.id}:`, error instanceof Error ? error.message : String(error));
    }
  }
  await deactivateMissingWorkspaceEvidence("trello", cards.map((card) => card.id));

  return {
    scanned: cards.length,
    imported,
    rejected,
    cards: cards.map((card) => ({
      id: card.id,
      name: card.name,
      url: card.shortUrl ?? card.url,
      context: cardContent(card),
    })),
  };
}

export function runTrelloEvidenceIngestion(trigger: JobTrigger = "manual") {
  if (activeRun) return activeRun;
  activeRun = runTrackedJob({
    jobKey: "trello_evidence_ingestion",
    trigger,
    run: executeTrelloEvidenceIngestion,
    summarize: (result) => ({
      recordsProcessed: result.imported,
      detail: `${result.scanned} cards scanned, ${result.imported} indexed, ${result.rejected} rejected`,
    }),
  }).finally(() => {
    activeRun = null;
  });
  return activeRun;
}
