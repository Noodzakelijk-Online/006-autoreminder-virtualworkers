import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { timeEntries, type TimeEntry } from "../drizzle/schema";
import {
  addDaysToDateKey,
  dateKeyInEat,
  differenceInDateKeys,
  eatDateRangeUtc,
  eatDateSpanUtc,
} from "../shared/eatTime";
import { getDailyGoalHours, getDb } from "./db";
import {
  getOperatingProfile,
  listOperatingHolidays,
  resolveOperatingDay,
  type OperatingHolidayValue,
  type OperatingProfileValue,
} from "./operatingCalendar";

export type TimeEvidenceEntry = Pick<
  TimeEntry,
  | "id"
  | "cardId"
  | "cardName"
  | "cardUrl"
  | "boardName"
  | "listName"
  | "startedAt"
  | "stoppedAt"
  | "durationSeconds"
  | "notes"
  | "source"
  | "category"
  | "planDateKey"
  | "planBlockId"
  | "aptlssStepId"
  | "isVoided"
>;

export type AllocatedTimeEntry = TimeEvidenceEntry & {
  allocatedSeconds: number;
  active: boolean;
};

export type DailyTimeEvidence = {
  dateKey: string;
  calculatedAt: Date;
  isWorkday: boolean;
  protectedReason: string | null;
  targetSeconds: number;
  trackedSeconds: number;
  overtimeSeconds: number;
  entryCount: number;
  entries: AllocatedTimeEntry[];
  cards: Array<{
    cardId: string;
    cardName: string;
    cardUrl: string;
    boardName: string;
    listName: string;
    totalSeconds: number;
    entryCount: number;
  }>;
};

type TimeEvidencePolicy = {
  dailyGoalHours: number;
  profile: OperatingProfileValue;
  holidays: OperatingHolidayValue[];
};

function creditedEnd(entry: TimeEvidenceEntry, calculatedAt: Date): Date {
  if (!entry.stoppedAt) return calculatedAt;
  if (entry.durationSeconds == null) return entry.stoppedAt;
  const durationEnd = new Date(entry.startedAt.getTime() + Math.max(0, entry.durationSeconds) * 1_000);
  return durationEnd.getTime() < entry.stoppedAt.getTime() ? durationEnd : entry.stoppedAt;
}

function groupEntries(entries: AllocatedTimeEntry[]): DailyTimeEvidence["cards"] {
  const cards = new Map<string, DailyTimeEvidence["cards"][number]>();
  for (const entry of entries) {
    const current = cards.get(entry.cardId);
    if (current) {
      current.totalSeconds += entry.allocatedSeconds;
      current.entryCount += 1;
      continue;
    }
    cards.set(entry.cardId, {
      cardId: entry.cardId,
      cardName: entry.cardName,
      cardUrl: entry.cardUrl,
      boardName: entry.boardName,
      listName: entry.listName,
      totalSeconds: entry.allocatedSeconds,
      entryCount: 1,
    });
  }
  return Array.from(cards.values()).sort((left, right) => right.totalSeconds - left.totalSeconds);
}

/** Allocate credited timer duration across exact EAT calendar-day boundaries. */
export function buildDailyTimeEvidence(
  dateKey: string,
  entries: TimeEvidenceEntry[],
  policy: TimeEvidencePolicy,
  calculatedAt = new Date(),
): DailyTimeEvidence {
  const { startUtc, endUtc } = eatDateRangeUtc(dateKey);
  const effectiveEnd = calculatedAt.getTime() < endUtc.getTime() ? calculatedAt : endUtc;
  const allocated = entries.flatMap((entry): AllocatedTimeEntry[] => {
    const end = creditedEnd(entry, calculatedAt);
    const overlapStart = Math.max(entry.startedAt.getTime(), startUtc.getTime());
    const overlapEnd = Math.min(end.getTime(), effectiveEnd.getTime());
    const allocatedSeconds = Math.max(0, Math.floor((overlapEnd - overlapStart) / 1_000));
    return allocatedSeconds > 0 ? [{ ...entry, allocatedSeconds, active: entry.stoppedAt == null }] : [];
  });
  const operatingDay = resolveOperatingDay(dateKey, policy.profile, policy.holidays);
  const targetSeconds = operatingDay.isWorkday ? Math.round(policy.dailyGoalHours * 3_600) : 0;
  const trackedSeconds = allocated.reduce((sum, entry) => sum + entry.allocatedSeconds, 0);
  return {
    dateKey,
    calculatedAt,
    isWorkday: operatingDay.isWorkday,
    protectedReason: operatingDay.reason,
    targetSeconds,
    trackedSeconds,
    overtimeSeconds: Math.max(0, trackedSeconds - targetSeconds),
    entryCount: allocated.length,
    entries: allocated.sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime()),
    cards: groupEntries(allocated),
  };
}

async function loadPolicy(): Promise<TimeEvidencePolicy> {
  const [dailyGoalHours, profile, holidays] = await Promise.all([
    getDailyGoalHours(),
    getOperatingProfile(),
    listOperatingHolidays(),
  ]);
  return { dailyGoalHours, profile, holidays };
}

async function loadRangeEntries(startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];
  const { startUtc, endUtc } = eatDateSpanUtc(startDate, endDate);
  return db.select().from(timeEntries).where(and(
    eq(timeEntries.isVoided, false),
    lt(timeEntries.startedAt, endUtc),
    or(isNull(timeEntries.stoppedAt), gt(timeEntries.stoppedAt, startUtc)),
  ));
}

export async function getDailyTimeEvidence(dateKey: string, calculatedAt = new Date()) {
  const range = await getTimeEvidenceRange(dateKey, dateKey, calculatedAt);
  return range.days[0];
}

export async function getTimeEvidenceRange(startDate: string, endDate: string, calculatedAt = new Date()) {
  const dayCount = differenceInDateKeys(endDate, startDate) + 1;
  if (dayCount < 1 || dayCount > 366) throw new Error("Time evidence range must contain between 1 and 366 days");
  const [entries, policy] = await Promise.all([loadRangeEntries(startDate, endDate), loadPolicy()]);
  const days = Array.from({ length: dayCount }, (_, index) => buildDailyTimeEvidence(
    addDaysToDateKey(startDate, index),
    entries,
    policy,
    calculatedAt,
  ));
  return { days, profile: policy.profile, calculatedAt };
}

export async function getWeeklyTimeEvidence(startDate: string, endDate: string, calculatedAt = new Date()) {
  if (differenceInDateKeys(endDate, startDate) + 1 !== 7) throw new Error("Weekly time evidence requires one seven-day range");
  const { days, profile } = await getTimeEvidenceRange(startDate, endDate, calculatedAt);
  const trackedSeconds = days.reduce((sum, day) => sum + day.trackedSeconds, 0);
  const scheduledTargetSeconds = days.reduce((sum, day) => sum + day.targetSeconds, 0);
  const weeklyTargetSeconds = Math.round(profile.weeklyHoursMax * 3_600);
  const currentDay = days.find((day) => day.dateKey === dateKeyInEat(calculatedAt)) ?? null;
  return {
    startDate,
    endDate,
    calculatedAt,
    trackedSeconds,
    scheduledTargetSeconds,
    weeklyTargetSeconds,
    dailyOvertimeSeconds: days.reduce((sum, day) => sum + day.overtimeSeconds, 0),
    weeklyOvertimeSeconds: Math.max(0, trackedSeconds - weeklyTargetSeconds),
    weeklyHoursMin: profile.weeklyHoursMin,
    weeklyHoursMax: profile.weeklyHoursMax,
    currentDay,
    days: days.map((day) => ({
      date: day.dateKey,
      totalSeconds: day.trackedSeconds,
      targetSeconds: day.targetSeconds,
      overtimeSeconds: day.overtimeSeconds,
      isWorkday: day.isWorkday,
    })),
  };
}

/** Refresh timer-derived fields on existing compliance rows without calling Trello or Gmail. */
export async function refreshStoredComplianceTimeEvidence(startDate: string, endDate: string, calculatedAt = new Date()) {
  const db = await getDb();
  if (!db) return { daysCalculated: 0 };
  const range = await getTimeEvidenceRange(startDate, endDate, calculatedAt);
  await db.transaction(async (tx) => {
    for (const day of range.days) {
      await tx.execute(sql`UPDATE daily_compliance_snapshots SET
        evidenceCount = GREATEST(0, evidenceCount - timeEntryCount + ${day.entryCount}),
        trackedSeconds = ${day.trackedSeconds},
        scheduledTargetSeconds = ${day.targetSeconds},
        overtimeSeconds = ${day.overtimeSeconds},
        timeEntryCount = ${day.entryCount}
        WHERE DATE_FORMAT(snapshotDate, '%Y-%m-%d') = ${day.dateKey}`);
    }
  });
  return { daysCalculated: range.days.length };
}
