const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateKey(value: string): Date {
  if (!DATE_KEY_PATTERN.test(value)) {
    throw new Error(`Invalid date key: ${value}`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return parsed;
}

export function formatDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}
