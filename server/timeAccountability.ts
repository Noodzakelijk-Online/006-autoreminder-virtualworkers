import { and, asc, eq, gt, isNull, lt, ne, or, sql } from "drizzle-orm";
import {
  timeDayReviews,
  timeEntries,
  timeEntryEvents,
} from "../drizzle/schema";
import {
  assertDateKey,
  dateKeyInEat,
  eatDateRangeUtc,
} from "../shared/eatTime";
import { getDb } from "./db";

export const TIME_CATEGORIES = [
  "client_work",
  "communication",
  "administration",
  "meeting",
  "training",
  "waiting",
  "break",
  "emergency",
] as const;
export type TimeCategory = (typeof TIME_CATEGORIES)[number];

export type ManualTimeEntryInput = {
  dateKey: string;
  startTime: string;
  endTime: string;
  cardId: string;
  cardName: string;
  cardUrl: string;
  boardName: string;
  listName: string;
  category: TimeCategory;
  reason: string;
  notes?: string | null;
  planBlockId?: string | null;
  aptlssStepId?: number | null;
};

function snapshot(entry: typeof timeEntries.$inferSelect | null | undefined) {
  if (!entry) return null;
  return {
    id: entry.id,
    startedAt: entry.startedAt.toISOString(),
    stoppedAt: entry.stoppedAt?.toISOString() ?? null,
    durationSeconds: entry.durationSeconds,
    source: entry.source,
    category: entry.category,
    planDateKey: entry.planDateKey,
    planBlockId: entry.planBlockId,
    aptlssStepId: entry.aptlssStepId,
    notes: entry.notes,
    isVoided: Boolean(entry.isVoided),
    voidedAt: entry.voidedAt?.toISOString() ?? null,
    voidReason: entry.voidReason,
  };
}

function requireReason(value: string) {
  const reason = value.trim();
  if (reason.length < 5)
    throw new Error("A correction reason of at least 5 characters is required");
  return reason;
}

function eatDateTime(dateKey: string, time: string) {
  assertDateKey(dateKey);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error("Time must use HH:MM");
  const result = new Date(`${dateKey}T${time}:00+03:00`);
  if (Number.isNaN(result.getTime()))
    throw new Error("A valid EAT date and time is required");
  return result;
}

async function markNeedsReview(dateKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(timeDayReviews)
    .values({ dateKey, status: "open" })
    .onDuplicateKeyUpdate({
      set: {
        status: sql`IF(${timeDayReviews.status} = 'locked', 'needs_review', ${timeDayReviews.status})`,
        lockedAt: sql`IF(${timeDayReviews.status} = 'locked', NULL, ${timeDayReviews.lockedAt})`,
      },
    });
}

export async function recordTimeEntryEvent(input: {
  timeEntryId: number;
  eventType: string;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(timeEntryEvents).values({
    timeEntryId: input.timeEntryId,
    eventType: input.eventType,
    reason: input.reason ?? null,
    beforeJson: input.before == null ? null : JSON.stringify(input.before),
    afterJson: input.after == null ? null : JSON.stringify(input.after),
    metadataJson:
      input.metadata == null ? null : JSON.stringify(input.metadata),
  });
}

export async function getTimeEntryById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [entry] = await db
    .select()
    .from(timeEntries)
    .where(eq(timeEntries.id, id))
    .limit(1);
  return entry ?? null;
}

export async function createManualTimeEntry(input: ManualTimeEntryInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const reason = requireReason(input.reason);
  const startedAt = eatDateTime(input.dateKey, input.startTime);
  const stoppedAt = eatDateTime(input.dateKey, input.endTime);
  const durationSeconds = Math.floor(
    (stoppedAt.getTime() - startedAt.getTime()) / 1_000
  );
  if (durationSeconds <= 0 || durationSeconds > 24 * 3_600)
    throw new Error("End time must be after start time on the selected day");

  const [overlap] = await db
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.isVoided, false),
        lt(timeEntries.startedAt, stoppedAt),
        or(isNull(timeEntries.stoppedAt), gt(timeEntries.stoppedAt, startedAt))
      )
    )
    .limit(1);
  if (overlap) throw new Error("This session overlaps an existing timer entry");

  const entry = await db.transaction(async tx => {
    const [result] = await tx.insert(timeEntries).values({
      cardId: input.cardId,
      cardName: input.cardName,
      cardUrl: input.cardUrl,
      boardName: input.boardName,
      listName: input.listName,
      startedAt,
      stoppedAt,
      durationSeconds,
      notes: input.notes?.trim() || null,
      source: "manual_missing",
      category: input.category,
      planDateKey: input.planBlockId ? input.dateKey : null,
      planBlockId: input.planBlockId ?? null,
      aptlssStepId: input.aptlssStepId ?? null,
    });
    const id = Number((result as { insertId: number }).insertId);
    const [created] = await tx
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, id))
      .limit(1);
    await tx.insert(timeEntryEvents).values({
      timeEntryId: id,
      eventType: "manual_create",
      reason,
      afterJson: JSON.stringify(snapshot(created)),
    });
    return created;
  });
  await markNeedsReview(input.dateKey);
  return entry;
}

export async function correctTimeEntry(
  id: number,
  durationSeconds: number,
  reasonInput: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const reason = requireReason(reasonInput);
  if (durationSeconds < 0 || durationSeconds > 24 * 3_600)
    throw new Error("Duration must be between 0 and 24 hours");
  const entry = await getTimeEntryById(id);
  if (!entry || entry.isVoided) throw new Error("Time entry not found");
  if (!entry.stoppedAt) throw new Error("Stop the timer before correcting it");
  const stoppedAt = new Date(
    entry.startedAt.getTime() + durationSeconds * 1_000
  );
  const [overlap] = await db
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .where(
      and(
        ne(timeEntries.id, id),
        eq(timeEntries.isVoided, false),
        lt(timeEntries.startedAt, stoppedAt),
        or(
          isNull(timeEntries.stoppedAt),
          gt(timeEntries.stoppedAt, entry.startedAt)
        )
      )
    )
    .limit(1);
  if (overlap)
    throw new Error("The corrected duration would overlap another timer entry");
  const updated = await db.transaction(async tx => {
    await tx
      .update(timeEntries)
      .set({ durationSeconds, stoppedAt })
      .where(eq(timeEntries.id, id));
    const [next] = await tx
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, id))
      .limit(1);
    await tx.insert(timeEntryEvents).values({
      timeEntryId: id,
      eventType: "corrected",
      reason,
      beforeJson: JSON.stringify(snapshot(entry)),
      afterJson: JSON.stringify(snapshot(next)),
    });
    return next;
  });
  await markNeedsReview(dateKeyInEat(entry.startedAt));
  return updated;
}

export async function voidTimeEntry(id: number, reasonInput: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const reason = requireReason(reasonInput);
  const entry = await getTimeEntryById(id);
  if (!entry || entry.isVoided) throw new Error("Time entry not found");
  if (!entry.stoppedAt) throw new Error("Stop the timer before voiding it");
  const voidedAt = new Date();
  const updated = await db.transaction(async tx => {
    await tx
      .update(timeEntries)
      .set({ isVoided: true, voidedAt, voidReason: reason })
      .where(eq(timeEntries.id, id));
    const [next] = await tx
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, id))
      .limit(1);
    await tx.insert(timeEntryEvents).values({
      timeEntryId: id,
      eventType: "voided",
      reason,
      beforeJson: JSON.stringify(snapshot(entry)),
      afterJson: JSON.stringify(snapshot(next)),
    });
    return next;
  });
  await markNeedsReview(dateKeyInEat(entry.startedAt));
  return updated;
}

export async function getTimeDayReview(dateKey: string) {
  const db = await getDb();
  if (!db) return null;
  const [review] = await db
    .select()
    .from(timeDayReviews)
    .where(eq(timeDayReviews.dateKey, dateKey))
    .limit(1);
  return review ?? null;
}

export async function lockTimeDay(input: {
  dateKey: string;
  overtimeReason?: string | null;
  summary: unknown;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const lockedAt = new Date();
  await db
    .insert(timeDayReviews)
    .values({
      dateKey: input.dateKey,
      status: "locked",
      overtimeReason: input.overtimeReason?.trim() || null,
      summaryJson: JSON.stringify(input.summary),
      lockedAt,
    })
    .onDuplicateKeyUpdate({
      set: {
        status: "locked",
        overtimeReason: input.overtimeReason?.trim() || null,
        summaryJson: JSON.stringify(input.summary),
        lockedAt,
      },
    });
  return getTimeDayReview(input.dateKey);
}

export async function getTimeEntryEventsForDate(dateKey: string) {
  const db = await getDb();
  if (!db) return [];
  const { startUtc, endUtc } = eatDateRangeUtc(dateKey);
  const rows = await db
    .select({
      id: timeEntryEvents.id,
      timeEntryId: timeEntryEvents.timeEntryId,
      eventType: timeEntryEvents.eventType,
      reason: timeEntryEvents.reason,
      beforeJson: timeEntryEvents.beforeJson,
      afterJson: timeEntryEvents.afterJson,
      metadataJson: timeEntryEvents.metadataJson,
      createdAt: timeEntryEvents.createdAt,
    })
    .from(timeEntryEvents)
    .innerJoin(timeEntries, eq(timeEntryEvents.timeEntryId, timeEntries.id))
    .where(
      and(
        lt(timeEntries.startedAt, endUtc),
        or(isNull(timeEntries.stoppedAt), gt(timeEntries.stoppedAt, startUtc))
      )
    )
    .orderBy(asc(timeEntryEvents.createdAt));
  const parse = (value: string | null) => {
    if (!value) return null;
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  };
  return rows.map(row => ({
    id: row.id,
    timeEntryId: row.timeEntryId,
    eventType: row.eventType,
    reason: row.reason,
    before: parse(row.beforeJson),
    after: parse(row.afterJson),
    metadata: parse(row.metadataJson),
    createdAt: row.createdAt,
  }));
}

export async function markTimeDayNeedsReview(dateKey: string) {
  await markNeedsReview(dateKey);
}
