export type DateOnlyInput = string | Date | null | undefined;

export function toDateOnlyKey(value: DateOnlyInput): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
    if (match) return match[1];
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function dateOnlyAtNoon(value: DateOnlyInput): Date | null {
  const key = toDateOnlyKey(value);
  if (!key) return null;
  const date = new Date(`${key}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatShortDate(value: DateOnlyInput): string {
  const date = dateOnlyAtNoon(value);
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "-";
}

export function formatWeekChartLabel(value: DateOnlyInput): string {
  const date = dateOnlyAtNoon(value);
  return date ? `Wk ${date.toLocaleString("default", { month: "short" })} ${date.getDate()}` : "Week unknown";
}
