import { createHash } from "crypto";
import { and, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import {
  workspaceEvidenceItems,
  workspaceEvidenceLinks,
  type InsertWorkspaceEvidenceItem,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  buildAptlssExternalEvidenceSignal,
  matchEvidenceToCards,
  type AptlssExternalEvidenceSignal,
  type EvidenceMatchCard,
  type WorkspaceEvidenceCandidate,
  type WorkspaceEvidenceMatch,
  type WorkspaceEvidenceSource,
} from "./workspaceEvidence";

export type WorkspaceEvidenceInput = Omit<InsertWorkspaceEvidenceItem, "id" | "contentHash" | "createdAt" | "updatedAt"> & {
  contentHash?: string;
};

function hashEvidence(input: WorkspaceEvidenceInput) {
  return createHash("sha256").update(JSON.stringify({
    title: input.title,
    summary: input.summary ?? null,
    content: input.content ?? null,
    sourceUrl: input.sourceUrl ?? null,
    mimeType: input.mimeType ?? null,
    modifiedAt: input.modifiedAt?.toISOString() ?? null,
    metadataJson: input.metadataJson ?? null,
    active: input.active ?? true,
  })).digest("hex");
}

export async function upsertWorkspaceEvidence(input: WorkspaceEvidenceInput): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for workspace evidence ingestion");
  const values = { ...input, contentHash: input.contentHash ?? hashEvidence(input) };
  await db.insert(workspaceEvidenceItems).values(values).onDuplicateKeyUpdate({
    set: {
      sourceContainerId: values.sourceContainerId ?? null,
      kind: values.kind,
      title: values.title,
      summary: values.summary ?? null,
      content: values.content ?? null,
      sourceUrl: values.sourceUrl ?? null,
      mimeType: values.mimeType ?? null,
      modifiedAt: values.modifiedAt ?? null,
      observedAt: values.observedAt,
      contentHash: values.contentHash,
      metadataJson: values.metadataJson ?? null,
      active: values.active ?? true,
    },
  });
  const rows = await db.select({ id: workspaceEvidenceItems.id })
    .from(workspaceEvidenceItems)
    .where(and(eq(workspaceEvidenceItems.source, values.source), eq(workspaceEvidenceItems.sourceId, values.sourceId)))
    .limit(1);
  if (!rows[0]) throw new Error(`Evidence ${values.source}:${values.sourceId} was not persisted`);
  return rows[0].id;
}

export async function setWorkspaceEvidenceActive(source: WorkspaceEvidenceSource, sourceId: string, active: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for workspace evidence ingestion");
  await db.update(workspaceEvidenceItems).set({ active, observedAt: new Date() })
    .where(and(eq(workspaceEvidenceItems.source, source), eq(workspaceEvidenceItems.sourceId, sourceId)));
}

export async function deactivateMissingWorkspaceEvidence(source: WorkspaceEvidenceSource, activeSourceIds: string[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for workspace evidence ingestion");
  const where = activeSourceIds.length
    ? and(eq(workspaceEvidenceItems.source, source), notInArray(workspaceEvidenceItems.sourceId, activeSourceIds))
    : eq(workspaceEvidenceItems.source, source);
  await db.update(workspaceEvidenceItems).set({ active: false, observedAt: new Date() }).where(where);
}

export async function replaceWorkspaceEvidenceLinks(evidenceId: number, links: WorkspaceEvidenceMatch[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for workspace evidence linking");
  await db.delete(workspaceEvidenceLinks).where(eq(workspaceEvidenceLinks.evidenceId, evidenceId));
  if (!links.length) return;
  await db.insert(workspaceEvidenceLinks).values(links.map((link) => ({ evidenceId, ...link })));
}

export async function getAllActiveWorkspaceEvidence(): Promise<WorkspaceEvidenceCandidate[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    id: workspaceEvidenceItems.id,
    source: workspaceEvidenceItems.source,
    sourceId: workspaceEvidenceItems.sourceId,
    title: workspaceEvidenceItems.title,
    summary: workspaceEvidenceItems.summary,
    content: workspaceEvidenceItems.content,
    sourceUrl: workspaceEvidenceItems.sourceUrl,
    modifiedAt: workspaceEvidenceItems.modifiedAt,
    observedAt: workspaceEvidenceItems.observedAt,
  }).from(workspaceEvidenceItems).where(eq(workspaceEvidenceItems.active, true));
}

export async function getWorkspaceEvidenceContentBackfillCandidates(
  source: WorkspaceEvidenceSource,
  limit = 2_000,
) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    sourceId: workspaceEvidenceItems.sourceId,
    mimeType: workspaceEvidenceItems.mimeType,
    metadataJson: workspaceEvidenceItems.metadataJson,
    modifiedAt: workspaceEvidenceItems.modifiedAt,
  }).from(workspaceEvidenceItems).where(and(
    eq(workspaceEvidenceItems.source, source),
    eq(workspaceEvidenceItems.active, true),
    isNull(workspaceEvidenceItems.content),
  )).orderBy(desc(workspaceEvidenceItems.modifiedAt)).limit(Math.max(1, Math.min(limit, 5_000)));
}

export async function getTrelloEvidenceMatchCards(): Promise<EvidenceMatchCard[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: workspaceEvidenceItems.sourceId,
    name: workspaceEvidenceItems.title,
    url: workspaceEvidenceItems.sourceUrl,
    context: workspaceEvidenceItems.content,
  }).from(workspaceEvidenceItems).where(and(
    eq(workspaceEvidenceItems.source, "trello"),
    eq(workspaceEvidenceItems.active, true),
  ));
  return rows;
}

export async function relinkWorkspaceEvidence(cards: EvidenceMatchCard[]) {
  const evidence = await getAllActiveWorkspaceEvidence();
  let linksCreated = 0;
  let linkedItems = 0;
  for (const item of evidence) {
    const links = matchEvidenceToCards(item, cards);
    await replaceWorkspaceEvidenceLinks(item.id, links);
    linksCreated += links.length;
    if (links.length) linkedItems++;
  }
  return { evidenceItems: evidence.length, linkedItems, linksCreated };
}

export async function getAptlssExternalEvidenceByCardIds(
  cardIds: string[],
  limitPerCard = 12,
): Promise<Map<string, AptlssExternalEvidenceSignal>> {
  const result = new Map<string, AptlssExternalEvidenceSignal>();
  if (!cardIds.length) return result;
  const db = await getDb();
  if (!db) return result;
  const rows = await db.select({
    cardId: workspaceEvidenceLinks.cardId,
    relevanceScore: workspaceEvidenceLinks.relevanceScore,
    matchReason: workspaceEvidenceLinks.matchReason,
    id: workspaceEvidenceItems.id,
    source: workspaceEvidenceItems.source,
    sourceId: workspaceEvidenceItems.sourceId,
    title: workspaceEvidenceItems.title,
    summary: workspaceEvidenceItems.summary,
    content: workspaceEvidenceItems.content,
    sourceUrl: workspaceEvidenceItems.sourceUrl,
    modifiedAt: workspaceEvidenceItems.modifiedAt,
    observedAt: workspaceEvidenceItems.observedAt,
  }).from(workspaceEvidenceLinks)
    .innerJoin(workspaceEvidenceItems, eq(workspaceEvidenceItems.id, workspaceEvidenceLinks.evidenceId))
    .where(and(inArray(workspaceEvidenceLinks.cardId, cardIds), eq(workspaceEvidenceItems.active, true)))
    .orderBy(desc(workspaceEvidenceLinks.relevanceScore), desc(workspaceEvidenceItems.modifiedAt));

  for (const cardId of cardIds) {
    const linked = rows.filter((row) => row.cardId === cardId).slice(0, limitPerCard);
    result.set(cardId, buildAptlssExternalEvidenceSignal(linked));
  }
  return result;
}

export async function getAptlssExternalEvidenceForCard(cardId: string, limit = 12) {
  return (await getAptlssExternalEvidenceByCardIds([cardId], limit)).get(cardId)
    ?? buildAptlssExternalEvidenceSignal([]);
}

export async function getWorkspaceEvidenceStats() {
  const db = await getDb();
  if (!db) return { total: 0, linked: 0, bySource: { gmail: 0, google_drive: 0, trello: 0, communication: 0 } };
  const counts = await db.select({ source: workspaceEvidenceItems.source, count: sql<number>`count(*)` })
    .from(workspaceEvidenceItems)
    .where(eq(workspaceEvidenceItems.active, true))
    .groupBy(workspaceEvidenceItems.source);
  const linkedRows = await db.select({ count: sql<number>`count(distinct ${workspaceEvidenceLinks.evidenceId})` })
    .from(workspaceEvidenceLinks);
  const bySource: Record<WorkspaceEvidenceSource, number> = { gmail: 0, google_drive: 0, trello: 0, communication: 0 };
  for (const row of counts) bySource[row.source] = Number(row.count);
  return {
    total: Object.values(bySource).reduce((sum, count) => sum + count, 0),
    linked: Number(linkedRows[0]?.count ?? 0),
    bySource,
  };
}
