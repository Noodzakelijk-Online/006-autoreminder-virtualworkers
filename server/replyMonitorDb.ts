import { and, asc, desc, eq, inArray, isNull, like } from "drizzle-orm";
import {
  replyMonitorStatus,
  replyThreads,
  unsignedMessageFlags,
  vagueReplyFlags,
} from "../drizzle/schema";
import { getDb } from "./db";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Reply Monitor database is unavailable.");
  return db;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export type ReplySource = "trello" | "upwork";

export interface ReplyThreadRow {
  id: number;
  source: string;
  cardId: string;
  cardName: string;
  cardUrl: string;
  boardName: string;
  listName: string;
  lastNonJoyceMsgAt: Date | null;
  lastNonJoyceAuthor: string;
  lastNonJoyceText: string;
  lastJoyceReplyAt: Date | null;
  status: string;
  demerited: boolean;
  updatedAt: Date;
}

export async function upsertReplyThread(data: {
  source: ReplySource;
  cardId: string;
  cardName: string;
  cardUrl: string;
  boardName: string;
  listName: string;
  lastNonJoyceMsgAt: Date | null;
  lastNonJoyceAuthor: string;
  lastNonJoyceText: string;
  lastJoyceReplyAt: Date | null;
  status: "pending" | "replied" | "overdue" | "ok";
  demerited: boolean;
}): Promise<void> {
  if (!data.lastNonJoyceMsgAt) {
    throw new Error(`Reply thread ${data.cardId} has no external message timestamp.`);
  }
  const db = await requireDb();
  const status = data.status === "ok" ? "replied" : data.status;
  const values = {
    source: data.source,
    cardId: data.cardId,
    cardName: data.cardName,
    cardUrl: data.cardUrl,
    boardName: data.boardName,
    listName: data.listName,
    lastNonJoyceMsgAt: data.lastNonJoyceMsgAt,
    lastNonJoyceAuthor: data.lastNonJoyceAuthor,
    lastNonJoyceText: (data.lastNonJoyceText || "").slice(0, 2000),
    lastJoyceReplyAt: data.lastJoyceReplyAt,
    status,
    demerited: data.demerited,
  } as const;
  await db.insert(replyThreads).values(values).onDuplicateKeyUpdate({
    set: { ...values, updatedAt: new Date() },
  });
}

export const upsertUpworkThread = upsertReplyThread;

function toReplyThreadRows(rows: Array<typeof replyThreads.$inferSelect>): ReplyThreadRow[] {
  return rows.map((row) => ({
    ...row,
    lastNonJoyceText: row.lastNonJoyceText ?? "",
  }));
}

export async function getPendingReplyThreads(): Promise<ReplyThreadRow[]> {
  const db = await requireDb();
  const rows = await db.select().from(replyThreads)
    .where(inArray(replyThreads.status, ["pending", "overdue"]))
    .orderBy(asc(replyThreads.lastNonJoyceMsgAt));
  return toReplyThreadRows(rows);
}

export async function getAllReplyThreads(limit = 100): Promise<ReplyThreadRow[]> {
  const db = await requireDb();
  const rows = await db.select().from(replyThreads)
    .orderBy(desc(replyThreads.lastNonJoyceMsgAt))
    .limit(Math.max(1, Math.min(limit, 500)));
  return toReplyThreadRows(rows);
}

export async function markReplyThreadReplied(cardId: string, source: ReplySource): Promise<void> {
  const db = await requireDb();
  await db.update(replyThreads).set({ status: "replied", updatedAt: new Date() })
    .where(and(eq(replyThreads.cardId, cardId), eq(replyThreads.source, source)));
}

export async function markReplyThreadDemerited(cardId: string, source: ReplySource): Promise<void> {
  const db = await requireDb();
  await db.update(replyThreads).set({ demerited: true, updatedAt: new Date() })
    .where(and(eq(replyThreads.cardId, cardId), eq(replyThreads.source, source)));
}

export interface VagueFlagRow {
  id: number;
  source: string;
  cardId: string;
  cardName: string;
  cardUrl: string;
  actionId: string;
  messageText: string;
  flaggedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  demeritIssued: boolean;
  demeritIssuedAt: Date | null;
}

export async function insertVagueReplyFlag(data: {
  source: ReplySource;
  cardId: string;
  cardName: string;
  cardUrl: string;
  actionId: string;
  messageText: string;
  flaggedAt: Date;
}): Promise<number | null> {
  const db = await requireDb();
  const existing = await db.select({ id: vagueReplyFlags.id }).from(vagueReplyFlags)
    .where(eq(vagueReplyFlags.actionId, data.actionId)).limit(1);
  if (existing.length) return null;
  try {
    const inserted = await db.insert(vagueReplyFlags).values({
      ...data,
      messageText: data.messageText.slice(0, 2000),
    }).$returningId();
    return inserted[0]?.id ?? null;
  } catch (error) {
    if (errorMessage(error).toLowerCase().includes("duplicate")) return null;
    throw error;
  }
}

export const upsertUpworkVagueFlag = insertVagueReplyFlag;

export async function getActiveVagueReplyFlags(): Promise<VagueFlagRow[]> {
  const db = await requireDb();
  return db.select().from(vagueReplyFlags)
    .where(isNull(vagueReplyFlags.resolvedAt))
    .orderBy(asc(vagueReplyFlags.flaggedAt));
}

export async function resolveVagueReplyFlag(id: number): Promise<void> {
  const db = await requireDb();
  await db.update(vagueReplyFlags).set({ resolvedAt: new Date(), resolvedBy: "manual", updatedAt: new Date() })
    .where(eq(vagueReplyFlags.id, id));
}

export async function getAllVagueReplyFlags(limit = 50): Promise<VagueFlagRow[]> {
  const db = await requireDb();
  return db.select().from(vagueReplyFlags)
    .orderBy(desc(vagueReplyFlags.flaggedAt))
    .limit(Math.max(1, Math.min(limit, 500)));
}

export const getUpworkPendingThreads = getPendingReplyThreads;
export const getUpworkActiveVagueFlags = getActiveVagueReplyFlags;

export interface UnsignedFlagRow {
  id: number;
  source: string;
  cardId: string;
  cardName: string;
  cardUrl: string;
  actionId: string;
  messageText: string;
  flaggedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  demeritIssued: boolean;
  demeritIssuedAt: Date | null;
}

export async function insertUnsignedFlag(data: {
  source: ReplySource;
  cardId: string;
  cardName: string;
  cardUrl: string;
  actionId: string;
  messageText: string;
  flaggedAt: Date;
}): Promise<number | null> {
  const db = await requireDb();
  const existing = await db.select({ id: unsignedMessageFlags.id }).from(unsignedMessageFlags)
    .where(eq(unsignedMessageFlags.actionId, data.actionId)).limit(1);
  if (existing.length) return null;
  try {
    const inserted = await db.insert(unsignedMessageFlags).values({
      ...data,
      messageText: data.messageText.slice(0, 2000),
    }).$returningId();
    return inserted[0]?.id ?? null;
  } catch (error) {
    if (errorMessage(error).toLowerCase().includes("duplicate")) return null;
    throw error;
  }
}

export async function getActiveUnsignedFlags(): Promise<UnsignedFlagRow[]> {
  const db = await requireDb();
  return db.select().from(unsignedMessageFlags)
    .where(isNull(unsignedMessageFlags.resolvedAt))
    .orderBy(asc(unsignedMessageFlags.flaggedAt));
}

export async function resolveUnsignedFlag(id: number, note?: string): Promise<void> {
  const db = await requireDb();
  await db.update(unsignedMessageFlags).set({
    resolvedAt: new Date(),
    resolvedBy: "manual",
    resolutionNote: note?.trim() || null,
    updatedAt: new Date(),
  }).where(eq(unsignedMessageFlags.id, id));
}

/** Resolve historical flags created from internal APTLSS system notes. */
export async function resolveSystemGeneratedUnsignedFlags(): Promise<void> {
  const db = await requireDb();
  await db.update(unsignedMessageFlags).set({
    resolvedAt: new Date(),
    resolvedBy: "system",
    resolutionNote: "Internal APTLSS system comments do not require a Joyce signature.",
    updatedAt: new Date(),
  }).where(and(
    isNull(unsignedMessageFlags.resolvedAt),
    like(unsignedMessageFlags.messageText, "[APTLSS System]%"),
  ));
}

export async function getAllUnsignedFlags(limit = 50): Promise<UnsignedFlagRow[]> {
  const db = await requireDb();
  return db.select().from(unsignedMessageFlags)
    .orderBy(desc(unsignedMessageFlags.flaggedAt))
    .limit(Math.max(1, Math.min(limit, 500)));
}

export async function markReplyMonitorScanStarted(): Promise<void> {
  const db = await requireDb();
  const now = new Date();
  await db.insert(replyMonitorStatus).values({ id: 1, state: "running", lastStartedAt: now })
    .onDuplicateKeyUpdate({ set: { state: "running", lastStartedAt: now, errorMessage: null, updatedAt: now } });
}

export async function markReplyMonitorScanSucceeded(threadsScanned: number): Promise<void> {
  const db = await requireDb();
  const now = new Date();
  await db.insert(replyMonitorStatus).values({
    id: 1,
    state: "success",
    lastStartedAt: now,
    lastCompletedAt: now,
    lastSuccessfulAt: now,
    threadsScanned,
  }).onDuplicateKeyUpdate({
    set: {
      state: "success",
      lastCompletedAt: now,
      lastSuccessfulAt: now,
      threadsScanned,
      errorMessage: null,
      updatedAt: now,
    },
  });
}

export async function markReplyMonitorScanFailed(error: unknown): Promise<void> {
  const db = await requireDb();
  const now = new Date();
  const message = errorMessage(error).slice(0, 2000);
  await db.insert(replyMonitorStatus).values({
    id: 1,
    state: "error",
    lastStartedAt: now,
    lastCompletedAt: now,
    errorMessage: message,
  }).onDuplicateKeyUpdate({
    set: { state: "error", lastCompletedAt: now, errorMessage: message, updatedAt: now },
  });
}

export async function getReplyMonitorStatus() {
  const db = await requireDb();
  const rows = await db.select().from(replyMonitorStatus).where(eq(replyMonitorStatus.id, 1)).limit(1);
  return rows[0] ?? {
    id: 1,
    state: "never" as const,
    lastStartedAt: null,
    lastCompletedAt: null,
    lastSuccessfulAt: null,
    threadsScanned: 0,
    errorMessage: null,
    updatedAt: new Date(0),
  };
}
