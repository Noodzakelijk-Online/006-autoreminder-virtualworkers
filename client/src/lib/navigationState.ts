export const TRIAGE_TAB_KEY = "joyce-triage-active-tab";
export const ACTIVE_SECTION_KEY = "joyce-active-section";
export const TODAY_MODE_KEY = "joyce-today-mode";

export type AppSection = "overview" | "triage" | "decisions" | "performance" | "standards" | "settings";

export const APP_SECTIONS: AppSection[] = ["overview", "triage", "decisions", "performance", "standards", "settings"];

export function isAppSection(value: string | null): value is AppSection {
  return Boolean(value && APP_SECTIONS.includes(value as AppSection));
}

export type TodayMode = "queue" | "plan";

export function readTodayMode(value: string | null, dateKey: string, isSunday: boolean): TodayMode {
  if (isSunday) return "plan";
  const [storedDate, storedMode] = value?.split(":") ?? [];
  return storedDate === dateKey && (storedMode === "queue" || storedMode === "plan") ? storedMode : "queue";
}

export function serializeTodayMode(dateKey: string, mode: TodayMode) {
  return `${dateKey}:${mode}`;
}

export type TriageSubTab = "work-intake" | "day-structurer" | "reply-monitor" | "email-inbox" | "follow-up-drafts";

export const TRIAGE_SUB_TABS: TriageSubTab[] = [
  "work-intake",
  "day-structurer",
  "reply-monitor",
  "email-inbox",
  "follow-up-drafts",
];
