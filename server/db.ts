import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { complianceCardEvidence, InsertUser, users } from "../drizzle/schema";
import { addDaysToDateKey, dateKeyInEat, eatDateRangeUtc, eatDateSpanUtc } from "../shared/eatTime";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}


// ─── Payment Cycles ───────────────────────────────────────────────────────────

import { paymentCycles, weeklyPayLog, dailyTriageState } from "../drizzle/schema";
import { desc, asc } from "drizzle-orm";
const PAYMENT_CYCLE_LOCK_KEY = "payment_cycle_lock";

export async function getAllPaymentCycles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(paymentCycles).orderBy(asc(paymentCycles.cycleStart));
}

export async function getCurrentPaymentCycle() {
  const db = await getDb();
  if (!db) return null;
  const all = await db
    .select()
    .from(paymentCycles)
    .where(eq(paymentCycles.isPaid, false))
    .orderBy(asc(paymentCycles.cycleStart))
    .limit(1);
  return all[0] ?? null;
}

export function buildCurrentPaymentCycleRange(dateKey = dateKeyInEat()) {
  const dayOfWeek = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  const cycleEnd = addDaysToDateKey(dateKey, (5 - dayOfWeek + 7) % 7);
  return { cycleStart: addDaysToDateKey(cycleEnd, -13), cycleEnd };
}

export function buildNextPaymentCycleRange(currentCycleEnd: string) {
  const cycleStart = addDaysToDateKey(currentCycleEnd, 1);
  let cycleEnd = addDaysToDateKey(cycleStart, 13);
  while (new Date(`${cycleEnd}T00:00:00Z`).getUTCDay() !== 5) {
    cycleEnd = addDaysToDateKey(cycleEnd, 1);
  }
  return { cycleStart, cycleEnd };
}

/** Explicitly bootstrap the first unpaid cycle without creating duplicates. */
export async function initializeCurrentPaymentCycle(baseAmount = "90.00") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const lockKey = PAYMENT_CYCLE_LOCK_KEY;
  await db.insert(appSettings).values({ key: lockKey, value: "initialize_payment_cycle" }).onDuplicateKeyUpdate({
    set: { value: sql`value` },
  });

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM app_settings WHERE ${appSettings.key} = ${lockKey} FOR UPDATE`);
    const [existing] = await tx
      .select()
      .from(paymentCycles)
      .where(eq(paymentCycles.isPaid, false))
      .orderBy(asc(paymentCycles.cycleStart))
      .limit(1);
    if (existing) return existing;

    const range = buildCurrentPaymentCycleRange();
    const [result] = await tx.insert(paymentCycles).values([{
      cycleStart: range.cycleStart as unknown as Date,
      cycleEnd: range.cycleEnd as unknown as Date,
      baseAmount,
      isPaid: false,
    }]);
    return {
      id: (result as { insertId: number }).insertId,
      cycleStart: range.cycleStart,
      cycleEnd: range.cycleEnd,
      baseAmount,
      isPaid: false,
      paidAt: null,
      paidBy: null,
      notes: null,
    };
  });
}

export async function markCycleAsPaid(cycleId: number, paidByOpenId: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const lockKey = PAYMENT_CYCLE_LOCK_KEY;
  await db.insert(appSettings).values({ key: lockKey, value: "payment_cycle_transition" }).onDuplicateKeyUpdate({
    set: { value: sql`value` },
  });

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM app_settings WHERE ${appSettings.key} = ${lockKey} FOR UPDATE`);
    const [cycle] = await tx.select().from(paymentCycles).where(eq(paymentCycles.id, cycleId)).limit(1);
    if (!cycle) throw new Error("Payment cycle not found");
    if (cycle.isPaid) throw new Error("Payment cycle is already marked paid");

    await tx
      .update(paymentCycles)
      .set({ isPaid: true, paidAt: new Date(), paidBy: paidByOpenId })
      .where(eq(paymentCycles.id, cycleId));

    const [existingUnpaid] = await tx
      .select()
      .from(paymentCycles)
      .where(eq(paymentCycles.isPaid, false))
      .orderBy(asc(paymentCycles.cycleStart))
      .limit(1);
    if (existingUnpaid) return { success: true, nextCycleCreated: false };

    const currentEnd = cycle.cycleEnd instanceof Date
      ? cycle.cycleEnd.toISOString().slice(0, 10)
      : String(cycle.cycleEnd).slice(0, 10);
    const next = buildNextPaymentCycleRange(currentEnd);
    await tx.insert(paymentCycles).values([{
      cycleStart: next.cycleStart as unknown as Date,
      cycleEnd: next.cycleEnd as unknown as Date,
      baseAmount: "90.00",
      isPaid: false,
    }]);
    return { success: true, nextCycleCreated: true };
  });
}

// ─── Weekly Pay Log ───────────────────────────────────────────────────────────

export async function getWeeklyPayLogs(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(weeklyPayLog)
    .orderBy(desc(weeklyPayLog.weekStart))
    .limit(limit);
}

export async function getWeeklyPayLogByWeek(weekStart: string) {
  const db = await getDb();
  if (!db) return null;
  // Use DATE_FORMAT to compare the MySQL date column as a string to avoid
  // timezone/type-cast issues with Drizzle's eq() on date columns
  const rows = await db
    .select()
    .from(weeklyPayLog)
    .where(sql`DATE_FORMAT(${weeklyPayLog.weekStart}, '%Y-%m-%d') = ${weekStart}`)
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertWeeklyPayLog(data: {
  weekStart: string;
  weekEnd: string;
  paymentCycleId?: number;
  meritM1: number;
  meritM2: number;
  meritM3: number;
  meritStreak: number;
  demeritD1: number; demeritD2: number; demeritD3: number; demeritD4: number;
  demeritD5: number; demeritD6: number; demeritD7: number; demeritD8: number;
  demeritD9: number; demeritD10: number; demeritD11: number;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // Merit and demerit dollar amounts per unit (must match MERIT_AMOUNTS / DEMERIT_AMOUNTS in the frontend)
  const totalMerits =
    data.meritM1 * 5 + data.meritM2 * 7.5 + data.meritM3 * 1 + data.meritStreak * 10;
  const totalDemerits =
    data.demeritD1 * 5 + data.demeritD2 * 10 + data.demeritD3 * 5 + data.demeritD4 * 5 +
    data.demeritD5 * 10 + data.demeritD6 * 5 + data.demeritD7 * 5 + data.demeritD8 * 10 +
    data.demeritD9 * 15 + data.demeritD10 * 15 + data.demeritD11 * 15;
  const projectedPay = Math.max(0, 90 - totalDemerits + totalMerits);

  const payload = {
    weekStart: data.weekStart as unknown as Date,
    weekEnd: data.weekEnd as unknown as Date,
    paymentCycleId: data.paymentCycleId ?? null,
    baseAmount: "90.00",
    meritM1: String(data.meritM1),
    meritM2: String(data.meritM2),
    meritM3: String(data.meritM3),
    meritStreak: String(data.meritStreak),
    demeritD1: String(data.demeritD1),
    demeritD2: String(data.demeritD2),
    demeritD3: String(data.demeritD3),
    demeritD4: String(data.demeritD4),
    demeritD5: String(data.demeritD5),
    demeritD6: String(data.demeritD6),
    demeritD7: String(data.demeritD7),
    demeritD8: String(data.demeritD8),
    demeritD9: String(data.demeritD9),
    demeritD10: String(data.demeritD10),
    demeritD11: String(data.demeritD11),
    totalMerits: String(totalMerits),
    totalDemerits: String(totalDemerits),
    projectedPay: String(projectedPay),
    notes: data.notes ?? null,
  };

  await db.insert(weeklyPayLog).values([payload]).onDuplicateKeyUpdate({ set: payload });
  const saved = await getWeeklyPayLogByWeek(data.weekStart);
  if (!saved) throw new Error("Weekly pay log was not saved");
  return saved;
}

// ─── Daily Triage State ───────────────────────────────────────────────────────

export async function getTriageStateByDate(date: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(dailyTriageState)
    .where(sql`DATE_FORMAT(${dailyTriageState.triageDate}, '%Y-%m-%d') = ${date}`)
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertTriageState(data: {
  triageDate: string;
  step1Done?: boolean;
  step2Done?: boolean;
  step3Done?: boolean;
  step4Done?: boolean;
  step5Done?: boolean;
  focusTasks?: string | null;
  eveningStep1Done?: boolean;
  eveningStep2Done?: boolean;
  eveningStep3Done?: boolean;
  eveningStep4Done?: boolean;
  eodReport?: string | null;
  currentView?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const existing = await getTriageStateByDate(data.triageDate);

  const payload = {
    triageDate: data.triageDate as unknown as Date,
    step1Done: data.step1Done ?? false,
    step2Done: data.step2Done ?? false,
    step3Done: data.step3Done ?? false,
    step4Done: data.step4Done ?? false,
    step5Done: data.step5Done ?? false,
    focusTasks: data.focusTasks ?? null,
    eveningStep1Done: data.eveningStep1Done ?? false,
    eveningStep2Done: data.eveningStep2Done ?? false,
    eveningStep3Done: data.eveningStep3Done ?? false,
    eveningStep4Done: data.eveningStep4Done ?? false,
    eodReport: data.eodReport ?? null,
    currentView: data.currentView ?? "overview",
  };

  if (existing) {
    await db.update(dailyTriageState).set(payload).where(eq(dailyTriageState.id, existing.id));
    return { ...existing, ...payload };
  } else {
    const [result] = await db.insert(dailyTriageState).values([payload]);
    return { id: (result as any).insertId, ...payload };
  }
}

// ─── Sunday Checklist ─────────────────────────────────────────────────────────

import { sundayChecklist } from "../drizzle/schema";

export async function getSundayChecklist(sundayDate: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(sundayChecklist)
    .where(sql`DATE_FORMAT(${sundayChecklist.sundayDate}, '%Y-%m-%d') = ${sundayDate}`)
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertSundayChecklist(
  sundayDate: string,
  fields: Partial<Omit<typeof sundayChecklist.$inferInsert, "id" | "sundayDate" | "createdAt" | "updatedAt">>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getSundayChecklist(sundayDate);
  if (existing) {
    await db
      .update(sundayChecklist)
      .set(fields)
      .where(eq(sundayChecklist.id, existing.id));
    return { ...existing, ...fields };
  } else {
    const [result] = await db.insert(sundayChecklist).values([{
      sundayDate: sundayDate as unknown as Date,
      ...fields,
    }]);
    return { id: (result as any).insertId, sundayDate, ...fields };
  }
}

// ─── Daily Action Alert Tracking ─────────────────────────────────────────────

import {
  onHoldDailyChecks,
} from "../drizzle/schema";
import { and } from "drizzle-orm";

// ── Due Date Assignments ──────────────────────────────────────────────────────

// ── Daily Card Updates ────────────────────────────────────────────────────────

// ── ON-HOLD Per-Card Daily Checks ─────────────────────────────────────────────

/**
 * Get the ON-HOLD check record for a specific card on a specific date.
 */
export async function getOnHoldCheck(cardId: string, date: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(onHoldDailyChecks)
    .where(
      and(
        eq(onHoldDailyChecks.cardId, cardId),
        sql`DATE_FORMAT(${onHoldDailyChecks.date}, '%Y-%m-%d') = ${date}`
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Get all ON-HOLD check records for a specific date.
 */
export async function getOnHoldChecksByDate(date: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(onHoldDailyChecks)
    .where(sql`DATE_FORMAT(${onHoldDailyChecks.date}, '%Y-%m-%d') = ${date}`);
}

/** Get ON-HOLD check records for an inclusive date range in one query. */
export async function getOnHoldChecksBetween(startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(onHoldDailyChecks)
    .where(and(
      sql`DATE_FORMAT(${onHoldDailyChecks.date}, '%Y-%m-%d') >= ${startDate}`,
      sql`DATE_FORMAT(${onHoldDailyChecks.date}, '%Y-%m-%d') <= ${endDate}`,
    ));
}

/**
 * Mark a specific ON-HOLD card as checked for today (upsert).
 */
export async function markOnHoldCardChecked(
  cardId: string,
  cardName: string,
  cardUrl: string,
  date: string,
  checked: boolean
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const existing = await getOnHoldCheck(cardId, date);
  const now = checked ? new Date() : null;

  if (existing) {
    await db
      .update(onHoldDailyChecks)
      .set({ checked, checkedAt: now })
      .where(eq(onHoldDailyChecks.id, existing.id));
    return { ...existing, checked, checkedAt: now };
  } else {
    const [result] = await db.insert(onHoldDailyChecks).values([{
      cardId,
      cardName,
      cardUrl,
      date: date as unknown as Date,
      checked,
      checkedAt: now,
    }]);
    return { id: (result as any).insertId, cardId, cardName, cardUrl, date, checked, checkedAt: now };
  }
}

// ── Daily Update Streak ───────────────────────────────────────────────────────

import { dailyUpdateStreak } from "../drizzle/schema";

/**
 * Record that Joyce completed all DOING card updates before 23:00 on a given date.
 * Upserts a row for the given date.
 */
export async function recordStreakDay(
  streakDate: string,
  completedBeforeDeadline: boolean,
  doingCardCount: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const rows = await db
    .select()
    .from(dailyUpdateStreak)
    .where(sql`DATE_FORMAT(${dailyUpdateStreak.streakDate}, '%Y-%m-%d') = ${streakDate}`)
    .limit(1);

  const existing = rows[0] ?? null;
  const now = completedBeforeDeadline ? new Date() : null;

  if (existing) {
    await db
      .update(dailyUpdateStreak)
      .set({ completedBeforeDeadline, completedAt: now, doingCardCount })
      .where(eq(dailyUpdateStreak.id, existing.id));
    return { ...existing, completedBeforeDeadline, completedAt: now, doingCardCount };
  } else {
    const [result] = await db.insert(dailyUpdateStreak).values([{
      streakDate: streakDate as unknown as Date,
      completedBeforeDeadline,
      completedAt: now,
      doingCardCount,
    }]);
    return { id: (result as any).insertId, streakDate, completedBeforeDeadline, completedAt: now, doingCardCount };
  }
}

/**
 * Compute the current streak: how many consecutive days (ending today or yesterday)
 * Joyce completed all DOING card updates before 23:00.
 * Returns { currentStreak, longestStreak, lastCompletedDate }.
 */
export async function getUpdateStreak(): Promise<{
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
}> {
  const db = await getDb();
  if (!db) return { currentStreak: 0, longestStreak: 0, lastCompletedDate: null };

  // Fetch all successful days ordered newest-first
  const rows = await db
    .select()
    .from(dailyUpdateStreak)
    .where(eq(dailyUpdateStreak.completedBeforeDeadline, true))
    .orderBy(desc(dailyUpdateStreak.streakDate));

  if (rows.length === 0) return { currentStreak: 0, longestStreak: 0, lastCompletedDate: null };

  // Convert date values to YYYY-MM-DD strings
  const dates: string[] = rows.map(r => {
    const d = r.streakDate as unknown;
    if (typeof d === "string") return (d as string).slice(0, 10);
    if (d instanceof Date) return (d as Date).toISOString().slice(0, 10);
    return String(d).slice(0, 10);
  });

  const lastCompletedDate = dates[0];

  // Compute current streak (consecutive days ending today or yesterday EAT)
  const eatNow = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const todayEAT = eatNow.toISOString().slice(0, 10);
  const yesterdayEAT = new Date(eatNow.getTime() - 86400000).toISOString().slice(0, 10);

  let currentStreak = 0;
  // Only count streak if the most recent completion was today or yesterday
  if (dates[0] === todayEAT || dates[0] === yesterdayEAT) {
    let expected = dates[0];
    for (const d of dates) {
      if (d === expected) {
        currentStreak++;
        // Move expected back one day
        const prev = new Date(expected + "T12:00:00Z");
        prev.setDate(prev.getDate() - 1);
        expected = prev.toISOString().slice(0, 10);
      } else {
        break;
      }
    }
  }

  // Compute longest streak
  let longestStreak = 0;
  let runLength = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + "T12:00:00Z");
    prev.setDate(prev.getDate() - 1);
    const expectedPrev = prev.toISOString().slice(0, 10);
    if (dates[i] === expectedPrev) {
      runLength++;
    } else {
      if (runLength > longestStreak) longestStreak = runLength;
      runLength = 1;
    }
  }
  if (runLength > longestStreak) longestStreak = runLength;

  return { currentStreak, longestStreak, lastCompletedDate };
}

// ── Time Entries ──────────────────────────────────────────────────────────────

import { appSettings, timeEntries } from "../drizzle/schema";
import { isNull, isNotNull, gte, lt, lte } from "drizzle-orm";

/** Start a timer while enforcing one globally active Joyce timer. */
export async function startTimer(
  cardId: string,
  cardName: string,
  cardUrl: string,
  boardName: string,
  listName: string
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const lockKey = "timer_switch_lock";
  await db.insert(appSettings).values({ key: lockKey, value: "single_active_timer" }).onDuplicateKeyUpdate({
    set: { value: sql`value` },
  });

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM app_settings WHERE ${appSettings.key} = ${lockKey} FOR UPDATE`);
    const running = await tx
      .select({ cardId: timeEntries.cardId })
      .from(timeEntries)
      .where(isNull(timeEntries.stoppedAt));
    const startedAt = new Date();

    await tx
      .update(timeEntries)
      .set({
        stoppedAt: startedAt,
        durationSeconds: sql`TIMESTAMPDIFF(SECOND, startedAt, ${startedAt})`,
      })
      .where(isNull(timeEntries.stoppedAt));

    const [result] = await tx.insert(timeEntries).values([{
      cardId,
      cardName,
      cardUrl,
      boardName,
      listName,
      startedAt,
      stoppedAt: null,
      durationSeconds: null,
    }]);
    return {
      id: (result as any).insertId,
      cardId,
      cardName,
      startedAt,
      stoppedCardIds: Array.from(new Set(running.map((entry) => entry.cardId))),
    };
  });
}

/**
 * Stop the running timer for a card. Returns the completed entry.
 */
export async function stopTimer(cardId: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const running = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.cardId, cardId), isNull(timeEntries.stoppedAt)))
    .limit(1);

  if (!running[0]) return null;

  const now = new Date();
  const durationSeconds = Math.round((now.getTime() - running[0].startedAt.getTime()) / 1000);

  await db
    .update(timeEntries)
    .set({ stoppedAt: now, durationSeconds })
    .where(eq(timeEntries.id, running[0].id));

  return { ...running[0], stoppedAt: now, durationSeconds };
}

/**
 * Get the currently running timer entry (if any).
 */
export async function getActiveTimer() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(timeEntries)
    .where(isNull(timeEntries.stoppedAt))
    .orderBy(desc(timeEntries.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Get all completed time entries for a specific card, newest first.
 */
export async function getTimeEntriesForCard(cardId: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.cardId, cardId), isNotNull(timeEntries.stoppedAt)))
    .orderBy(desc(timeEntries.startedAt))
    .limit(limit);
}

/** Bulk time history for portfolio-wide estimate calibration. */
export async function getTimeEntriesSince(since: Date, limit = 20_000) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(timeEntries)
    .where(gte(timeEntries.startedAt, since))
    .orderBy(desc(timeEntries.startedAt))
    .limit(Math.max(1, Math.min(limit, 50_000)));
}

/**
 * Get all time entries for a specific date (EAT = UTC+3), grouped by card.
 * Returns an array of { cardId, cardName, cardUrl, boardName, listName, totalSeconds, entryCount }.
 */
export async function getDailyTimeSummary(dateEAT: string): Promise<Array<{
  cardId: string;
  cardName: string;
  cardUrl: string;
  boardName: string;
  listName: string;
  totalSeconds: number;
  entryCount: number;
}>> {
  const db = await getDb();
  if (!db) return [];

  const { startUtc, endUtc } = eatDateRangeUtc(dateEAT);

  const rows = await db
    .select()
    .from(timeEntries)
    .where(
      and(
        isNotNull(timeEntries.stoppedAt),
        gte(timeEntries.startedAt, startUtc),
        lt(timeEntries.startedAt, endUtc)
      )
    )
    .orderBy(desc(timeEntries.startedAt));

  // Group by cardId
  const map = new Map<string, {
    cardId: string; cardName: string; cardUrl: string;
    boardName: string; listName: string;
    totalSeconds: number; entryCount: number;
  }>();

  for (const row of rows) {
    const existing = map.get(row.cardId);
    const secs = row.durationSeconds ?? 0;
    if (existing) {
      existing.totalSeconds += secs;
      existing.entryCount++;
    } else {
      map.set(row.cardId, {
        cardId: row.cardId,
        cardName: row.cardName,
        cardUrl: row.cardUrl,
        boardName: row.boardName,
        listName: row.listName,
        totalSeconds: secs,
        entryCount: 1,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
}

/**
 * Get total tracked seconds for a date range (for weekly hours calculation).
 * Returns total seconds across all completed entries whose startedAt falls in [startUTC, endUTC].
 */
export async function getTrackedSecondsInRange(startDate: string, endDate: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const { startUtc, endUtc } = eatDateSpanUtc(startDate, endDate);

  const rows = await db
    .select({ durationSeconds: timeEntries.durationSeconds })
    .from(timeEntries)
    .where(
      and(
        isNotNull(timeEntries.stoppedAt),
        gte(timeEntries.startedAt, startUtc),
        lt(timeEntries.startedAt, endUtc)
      )
    );

  return rows.reduce((sum, r) => sum + (r.durationSeconds ?? 0), 0);
}

/**
 * Delete a specific time entry by ID.
 */
export async function deleteTimeEntry(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [entry] = await db.select({ cardId: timeEntries.cardId }).from(timeEntries).where(eq(timeEntries.id, id)).limit(1);
  if (!entry) throw new Error("Time entry not found");
  await db.delete(timeEntries).where(eq(timeEntries.id, id));
  return { success: true, id, cardId: entry.cardId };
}

/**
 * Update a specific time entry's duration (for correction after accidental overnight timers).
 * Recalculates stoppedAt based on startedAt + new durationSeconds.
 */
export async function updateTimeEntry(id: number, durationSeconds: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const rows = await db.select().from(timeEntries).where(eq(timeEntries.id, id)).limit(1);
  if (rows.length === 0) throw new Error("Time entry not found");
  const entry = rows[0];
  const newStoppedAt = new Date(new Date(entry.startedAt).getTime() + durationSeconds * 1000);
  await db
    .update(timeEntries)
    .set({ durationSeconds, stoppedAt: newStoppedAt })
    .where(eq(timeEntries.id, id));
  return { success: true, id, cardId: entry.cardId, durationSeconds, stoppedAt: newStoppedAt };
}

/**
 * Get individual time entries for a specific card on a specific date (EAT).
 * Returns completed entries only (stoppedAt is not null).
 */
export async function getTimeEntriesForCardOnDate(cardId: string, dateEAT: string) {
  const db = await getDb();
  if (!db) return [];
  const { startUtc, endUtc } = eatDateRangeUtc(dateEAT);
  return db
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.cardId, cardId),
        isNotNull(timeEntries.stoppedAt),
        gte(timeEntries.startedAt, startUtc),
        lt(timeEntries.startedAt, endUtc)
      )
    )
    .orderBy(desc(timeEntries.startedAt));
}

/**
 * Get all currently running timers (stoppedAt IS NULL).
 * Used by the midnight auto-stop safety net.
 */
export async function getAllRunningTimers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(timeEntries)
    .where(isNull(timeEntries.stoppedAt));
}

/**
 * Auto-stop all running timers, capping duration at maxSeconds (default 12h).
 * Returns the list of stopped entries with their capped durations and a wasCapped flag.
 */
export async function autoStopAllRunningTimers(maxSeconds = 12 * 3600) {
  const running = await getAllRunningTimers();
  if (running.length === 0) return [];

  const now = new Date();
  const stopped = [];

  for (const entry of running) {
    const rawSeconds = Math.round((now.getTime() - entry.startedAt.getTime()) / 1000);
    const durationSeconds = Math.min(rawSeconds, maxSeconds);
    const db = await getDb();
    if (!db) continue;
    await db
      .update(timeEntries)
      .set({ stoppedAt: now, durationSeconds })
      .where(eq(timeEntries.id, entry.id));
    stopped.push({ ...entry, stoppedAt: now, durationSeconds, wasCapped: rawSeconds > maxSeconds });
  }

  return stopped;
}

/**
 * Get tracked seconds per day for a given Mon–Sun week range (EAT dates).
 * Returns an array of 7 objects: { date: "YYYY-MM-DD", totalSeconds: number }
 */
export async function getWeeklyBreakdown(startDate: string, endDate: string): Promise<{ date: string; totalSeconds: number }[]> {
  const db = await getDb();
  if (!db) return [];

  // Build the 7 day slots
  const days: { date: string; totalSeconds: number }[] = [];
  for (let i = 0; i < 7; i++) {
    days.push({ date: addDaysToDateKey(startDate, i), totalSeconds: 0 });
  }

  const { startUtc, endUtc } = eatDateSpanUtc(startDate, endDate);

  // Fetch all completed entries in the week
  const rows = await db
    .select({
      startedAt: timeEntries.startedAt,
      durationSeconds: timeEntries.durationSeconds,
    })
    .from(timeEntries)
    .where(
      and(
        isNotNull(timeEntries.stoppedAt),
        isNotNull(timeEntries.durationSeconds),
        gte(timeEntries.startedAt, startUtc),
        lt(timeEntries.startedAt, endUtc)
      )
    );

  // Bucket by EAT date (UTC+3)
  for (const row of rows) {
    const eatDate = new Date(row.startedAt.getTime() + 3 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const slot = days.find(d => d.date === eatDate);
    if (slot) slot.totalSeconds += row.durationSeconds ?? 0;
  }

  return days;
}

// ─── App Settings helpers ─────────────────────────────────────────────────────

/**
 * Get the daily goal in hours (default 9 if not set).
 * Reads from the app_settings table, key = 'dailyGoalHours'.
 */
export async function getDailyGoalHours(): Promise<number> {
  const db = await getDb();
  if (!db) return 9;
  try {
    const rows = await (db as any).execute(
      "SELECT value FROM app_settings WHERE `key` = 'dailyGoalHours' LIMIT 1"
    );
    const data = Array.isArray(rows) ? rows[0] : rows;
    const arr = Array.isArray(data) ? data : [];
    if (arr.length > 0 && arr[0]?.value != null) {
      const v = parseFloat(arr[0].value);
      if (!isNaN(v) && v >= 1 && v <= 24) return v;
    }
    return 9;
  } catch {
    return 9;
  }
}

/**
 * Persist the daily goal in hours (must be between 1 and 24).
 */
export async function setDailyGoalHours(hours: number): Promise<void> {
  if (hours < 1 || hours > 24) throw new Error("Daily goal must be between 1 and 24 hours");
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const val = String(hours);
  // drizzle-orm mysql2 execute() requires a sql`` tagged template — raw strings
  // with a separate params array are not supported and silently drop parameters.
  await db.execute(
    sql`INSERT INTO app_settings (\`key\`, value) VALUES ('dailyGoalHours', ${val}) ON DUPLICATE KEY UPDATE value = ${val}`
  );
}

// ─── Trello Comment Token helpers ────────────────────────────────────────────

/**
 * Get the Trello token used for posting comments.
 * Returns null if not set (caller should fall back to TrelloAPIToken env var).
 */
export async function getTrelloCommentToken(): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await (db as any).execute(
      "SELECT value FROM app_settings WHERE `key` = 'trelloCommentToken' LIMIT 1"
    );
    const data = Array.isArray(rows) ? rows[0] : rows;
    const arr = Array.isArray(data) ? data : [];
    if (arr.length > 0 && arr[0]?.value) return arr[0].value as string;
    return null;
  } catch {
    return null;
  }
}

/**
 * Persist (or clear) the Trello comment token.
 * Pass null or empty string to clear it.
 */
export async function setTrelloCommentToken(token: string | null): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!token) {
    // Clear: delete the row if it exists
    await db.execute(
      sql`DELETE FROM app_settings WHERE \`key\` = 'trelloCommentToken'`
    );
  } else {
    await db.execute(
      sql`INSERT INTO app_settings (\`key\`, value) VALUES ('trelloCommentToken', ${token}) ON DUPLICATE KEY UPDATE value = ${token}`
    );
  }
}

// ─── Compliance Snapshot helpers ─────────────────────────────────────────────

export interface ComplianceSnapshotRow {
  id: number;
  snapshotDate: string;
  onHoldTotal: number;
  onHoldReviewed: number;
  onHoldMissedCards: Array<{ id: string; name: string; url: string }>;
  doingTotal: number;
  doingUpdated: number;
  doingMissedCards: Array<{ id: string; name: string; url: string }>;
  d1Instances: number;
  estimatedPenalty: number;
  source: string;
  weeklyPayLogId: number | null;
  required: boolean;
  verificationStatus: string;
  verificationMethod: string | null;
  verificationCutoffAt: Date | null;
  verifiedAt: Date | null;
  evidenceCount: number;
  compliancePct: number; // computed: (onHoldReviewed + doingUpdated) / (onHoldTotal + doingTotal) * 100
  createdAt: Date;
}

export type ComplianceSnapshotInput = {
  snapshotDate: string;
  onHoldTotal: number;
  onHoldReviewed: number;
  onHoldMissedCards: Array<{ id: string; name: string; url: string }>;
  doingTotal: number;
  doingUpdated: number;
  doingMissedCards: Array<{ id: string; name: string; url: string }>;
  d1Instances: number;
  estimatedPenalty: number;
  source?: string;
  weeklyPayLogId?: number | null;
  required?: boolean;
  verificationStatus?: string;
  verificationMethod?: string | null;
  verificationCutoffAt?: Date | null;
  verifiedAt?: Date | null;
  evidenceCount?: number;
};

export type ComplianceCardEvidenceInput = {
  snapshotDate: string;
  cardId: string;
  cardName: string;
  cardUrl: string;
  boardName: string;
  listName: string;
  category: "doing" | "on-hold";
  assignedToJoyce: boolean;
  compliant: boolean;
  evidenceType: string;
  evidenceActionId: string | null;
  evidenceAt: Date | null;
  evidenceJson: string;
  verifiedAt: Date;
};

function parseCards(raw: string | null): Array<{ id: string; name: string; url: string }> {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function calcPct(reviewed: number, updated: number, holdTotal: number, doingTotal: number): number {
  const total = holdTotal + doingTotal;
  if (total === 0) return 100;
  return Math.round(((reviewed + updated) / total) * 100);
}

/**
 * Upsert a compliance snapshot for a given date.
 */
function complianceSnapshotUpsertQuery(data: ComplianceSnapshotInput) {
  const holdJson = JSON.stringify(data.onHoldMissedCards);
  const doingJson = JSON.stringify(data.doingMissedCards);
  const src = data.source ?? "auto";
  const wplId = data.weeklyPayLogId ?? null;
  const required = data.required ?? true;
  const verificationStatus = data.verificationStatus ?? "unverified";
  const verificationMethod = data.verificationMethod ?? null;
  const verificationCutoffAt = data.verificationCutoffAt ?? null;
  const verifiedAt = data.verifiedAt ?? null;
  const evidenceCount = data.evidenceCount ?? 0;
  return sql`INSERT INTO daily_compliance_snapshots
      (snapshotDate, onHoldTotal, onHoldReviewed, onHoldMissedCards,
       doingTotal, doingUpdated, doingMissedCards,
       d1Instances, estimatedPenalty, source, weeklyPayLogId,
       required, verificationStatus, verificationMethod, verificationCutoffAt, verifiedAt, evidenceCount)
    VALUES
      (${data.snapshotDate}, ${data.onHoldTotal}, ${data.onHoldReviewed}, ${holdJson},
       ${data.doingTotal}, ${data.doingUpdated}, ${doingJson},
       ${data.d1Instances}, ${data.estimatedPenalty}, ${src}, ${wplId},
       ${required}, ${verificationStatus}, ${verificationMethod}, ${verificationCutoffAt}, ${verifiedAt}, ${evidenceCount})
    ON DUPLICATE KEY UPDATE
      onHoldTotal = VALUES(onHoldTotal),
      onHoldReviewed = VALUES(onHoldReviewed),
      onHoldMissedCards = VALUES(onHoldMissedCards),
      doingTotal = VALUES(doingTotal),
      doingUpdated = VALUES(doingUpdated),
      doingMissedCards = VALUES(doingMissedCards),
      d1Instances = VALUES(d1Instances),
      estimatedPenalty = VALUES(estimatedPenalty),
      source = VALUES(source),
      weeklyPayLogId = COALESCE(VALUES(weeklyPayLogId), weeklyPayLogId),
      required = VALUES(required),
      verificationStatus = VALUES(verificationStatus),
      verificationMethod = VALUES(verificationMethod),
      verificationCutoffAt = VALUES(verificationCutoffAt),
      verifiedAt = VALUES(verifiedAt),
      evidenceCount = VALUES(evidenceCount)`;
}

export async function upsertComplianceSnapshot(data: ComplianceSnapshotInput): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(complianceSnapshotUpsertQuery(data));
}

/** Persist a verified daily aggregate and its per-card evidence atomically. */
export async function upsertVerifiedComplianceSnapshot(
  data: ComplianceSnapshotInput,
  evidence: ComplianceCardEvidenceInput[],
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    await tx.execute(complianceSnapshotUpsertQuery({ ...data, evidenceCount: evidence.length }));
    await tx.delete(complianceCardEvidence)
      .where(sql`DATE_FORMAT(${complianceCardEvidence.snapshotDate}, '%Y-%m-%d') = ${data.snapshotDate}`);
    if (evidence.length > 0) {
      await tx.insert(complianceCardEvidence).values(evidence.map((row) => ({
        ...row,
        snapshotDate: row.snapshotDate as unknown as Date,
      })));
    }
  });
}

/**
 * Get the last N compliance snapshots, newest first.
 */
export async function getComplianceHistory(limit = 30): Promise<ComplianceSnapshotRow[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 400));
    const rows: any[] = await (db as any).execute(
      `SELECT id, snapshotDate, onHoldTotal, onHoldReviewed, onHoldMissedCards,
              doingTotal, doingUpdated, doingMissedCards,
              d1Instances, estimatedPenalty, source, weeklyPayLogId,
              required, verificationStatus, verificationMethod, verificationCutoffAt,
              verifiedAt, evidenceCount, createdAt
       FROM daily_compliance_snapshots
       ORDER BY snapshotDate DESC
       LIMIT ${safeLimit}`
    ).then((r: any) => (Array.isArray(r[0]) ? r[0] : r));
    return rows.map((r: any) => ({
      id: Number(r.id),
      snapshotDate: r.snapshotDate instanceof Date
        ? r.snapshotDate.toISOString().slice(0, 10)
        : String(r.snapshotDate),
      onHoldTotal: Number(r.onHoldTotal),
      onHoldReviewed: Number(r.onHoldReviewed),
      onHoldMissedCards: parseCards(r.onHoldMissedCards),
      doingTotal: Number(r.doingTotal),
      doingUpdated: Number(r.doingUpdated),
      doingMissedCards: parseCards(r.doingMissedCards),
      d1Instances: Number(r.d1Instances),
      estimatedPenalty: Number(r.estimatedPenalty),
      source: r.source ?? "auto",
      weeklyPayLogId: r.weeklyPayLogId != null ? Number(r.weeklyPayLogId) : null,
      required: r.required == null ? true : Boolean(r.required),
      verificationStatus: r.verificationStatus ?? "unverified",
      verificationMethod: r.verificationMethod ?? null,
      verificationCutoffAt: r.verificationCutoffAt ? new Date(r.verificationCutoffAt) : null,
      verifiedAt: r.verifiedAt ? new Date(r.verifiedAt) : null,
      evidenceCount: Number(r.evidenceCount ?? 0),
      compliancePct: calcPct(Number(r.onHoldReviewed), Number(r.doingUpdated), Number(r.onHoldTotal), Number(r.doingTotal)),
      createdAt: r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt),
    }));
  } catch (e) {
    console.error("[DB] getComplianceHistory error:", e);
    return [];
  }
}

/** Get the auditable card facts behind one verified daily snapshot. */
export async function getComplianceEvidenceByDate(dateKey: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    cardId: complianceCardEvidence.cardId,
    cardName: complianceCardEvidence.cardName,
    cardUrl: complianceCardEvidence.cardUrl,
    boardName: complianceCardEvidence.boardName,
    listName: complianceCardEvidence.listName,
    category: complianceCardEvidence.category,
    assignedToJoyce: complianceCardEvidence.assignedToJoyce,
    compliant: complianceCardEvidence.compliant,
    evidenceType: complianceCardEvidence.evidenceType,
    evidenceActionId: complianceCardEvidence.evidenceActionId,
    evidenceAt: complianceCardEvidence.evidenceAt,
    verifiedAt: complianceCardEvidence.verifiedAt,
  }).from(complianceCardEvidence)
    .where(sql`DATE_FORMAT(${complianceCardEvidence.snapshotDate}, '%Y-%m-%d') = ${dateKey}`)
    .orderBy(asc(complianceCardEvidence.category), desc(complianceCardEvidence.compliant), asc(complianceCardEvidence.cardName));
  return rows.map((row) => ({ ...row, assignedToJoyce: Boolean(row.assignedToJoyce), compliant: Boolean(row.compliant) }));
}

/**
 * Get 7-day rolling average compliance percentage.
 */
export async function getComplianceRollingAvg(days = 7): Promise<number> {
  const rows = (await getComplianceHistory(Math.max(days * 2, days))).filter((row) => row.required).slice(0, days);
  if (rows.length === 0) return 100;
  const sum = rows.reduce((acc, r) => acc + r.compliancePct, 0);
  return Math.round(sum / rows.length);
}

/**
 * Get average compliance % for a specific week (Mon–Sun).
 * weekStart: "YYYY-MM-DD" (Monday)
 */
export async function getComplianceAvgForWeek(weekStart: string): Promise<number | null> {
  const monday = new Date(weekStart);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekEnd = sunday.toISOString().slice(0, 10);
  const rows = await getComplianceHistory(400);
  const weekRows = rows.filter(r => r.required && r.snapshotDate >= weekStart && r.snapshotDate <= weekEnd);
  if (weekRows.length === 0) return null;
  const sum = weekRows.reduce((acc, r) => acc + r.compliancePct, 0);
  return Math.round(sum / weekRows.length);
}

export interface BreakSlot {
  name: string;       // e.g. "Breakfast"
  startTime: string;  // HH:MM (24h, Kenyan time)
  durationMinutes: number;
  icon?: string;      // emoji icon e.g. "☕", "🍽️", "🌙"
}

export interface ScheduleSettings {
  startTime: string;       // HH:MM — when Joyce starts work
  endTime: string;         // HH:MM — when Joyce logs off
  breaks: BreakSlot[];     // ordered list of break slots
  typingPractice?: boolean;         // whether to include typing practice at EOD (default true)
  typingPracticeMinutes?: number;   // duration in minutes (default 30)
}

const DEFAULT_SCHEDULE: ScheduleSettings = {
  startTime: "08:00",
  endTime: "23:00",
  breaks: [
    { name: "Breakfast", startTime: "09:00", durationMinutes: 30, icon: "☕" },
    { name: "Lunch",     startTime: "14:30", durationMinutes: 45, icon: "🍽️" },
    { name: "Dinner",    startTime: "19:15", durationMinutes: 90, icon: "🌙" },
  ],
  typingPractice: true,
  typingPracticeMinutes: 30,
};

export async function getScheduleSettings(): Promise<ScheduleSettings> {
  const db = await getDb();
  if (!db) return DEFAULT_SCHEDULE;
  try {
    const rows = await (db as any).execute(
      "SELECT value FROM app_settings WHERE `key` = 'scheduleSettings' LIMIT 1"
    );
    const data = Array.isArray(rows) ? rows[0] : rows;
    const arr = Array.isArray(data) ? data : [];
    if (arr.length > 0 && arr[0]?.value) {
      const parsed = JSON.parse(arr[0].value);
      if (parsed && parsed.startTime && parsed.endTime && Array.isArray(parsed.breaks)) {
        return parsed as ScheduleSettings;
      }
    }
    return DEFAULT_SCHEDULE;
  } catch {
    return DEFAULT_SCHEDULE;
  }
}

export async function setScheduleSettings(settings: ScheduleSettings): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const val = JSON.stringify(settings);
  await db.execute(
    sql`INSERT INTO app_settings (\`key\`, value) VALUES ('scheduleSettings', ${val}) ON DUPLICATE KEY UPDATE value = ${val}`
  );
  const { getOperatingProfile, upsertOperatingProfile } = await import("./operatingCalendar");
  const current = await getOperatingProfile();
  await upsertOperatingProfile({
    ...current,
    workStart: settings.startTime,
    workEnd: settings.endTime,
    breaks: settings.breaks.map(({ name, startTime, durationMinutes }) => ({ name, startTime, durationMinutes })),
  });
}


// ─── Triage History ───────────────────────────────────────────────────────────
/**
 * Returns the last N triage records that have an EOD report, newest first.
 * Used to show "Past Reports" on the Triage intro screen.
 */
export async function getRecentTriageReports(limit = 7) {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await (db as any).execute(
      `SELECT id, triageDate, eodReport, step1Done, step2Done, step3Done, step4Done, step5Done,
              eveningStep1Done, eveningStep2Done, eveningStep3Done, eveningStep4Done
       FROM daily_triage_state
       WHERE eodReport IS NOT NULL AND eodReport != ''
       ORDER BY triageDate DESC
       LIMIT ${limit}`
    );
    const data = Array.isArray(rows) ? rows[0] : rows;
    return (Array.isArray(data) ? data : []) as Array<{
      id: number;
      triageDate: string;
      eodReport: string;
      step1Done: boolean;
      step2Done: boolean;
      step3Done: boolean;
      step4Done: boolean;
      step5Done: boolean;
      eveningStep1Done: boolean;
      eveningStep2Done: boolean;
      eveningStep3Done: boolean;
      eveningStep4Done: boolean;
    }>;
  } catch {
    return [];
  }
}

// ─── Reply Monitor Badge Setting ─────────────────────────────────────────────
/**
 * Get whether the Reply Monitor sidebar badge (count of active flags) is shown.
 * Defaults to true.
 */
export async function getReplyMonitorBadgeEnabled(): Promise<boolean> {
  const db = await getDb();
  if (!db) return true;
  try {
    const rows = await (db as any).execute(
      "SELECT value FROM app_settings WHERE `key` = 'replyMonitorBadge' LIMIT 1"
    );
    const data = Array.isArray(rows) ? rows[0] : rows;
    const arr = Array.isArray(data) ? data : [];
    if (arr.length > 0 && arr[0]?.value != null) {
      return arr[0].value !== "false";
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Persist the Reply Monitor badge toggle.
 */
export async function setReplyMonitorBadgeEnabled(enabled: boolean): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const val = enabled ? "true" : "false";
  await db.execute(
    sql`INSERT INTO app_settings (\`key\`, value) VALUES ('replyMonitorBadge', ${val}) ON DUPLICATE KEY UPDATE value = ${val}`
  );
}

// ─── Email Tasks ──────────────────────────────────────────────────────────────
export type NavigationCounts = {
  replyMonitorEnabled: boolean;
  pendingThreads: number;
  vagueFlags: number;
  unsignedFlags: number;
  emailCount: number;
  followUpCount: number;
  operationalCardCount: number;
};

const EMPTY_NAVIGATION_COUNTS: NavigationCounts = {
  replyMonitorEnabled: true,
  pendingThreads: 0,
  vagueFlags: 0,
  unsignedFlags: 0,
  emailCount: 0,
  followUpCount: 0,
  operationalCardCount: 0,
};

/** One lightweight aggregate for the always-mounted navigation badges. */
export async function getNavigationCounts(): Promise<NavigationCounts> {
  const db = await getDb();
  if (!db) return EMPTY_NAVIGATION_COUNTS;
  try {
    const result = await db.execute(sql`
      SELECT
        COALESCE((SELECT IF(value = 'false', 0, 1) FROM app_settings WHERE \`key\` = 'replyMonitorBadge' LIMIT 1), 1) AS replyMonitorEnabled,
        (SELECT COUNT(*) FROM reply_threads WHERE status IN ('pending', 'overdue')) AS pendingThreads,
        (SELECT COUNT(*) FROM vague_reply_flags WHERE resolvedAt IS NULL) AS vagueFlags,
        (SELECT COUNT(*) FROM unsigned_message_flags WHERE resolvedAt IS NULL) AS unsignedFlags,
        (SELECT COUNT(*) FROM email_tasks WHERE status <> 'archived') AS emailCount,
        (SELECT COUNT(*) FROM auto_follow_up_drafts WHERE status = 'pending') AS followUpCount,
        (SELECT COUNT(*) FROM card_states WHERE state IN (
          'OVERDUE',
          'WAITING_FOR_JOYCE',
          'WAITING_FOR_ROBERT',
          'WAITING_FOR_EXTERNAL_PARTY',
          'BLOCKED_BY_OTHER_CARD',
          'STALLED',
          'NEEDS_RESTRUCTURING'
        )) AS operationalCardCount
    `);
    const resultRows = Array.isArray(result) ? result[0] : result;
    const row = (Array.isArray(resultRows) ? resultRows[0] : resultRows) as Record<string, unknown> | undefined;
    if (!row) return EMPTY_NAVIGATION_COUNTS;
    const count = (key: keyof NavigationCounts) => Math.max(0, Number(row[key] ?? 0) || 0);
    return {
      replyMonitorEnabled: Number(row.replyMonitorEnabled ?? 1) !== 0,
      pendingThreads: count("pendingThreads"),
      vagueFlags: count("vagueFlags"),
      unsignedFlags: count("unsignedFlags"),
      emailCount: count("emailCount"),
      followUpCount: count("followUpCount"),
      operationalCardCount: count("operationalCardCount"),
    };
  } catch (error) {
    console.warn("[Database] Navigation counts unavailable:", error instanceof Error ? error.message : String(error));
    return EMPTY_NAVIGATION_COUNTS;
  }
}

import { emailTasks, cardSnoozes, InsertEmailTask, InsertCardSnooze } from "../drizzle/schema";
import { ne } from "drizzle-orm";

/**
 * Upsert an email task by gmailMessageId (dedup).
 */
export async function upsertEmailTask(task: InsertEmailTask): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(emailTasks).values(task).onDuplicateKeyUpdate({
    set: {
      subject: task.subject,
      fromAddress: task.fromAddress,
      fromName: task.fromName,
      snippet: task.snippet,
      receivedAt: task.receivedAt,
      category: task.category,
      status: task.status,
      deadlineAt: task.deadlineAt,
      trelloCardId: task.trelloCardId,
      trelloCardName: task.trelloCardName,
      trelloCardUrl: task.trelloCardUrl,
      suggestedNextAction: task.suggestedNextAction,
      llmSummary: task.llmSummary,
    },
  });
}

/** Get all email tasks, ordered by receivedAt desc. */
export async function getAllEmailTasks(): Promise<(typeof emailTasks.$inferSelect)[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(emailTasks).orderBy(desc(emailTasks.receivedAt));
  } catch { return []; }
}

/** Get pending (not archived) email tasks. */
export async function getPendingEmailTasks(): Promise<(typeof emailTasks.$inferSelect)[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(emailTasks)
      .where(ne(emailTasks.status, "archived"))
      .orderBy(desc(emailTasks.receivedAt));
  } catch { return []; }
}

/** Update email task status. */
export async function updateEmailTaskStatus(
  id: number,
  status: "pending" | "processed" | "archived",
  extra?: { trelloCardId?: string; trelloCardName?: string; trelloCardUrl?: string; suggestedNextAction?: string; llmSummary?: string }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  await db.update(emailTasks).set({
    status,
    ...(status === "processed" ? { processedAt: now } : {}),
    ...(status === "archived" ? { archivedAt: now } : {}),
    ...(extra ?? {}),
  }).where(eq(emailTasks.id, id));
}

/** Archive all non-archived email tasks (inbox zero). Returns count. */
export async function archiveAllEmailTasks(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  const result = await db.update(emailTasks).set({ status: "archived", archivedAt: now })
    .where(ne(emailTasks.status, "archived"));
  return (result as any)[0]?.affectedRows ?? 0;
}

/** Count of pending (non-archived) email tasks. */
export async function getPendingEmailCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  try {
    const rows = await db.select({ count: sql<number>`COUNT(*)` })
      .from(emailTasks).where(ne(emailTasks.status, "archived"));
    return Number(rows[0]?.count ?? 0);
  } catch { return 0; }
}

// ─── Card Snoozes ─────────────────────────────────────────────────────────────

/** Snooze a card until a given date. Deactivates any existing active snooze for the same card. */
export async function snoozeCard(snooze: InsertCardSnooze): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(cardSnoozes).set({ isActive: false })
    .where(and(eq(cardSnoozes.cardId, snooze.cardId), eq(cardSnoozes.isActive, true)));
  await db.insert(cardSnoozes).values(snooze);
}

/** Cancel (deactivate) an active snooze for a card. */
export async function cancelCardSnooze(cardId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(cardSnoozes).set({ isActive: false, resurfacedAt: new Date() })
    .where(and(eq(cardSnoozes.cardId, cardId), eq(cardSnoozes.isActive, true)));
}

/** Get set of card IDs that are currently snoozed (active + not expired). */
export async function getActiveSnoozedCardIds(): Promise<Set<string>> {
  const db = await getDb();
  if (!db) return new Set();
  try {
    const now = new Date();
    const rows = await db.select({ cardId: cardSnoozes.cardId })
      .from(cardSnoozes)
      .where(and(eq(cardSnoozes.isActive, true), gte(cardSnoozes.snoozedUntil, now)));
    return new Set(rows.map(r => r.cardId));
  } catch { return new Set(); }
}

/** Get all active snooze records (with metadata). */
export async function getActiveSnoozes(): Promise<(typeof cardSnoozes.$inferSelect)[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const now = new Date();
    return await db.select().from(cardSnoozes)
      .where(and(eq(cardSnoozes.isActive, true), gte(cardSnoozes.snoozedUntil, now)))
      .orderBy(asc(cardSnoozes.snoozedUntil));
  } catch { return []; }
}

/** Auto-resurface snoozes that have passed their snoozedUntil date. */
export async function resurfaceExpiredSnoozes(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  try {
    const now = new Date();
    const result = await db.update(cardSnoozes).set({ isActive: false, resurfacedAt: now })
      .where(and(eq(cardSnoozes.isActive, true), lte(cardSnoozes.snoozedUntil, now)));
    return (result as any)[0]?.affectedRows ?? 0;
  } catch { return 0; }
}

/** Get the active snooze for a specific card (if any). */
export async function getCardSnooze(cardId: string): Promise<(typeof cardSnoozes.$inferSelect) | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const now = new Date();
    const rows = await db.select().from(cardSnoozes)
      .where(and(eq(cardSnoozes.cardId, cardId), eq(cardSnoozes.isActive, true), gte(cardSnoozes.snoozedUntil, now)))
      .limit(1);
    return rows[0] ?? null;
  } catch { return null; }
}
