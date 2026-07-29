import { and, asc, eq } from "drizzle-orm";
import { operatingHolidays, operatingProfiles } from "../drizzle/schema";
import { getDb } from "./db";

export type OperatingBreak = {
  name: string;
  startTime: string;
  durationMinutes: number;
};

export type OperatingProfileValue = {
  profileKey: string;
  timezone: string;
  workStart: string;
  workEnd: string;
  workingDays: number[];
  breaks: OperatingBreak[];
  weeklyHoursMin: number;
  weeklyHoursMax: number;
};

export type OperatingHolidayValue = {
  id?: number;
  dateKey: string;
  name: string;
  kind: "holiday" | "leave" | "exceptional_workday";
  source: "manual" | "calendar" | "policy";
  notes?: string | null;
  active: boolean;
};

export const DEFAULT_OPERATING_PROFILE: OperatingProfileValue = {
  profileKey: "joyce",
  timezone: "Africa/Nairobi",
  workStart: "08:00",
  workEnd: "23:00",
  workingDays: [1, 2, 3, 4, 5, 6],
  breaks: [
    { name: "Breakfast", startTime: "09:00", durationMinutes: 30 },
    { name: "Lunch", startTime: "14:30", durationMinutes: 45 },
    { name: "Dinner", startTime: "19:15", durationMinutes: 90 },
  ],
  weeklyHoursMin: 50,
  weeklyHoursMax: 55,
};

function parseArray<T>(value: string, fallback: T[]): T[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}

function normalizeDateKey(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

export function resolveOperatingDay(
  dateKey: string,
  profile: OperatingProfileValue,
  holidays: OperatingHolidayValue[],
) {
  const dayOfWeek = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  const active = holidays.filter((holiday) => holiday.active && holiday.dateKey === dateKey);
  const exceptional = active.find((holiday) => holiday.kind === "exceptional_workday");
  const protectedDay = active.find((holiday) => holiday.kind !== "exceptional_workday");
  const regularWorkday = profile.workingDays.includes(dayOfWeek);

  if (exceptional) {
    return { isWorkday: true, reason: exceptional.name, source: "exceptional_workday" as const };
  }
  if (protectedDay) {
    return { isWorkday: false, reason: protectedDay.name, source: protectedDay.kind };
  }
  if (!regularWorkday) {
    return {
      isWorkday: false,
      reason: dayOfWeek === 0 ? "Sunday is Joyce's protected day off." : "Configured non-working day.",
      source: "weekly_schedule" as const,
    };
  }
  return { isWorkday: true, reason: null, source: "weekly_schedule" as const };
}

export async function getOperatingProfile(): Promise<OperatingProfileValue> {
  const db = await getDb();
  if (!db) return DEFAULT_OPERATING_PROFILE;
  const [row] = await db.select().from(operatingProfiles)
    .where(and(eq(operatingProfiles.profileKey, "joyce"), eq(operatingProfiles.active, true)))
    .limit(1);
  if (!row) return DEFAULT_OPERATING_PROFILE;
  return {
    profileKey: row.profileKey,
    timezone: row.timezone,
    workStart: row.workStart,
    workEnd: row.workEnd,
    workingDays: parseArray<number>(row.workingDaysJson, DEFAULT_OPERATING_PROFILE.workingDays),
    breaks: parseArray<OperatingBreak>(row.breaksJson, DEFAULT_OPERATING_PROFILE.breaks),
    weeklyHoursMin: row.weeklyHoursMin,
    weeklyHoursMax: row.weeklyHoursMax,
  };
}

export async function upsertOperatingProfile(value: OperatingProfileValue) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(operatingProfiles).values({
    profileKey: value.profileKey,
    timezone: value.timezone,
    workStart: value.workStart,
    workEnd: value.workEnd,
    workingDaysJson: JSON.stringify(Array.from(new Set(value.workingDays)).sort()),
    breaksJson: JSON.stringify(value.breaks),
    weeklyHoursMin: value.weeklyHoursMin,
    weeklyHoursMax: value.weeklyHoursMax,
    active: true,
  }).onDuplicateKeyUpdate({
    set: {
      timezone: value.timezone,
      workStart: value.workStart,
      workEnd: value.workEnd,
      workingDaysJson: JSON.stringify(Array.from(new Set(value.workingDays)).sort()),
      breaksJson: JSON.stringify(value.breaks),
      weeklyHoursMin: value.weeklyHoursMin,
      weeklyHoursMax: value.weeklyHoursMax,
      active: true,
    },
  });
  return value;
}

export async function listOperatingHolidays(): Promise<OperatingHolidayValue[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(operatingHolidays).orderBy(asc(operatingHolidays.dateKey));
  return rows.map((row) => ({
    id: row.id,
    dateKey: normalizeDateKey(row.dateKey),
    name: row.name,
    kind: row.kind,
    source: row.source,
    notes: row.notes,
    active: row.active,
  }));
}

export async function upsertOperatingHoliday(value: Omit<OperatingHolidayValue, "id">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(operatingHolidays).values({
    dateKey: value.dateKey as unknown as Date,
    name: value.name,
    kind: value.kind,
    source: value.source,
    notes: value.notes ?? null,
    active: value.active,
  }).onDuplicateKeyUpdate({
    set: { kind: value.kind, source: value.source, notes: value.notes ?? null, active: value.active },
  });
  return value;
}

export async function deleteOperatingHoliday(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(operatingHolidays).where(eq(operatingHolidays.id, id));
}

export async function getOperatingDay(dateKey: string) {
  const [profile, holidays] = await Promise.all([getOperatingProfile(), listOperatingHolidays()]);
  return { profile, ...resolveOperatingDay(dateKey, profile, holidays) };
}
