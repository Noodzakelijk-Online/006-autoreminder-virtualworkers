export const TRIAGE_TAB_KEY = "joyce-triage-active-tab";
export const ACTIVE_SECTION_KEY = "joyce-active-section";

export type AppSection = "overview" | "triage" | "decisions" | "performance" | "standards" | "settings";

export const APP_SECTIONS: AppSection[] = ["overview", "triage", "decisions", "performance", "standards", "settings"];

export function isAppSection(value: string | null): value is AppSection {
  return Boolean(value && APP_SECTIONS.includes(value as AppSection));
}

export type TriageSubTab = "work-intake" | "day-structurer" | "reply-monitor" | "email-inbox" | "follow-up-drafts";

export const TRIAGE_SUB_TABS: TriageSubTab[] = [
  "work-intake",
  "day-structurer",
  "reply-monitor",
  "email-inbox",
  "follow-up-drafts",
];
