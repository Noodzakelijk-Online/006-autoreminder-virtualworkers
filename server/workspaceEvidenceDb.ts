import { createHash } from "crypto";
import { and, desc, eq, inArray, isNull, notInArray, notExists, or, gte, sql } from "drizzle-orm";
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
  const updateSet: Partial<InsertWorkspaceEvidenceItem> = {
    sourceContainerId: values.sourceContainerId ?? null,
    kind: values.kind,
    title: values.title,
    summary: values.summary ?? null,
    sourceUrl: values.sourceUrl ?? null,
    mimeType: values.mimeType ?? null,
    modifiedAt: values.modifiedAt ?? null,
    observedAt: values.observedAt,
    metadataJson: values.metadataJson ?? null,
    active: values.active ?? true,
  };
  // Undefined means the source adapter did not fetch content during this pass.
  // Preserve the previous extraction instead of turning a metadata refresh into data loss.
  if (input.content !== undefined) {
    updateSet.content = input.content;
    updateSet.contentHash = values.contentHash;
  }
  await db.insert(workspaceEvidenceItems).values(values).onDuplicateKeyUpdate({
    set: updateSet,
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
  const existingLinks = await db.select({
    cardId: workspaceEvidenceLinks.cardId,
    relevanceScore: workspaceEvidenceLinks.relevanceScore,
    matchReason: workspaceEvidenceLinks.matchReason,
    linkMethod: workspaceEvidenceLinks.linkMethod,
  })
    .from(workspaceEvidenceLinks)
    .where(eq(workspaceEvidenceLinks.evidenceId, evidenceId));
  const manualCardIds = new Set(existingLinks.filter((link) => link.linkMethod === "manual").map((link) => link.cardId));
  const automaticLinks = links.filter((link) => !manualCardIds.has(link.cardId));
  const existingAutomatic = existingLinks.filter((link) => link.linkMethod === "automatic");
  const signature = (link: Pick<WorkspaceEvidenceMatch, "cardId" | "relevanceScore" | "matchReason">) =>
    `${link.cardId}\u0000${link.relevanceScore}\u0000${link.matchReason}`;
  const previous = new Set(existingAutomatic.map(signature));
  const desired = new Set(automaticLinks.map(signature));
  const unchanged = previous.size === desired.size && Array.from(previous).every((item) => desired.has(item));
  const shouldBeLinked = manualCardIds.size > 0 || automaticLinks.length > 0;
  if (unchanged) {
    if (shouldBeLinked) {
      await db.update(workspaceEvidenceItems).set({
        reviewStatus: "linked",
        reviewedAt: new Date(),
        reviewedBy: "automatic-matcher",
      }).where(and(
        eq(workspaceEvidenceItems.id, evidenceId),
        eq(workspaceEvidenceItems.reviewStatus, "unreviewed"),
      ));
    } else {
      await db.update(workspaceEvidenceItems).set({
        reviewStatus: "unreviewed",
        reviewedAt: null,
        reviewedBy: null,
      }).where(and(
        eq(workspaceEvidenceItems.id, evidenceId),
        eq(workspaceEvidenceItems.reviewStatus, "linked"),
      ));
    }
    return { changedCardIds: [] as string[] };
  }

  await db.transaction(async (tx) => {
    await tx.delete(workspaceEvidenceLinks).where(and(
      eq(workspaceEvidenceLinks.evidenceId, evidenceId),
      eq(workspaceEvidenceLinks.linkMethod, "automatic"),
    ));
    if (automaticLinks.length) {
      await tx.insert(workspaceEvidenceLinks).values(automaticLinks.map((link) => ({
        evidenceId,
        ...link,
        linkMethod: "automatic" as const,
      })));
    }
    if (shouldBeLinked) {
      await tx.update(workspaceEvidenceItems).set({
        reviewStatus: "linked",
        reviewedAt: new Date(),
        reviewedBy: "automatic-matcher",
      }).where(and(
        eq(workspaceEvidenceItems.id, evidenceId),
        eq(workspaceEvidenceItems.reviewStatus, "unreviewed"),
      ));
    } else {
      await tx.update(workspaceEvidenceItems).set({
        reviewStatus: "unreviewed",
        reviewedAt: null,
        reviewedBy: null,
      }).where(and(
        eq(workspaceEvidenceItems.id, evidenceId),
        eq(workspaceEvidenceItems.reviewStatus, "linked"),
      ));
    }
  });
  return {
    changedCardIds: Array.from(new Set([
      ...existingAutomatic.map((link) => link.cardId),
      ...automaticLinks.map((link) => link.cardId),
    ])),
  };
}

export async function getWorkspaceEvidenceReviewQueue(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const recentCutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000);
  const recentDriveCutoff = new Date(Date.now() - 14 * 24 * 60 * 60_000);
  const linkExists = db.select({ id: workspaceEvidenceLinks.id })
    .from(workspaceEvidenceLinks)
    .where(eq(workspaceEvidenceLinks.evidenceId, workspaceEvidenceItems.id));
  return db.select({
    id: workspaceEvidenceItems.id,
    source: workspaceEvidenceItems.source,
    title: workspaceEvidenceItems.title,
    summary: workspaceEvidenceItems.summary,
    content: workspaceEvidenceItems.content,
    sourceUrl: workspaceEvidenceItems.sourceUrl,
    modifiedAt: workspaceEvidenceItems.modifiedAt,
    observedAt: workspaceEvidenceItems.observedAt,
  }).from(workspaceEvidenceItems).where(and(
    eq(workspaceEvidenceItems.active, true),
    eq(workspaceEvidenceItems.reviewStatus, "unreviewed"),
    notInArray(workspaceEvidenceItems.source, ["trello"]),
    or(
      and(
        inArray(workspaceEvidenceItems.source, ["gmail", "communication"]),
        or(
          gte(workspaceEvidenceItems.modifiedAt, recentCutoff),
          and(isNull(workspaceEvidenceItems.modifiedAt), gte(workspaceEvidenceItems.observedAt, recentCutoff)),
        ),
      ),
      and(
        eq(workspaceEvidenceItems.source, "google_drive"),
        sql<boolean>`length(trim(coalesce(${workspaceEvidenceItems.content}, ''))) > 0`,
        or(
          gte(workspaceEvidenceItems.modifiedAt, recentDriveCutoff),
          and(isNull(workspaceEvidenceItems.modifiedAt), gte(workspaceEvidenceItems.observedAt, recentDriveCutoff)),
        ),
      ),
    ),
    notExists(linkExists),
  )).orderBy(desc(sql`coalesce(${workspaceEvidenceItems.modifiedAt}, ${workspaceEvidenceItems.observedAt})`))
    .limit(Math.max(1, Math.min(100, limit)));
}

export async function linkWorkspaceEvidenceManually(evidenceId: number, cardId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for workspace evidence linking");
  const [evidence] = await db.select({ id: workspaceEvidenceItems.id })
    .from(workspaceEvidenceItems)
    .where(and(eq(workspaceEvidenceItems.id, evidenceId), eq(workspaceEvidenceItems.active, true)))
    .limit(1);
  if (!evidence) throw new Error("Evidence item not found or inactive");
  const [card] = await db.select({ id: workspaceEvidenceItems.sourceId })
    .from(workspaceEvidenceItems)
    .where(and(
      eq(workspaceEvidenceItems.source, "trello"),
      eq(workspaceEvidenceItems.sourceId, cardId),
      eq(workspaceEvidenceItems.active, true),
    )).limit(1);
  if (!card) throw new Error("Trello card is not available in the workspace index");
  await db.insert(workspaceEvidenceLinks).values({
    evidenceId,
    cardId,
    relevanceScore: 100,
    matchReason: "Confirmed by operator",
    linkMethod: "manual",
  }).onDuplicateKeyUpdate({ set: {
    relevanceScore: 100,
    matchReason: "Confirmed by operator",
    linkMethod: "manual",
  } });
  await db.update(workspaceEvidenceItems).set({
    reviewStatus: "linked",
    reviewedAt: new Date(),
    reviewedBy: "joyce-single-user",
  }).where(eq(workspaceEvidenceItems.id, evidenceId));
}

export async function classifyWorkspaceEvidenceAsNotWorkRelated(evidenceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for workspace evidence review");
  const [evidence] = await db.select({ id: workspaceEvidenceItems.id })
    .from(workspaceEvidenceItems)
    .where(and(eq(workspaceEvidenceItems.id, evidenceId), eq(workspaceEvidenceItems.active, true)))
    .limit(1);
  if (!evidence) throw new Error("Evidence item is unavailable");
  const [linked] = await db.select({ id: workspaceEvidenceLinks.id })
    .from(workspaceEvidenceLinks)
    .where(eq(workspaceEvidenceLinks.evidenceId, evidenceId))
    .limit(1);
  if (linked) throw new Error("Linked evidence cannot be classified as unrelated");
  await db.update(workspaceEvidenceItems).set({
    reviewStatus: "not_work_related",
    reviewedAt: new Date(),
    reviewedBy: "joyce-single-user",
  }).where(eq(workspaceEvidenceItems.id, evidenceId));
}

export async function getWorkspaceEvidenceDismissed(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: workspaceEvidenceItems.id,
    source: workspaceEvidenceItems.source,
    title: workspaceEvidenceItems.title,
    sourceUrl: workspaceEvidenceItems.sourceUrl,
    reviewedAt: workspaceEvidenceItems.reviewedAt,
    reviewedBy: workspaceEvidenceItems.reviewedBy,
  }).from(workspaceEvidenceItems).where(and(
    eq(workspaceEvidenceItems.active, true),
    eq(workspaceEvidenceItems.reviewStatus, "not_work_related"),
  )).orderBy(desc(workspaceEvidenceItems.reviewedAt)).limit(Math.max(1, Math.min(100, limit)));
}

export async function reopenWorkspaceEvidenceReview(evidenceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for workspace evidence review");
  const [linked] = await db.select({ id: workspaceEvidenceLinks.id })
    .from(workspaceEvidenceLinks)
    .where(eq(workspaceEvidenceLinks.evidenceId, evidenceId))
    .limit(1);
  if (linked) throw new Error("Linked evidence cannot be reopened without removing its link");
  const result = await db.update(workspaceEvidenceItems).set({
    reviewStatus: "unreviewed",
    reviewedAt: null,
    reviewedBy: null,
  }).where(and(
    eq(workspaceEvidenceItems.id, evidenceId),
    eq(workspaceEvidenceItems.active, true),
    eq(workspaceEvidenceItems.reviewStatus, "not_work_related"),
  ));
  if (Number(result[0].affectedRows) !== 1) throw new Error("Dismissed evidence item is unavailable");
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
  }).from(workspaceEvidenceItems).where(and(
    eq(workspaceEvidenceItems.active, true),
    notInArray(workspaceEvidenceItems.reviewStatus, ["not_work_related"]),
  ));
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
  const changedCardIds = new Set<string>();
  for (const item of evidence) {
    const links = matchEvidenceToCards(item, cards);
    const replaced = await replaceWorkspaceEvidenceLinks(item.id, links);
    replaced.changedCardIds.forEach((cardId) => changedCardIds.add(cardId));
    linksCreated += links.length;
    if (links.length) linkedItems++;
  }
  return { evidenceItems: evidence.length, linkedItems, linksCreated, changedCardIds: Array.from(changedCardIds) };
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
  const empty = { gmail: 0, google_drive: 0, trello: 0, communication: 0 } satisfies Record<WorkspaceEvidenceSource, number>;
  const db = await getDb();
  if (!db) return { total: 0, linked: 0, contentReady: 0, contentEligible: 0, pendingReview: 0, notWorkRelated: 0, bySource: { ...empty }, linkedBySource: { ...empty }, contentBySource: { ...empty }, contentEligibleBySource: { ...empty }, pendingReviewBySource: { ...empty }, notWorkRelatedBySource: { ...empty } };
  const recentCutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000);
  const recentDriveCutoff = new Date(Date.now() - 14 * 24 * 60 * 60_000);
  const counts = await db.select({
    source: workspaceEvidenceItems.source,
    count: sql<number>`count(distinct ${workspaceEvidenceItems.id})`,
    linked: sql<number>`count(distinct ${workspaceEvidenceLinks.evidenceId})`,
    contentReady: sql<number>`count(distinct case when length(trim(coalesce(${workspaceEvidenceItems.content}, ''))) > 0 then ${workspaceEvidenceItems.id} end)`,
    contentEligible: sql<number>`count(distinct case when ${workspaceEvidenceItems.source} <> 'google_drive'
      or ${workspaceEvidenceItems.mimeType} like 'text/%'
      or ${workspaceEvidenceItems.mimeType} in (
        'application/vnd.google-apps.document',
        'application/vnd.google-apps.spreadsheet',
        'application/vnd.google-apps.presentation',
        'application/json',
        'application/xml',
        'application/javascript',
        'application/rtf'
      ) then ${workspaceEvidenceItems.id} end)`,
    pendingReview: sql<number>`count(distinct case when ${workspaceEvidenceItems.reviewStatus} = 'unreviewed' and (
      (${workspaceEvidenceItems.source} in ('gmail', 'communication')
        and coalesce(${workspaceEvidenceItems.modifiedAt}, ${workspaceEvidenceItems.observedAt}) >= ${recentCutoff})
      or (${workspaceEvidenceItems.source} = 'google_drive'
        and length(trim(coalesce(${workspaceEvidenceItems.content}, ''))) > 0
        and coalesce(${workspaceEvidenceItems.modifiedAt}, ${workspaceEvidenceItems.observedAt}) >= ${recentDriveCutoff})
      )
      then ${workspaceEvidenceItems.id} end)`,
    notWorkRelated: sql<number>`count(distinct case when ${workspaceEvidenceItems.reviewStatus} = 'not_work_related' then ${workspaceEvidenceItems.id} end)`,
  })
    .from(workspaceEvidenceItems)
    .leftJoin(workspaceEvidenceLinks, eq(workspaceEvidenceLinks.evidenceId, workspaceEvidenceItems.id))
    .where(eq(workspaceEvidenceItems.active, true))
    .groupBy(workspaceEvidenceItems.source);
  const bySource: Record<WorkspaceEvidenceSource, number> = { ...empty };
  const linkedBySource: Record<WorkspaceEvidenceSource, number> = { ...empty };
  const contentBySource: Record<WorkspaceEvidenceSource, number> = { ...empty };
  const contentEligibleBySource: Record<WorkspaceEvidenceSource, number> = { ...empty };
  const pendingReviewBySource: Record<WorkspaceEvidenceSource, number> = { ...empty };
  const notWorkRelatedBySource: Record<WorkspaceEvidenceSource, number> = { ...empty };
  for (const row of counts) {
    bySource[row.source] = Number(row.count);
    linkedBySource[row.source] = Number(row.linked);
    contentBySource[row.source] = Number(row.contentReady);
    contentEligibleBySource[row.source] = Number(row.contentEligible);
    pendingReviewBySource[row.source] = Number(row.pendingReview);
    notWorkRelatedBySource[row.source] = Number(row.notWorkRelated);
  }
  return {
    total: Object.values(bySource).reduce((sum, count) => sum + count, 0),
    linked: Object.values(linkedBySource).reduce((sum, count) => sum + count, 0),
    contentReady: Object.values(contentBySource).reduce((sum, count) => sum + count, 0),
    contentEligible: Object.values(contentEligibleBySource).reduce((sum, count) => sum + count, 0),
    pendingReview: Object.values(pendingReviewBySource).reduce((sum, count) => sum + count, 0),
    notWorkRelated: Object.values(notWorkRelatedBySource).reduce((sum, count) => sum + count, 0),
    bySource,
    linkedBySource,
    contentBySource,
    contentEligibleBySource,
    pendingReviewBySource,
    notWorkRelatedBySource,
  };
}
