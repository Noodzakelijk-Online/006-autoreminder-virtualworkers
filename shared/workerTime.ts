const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validTimeZone(timeZone: string | null | undefined) {
  const candidate = timeZone?.trim() || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(0);
    return candidate;
  } catch {
    return "UTC";
  }
}

function parts(value: Date | number, timeZone?: string | null) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("A valid timestamp is required");
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: validTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  return Object.fromEntries(values.map((item) => [item.type, item.value]));
}

export function dateKeyInTimeZone(value: Date | number = Date.now(), timeZone?: string | null) {
  const valueParts = parts(value, timeZone);
  const result = `${valueParts.year}-${valueParts.month}-${valueParts.day}`;
  if (!DATE_KEY_PATTERN.test(result)) throw new Error("Unable to format a local date");
  return result;
}

export function timeKeyInTimeZone(value: Date | number = Date.now(), timeZone?: string | null) {
  const valueParts = parts(value, timeZone);
  return `${valueParts.hour}:${valueParts.minute}`;
}

export function dayOfWeekInTimeZone(value: Date | number = Date.now(), timeZone?: string | null) {
  const weekday = parts(value, timeZone).weekday;
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

export function formatWorkerDate(value: Date | number = Date.now(), timeZone?: string | null) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: validTimeZone(timeZone),
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(value instanceof Date ? value : new Date(value));
}
