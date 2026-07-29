import { desc, eq } from "drizzle-orm";
import { communicationEvidence } from "../drizzle/schema";
import { getDb } from "./db";

export type CommunicationEvidenceValue = {
  channel: string;
  externalId: string;
  threadId?: string | null;
  direction?: "inbound" | "outbound" | "system" | "unknown";
  sender?: string | null;
  recipients?: string[];
  subject?: string | null;
  summary?: string | null;
  occurredAt: Date;
  responseRequired?: boolean;
  respondedAt?: Date | null;
  linkedCardId?: string | null;
  evidenceItemId?: number | null;
  metadata?: Record<string, unknown> | null;
};

export async function upsertCommunicationEvidence(value: CommunicationEvidenceValue) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const values = {
    channel: value.channel,
    externalId: value.externalId,
    threadId: value.threadId ?? null,
    direction: value.direction ?? "unknown" as const,
    sender: value.sender ?? null,
    recipientsJson: value.recipients ? JSON.stringify(value.recipients) : null,
    subject: value.subject ?? null,
    summary: value.summary ?? null,
    occurredAt: value.occurredAt,
    responseRequired: value.responseRequired ?? false,
    respondedAt: value.respondedAt ?? null,
    linkedCardId: value.linkedCardId ?? null,
    evidenceItemId: value.evidenceItemId ?? null,
    metadataJson: value.metadata ? JSON.stringify(value.metadata) : null,
  };
  await db.insert(communicationEvidence).values(values).onDuplicateKeyUpdate({ set: values });
}

export async function getCommunicationEvidenceForCard(cardId: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(communicationEvidence)
    .where(eq(communicationEvidence.linkedCardId, cardId))
    .orderBy(desc(communicationEvidence.occurredAt))
    .limit(Math.max(1, Math.min(limit, 250)));
}

export async function getOutstandingCommunicationEvidence(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(communicationEvidence)
    .where(eq(communicationEvidence.responseRequired, true))
    .orderBy(desc(communicationEvidence.occurredAt))
    .limit(Math.max(1, Math.min(limit, 500)));
  return rows.filter((row) => !row.respondedAt);
}
