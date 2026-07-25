import { dayOfWeekInEat, timeKeyInEat } from "./eatTime";

export interface BrowserTabPolicy {
  enabled: boolean;
  maxOpenTabs: number;
  warningMinutesBeforeEnd: number;
  staleAfterMinutes: number;
  includePinnedTabs: boolean;
}

export const DEFAULT_BROWSER_TAB_POLICY: BrowserTabPolicy = {
  enabled: true,
  maxOpenTabs: 5,
  warningMinutesBeforeEnd: 30,
  staleAfterMinutes: 10,
  includePinnedTabs: false,
};

export type BrowserTabHygieneStatus =
  | "disabled"
  | "protected_day"
  | "disconnected"
  | "stale"
  | "during_day"
  | "clear"
  | "over_limit";

function minuteOfDay(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function normalizeBrowserTabPolicy(value?: Partial<BrowserTabPolicy> | null): BrowserTabPolicy {
  return {
    enabled: value?.enabled ?? DEFAULT_BROWSER_TAB_POLICY.enabled,
    maxOpenTabs: Math.min(50, Math.max(0, Math.round(value?.maxOpenTabs ?? DEFAULT_BROWSER_TAB_POLICY.maxOpenTabs))),
    warningMinutesBeforeEnd: Math.min(240, Math.max(0, Math.round(value?.warningMinutesBeforeEnd ?? DEFAULT_BROWSER_TAB_POLICY.warningMinutesBeforeEnd))),
    staleAfterMinutes: Math.min(120, Math.max(2, Math.round(value?.staleAfterMinutes ?? DEFAULT_BROWSER_TAB_POLICY.staleAfterMinutes))),
    includePinnedTabs: value?.includePinnedTabs ?? DEFAULT_BROWSER_TAB_POLICY.includePinnedTabs,
  };
}

export function isBrowserTabWarningWindow(now: Date, workEnd: string, warningMinutesBeforeEnd: number) {
  const currentMinute = minuteOfDay(timeKeyInEat(now));
  const endMinute = minuteOfDay(workEnd);
  return currentMinute >= Math.max(0, endMinute - warningMinutesBeforeEnd);
}

export function evaluateBrowserTabHygiene(input: {
  now: Date;
  workEnd: string;
  policy: BrowserTabPolicy;
  totalTabs?: number | null;
  actionableTabs?: number | null;
  capturedAt?: Date | null;
}) {
  const policy = normalizeBrowserTabPolicy(input.policy);
  const warningWindow = isBrowserTabWarningWindow(input.now, input.workEnd, policy.warningMinutesBeforeEnd);
  const protectedDay = dayOfWeekInEat(input.now) === 0;
  const ageMinutes = input.capturedAt
    ? Math.max(0, Math.floor((input.now.getTime() - input.capturedAt.getTime()) / 60_000))
    : null;
  const connected = ageMinutes !== null && ageMinutes <= policy.staleAfterMinutes;
  const actionableTabs = Math.max(0, input.actionableTabs ?? 0);
  const excessTabs = Math.max(0, actionableTabs - policy.maxOpenTabs);

  let status: BrowserTabHygieneStatus;
  if (!policy.enabled) status = "disabled";
  else if (protectedDay) status = "protected_day";
  else if (!input.capturedAt) status = "disconnected";
  else if (!connected) status = "stale";
  else if (!warningWindow) status = "during_day";
  else if (excessTabs > 0) status = "over_limit";
  else status = "clear";

  return {
    status,
    connected,
    warningWindow,
    protectedDay,
    ageMinutes,
    totalTabs: Math.max(0, input.totalTabs ?? 0),
    actionableTabs,
    allowedTabs: policy.maxOpenTabs,
    excessTabs,
    shouldWarn: status === "over_limit",
    compliant: status === "clear" || status === "protected_day" || status === "disabled",
  };
}
