const EAT_OFFSET_MS = 3 * 60 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function timestamp(value: Date | number) {
  const result = value instanceof Date ? value.getTime() : value;
  if (!Number.isFinite(result)) throw new Error("A valid timestamp is required");
  return result;
}

export function assertDateKey(value: string): string {
  if (!DATE_KEY_PATTERN.test(value)) throw new Error("Date must use YYYY-MM-DD");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("Date must be a real calendar date");
  }
  return value;
}

export function dateKeyInEat(value: Date | number = Date.now()): string {
  return new Date(timestamp(value) + EAT_OFFSET_MS).toISOString().slice(0, 10);
}

export function timeKeyInEat(value: Date | number = Date.now()): string {
  return new Date(timestamp(value) + EAT_OFFSET_MS).toISOString().slice(11, 16);
}

export function dayOfWeekInEat(value: Date | number = Date.now()): number {
  return new Date(timestamp(value) + EAT_OFFSET_MS).getUTCDay();
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const validDateKey = assertDateKey(dateKey);
  const date = new Date(`${validDateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function differenceInDateKeys(targetDate: string, baseDate: string): number {
  const target = new Date(`${assertDateKey(targetDate)}T00:00:00Z`).getTime();
  const base = new Date(`${assertDateKey(baseDate)}T00:00:00Z`).getTime();
  return Math.round((target - base) / DAY_MS);
}

export function weekBoundsFromDateKey(dateKey: string): { startDate: string; endDate: string } {
  const validDateKey = assertDateKey(dateKey);
  const dayOfWeek = new Date(`${validDateKey}T00:00:00Z`).getUTCDay();
  const startDate = addDaysToDateKey(validDateKey, -((dayOfWeek + 6) % 7));
  return { startDate, endDate: addDaysToDateKey(startDate, 6) };
}

export function weekBoundsInEat(value: Date | number = Date.now()) {
  return weekBoundsFromDateKey(dateKeyInEat(value));
}

export function relevantSundayDateKey(value: Date | number = Date.now()): string {
  const dateKey = dateKeyInEat(value);
  const dayOfWeek = dayOfWeekInEat(value);
  return addDaysToDateKey(dateKey, dayOfWeek === 0 ? 0 : 7 - dayOfWeek);
}

/** Half-open UTC interval covering one complete EAT calendar date. */
export function eatDateRangeUtc(dateKey: string): { startUtc: Date; endUtc: Date } {
  const validDateKey = assertDateKey(dateKey);
  const startUtc = new Date(`${validDateKey}T00:00:00+03:00`);
  return { startUtc, endUtc: new Date(startUtc.getTime() + DAY_MS) };
}

/** Half-open UTC interval covering the inclusive EAT date range. */
export function eatDateSpanUtc(startDate: string, endDate: string): { startUtc: Date; endUtc: Date } {
  const validStart = assertDateKey(startDate);
  const validEnd = assertDateKey(endDate);
  if (validEnd < validStart) throw new Error("End date cannot be before start date");
  const { startUtc } = eatDateRangeUtc(validStart);
  const { endUtc } = eatDateRangeUtc(validEnd);
  return { startUtc, endUtc };
}
