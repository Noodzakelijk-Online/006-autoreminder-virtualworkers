import { addDaysToDateKey, weekBoundsFromDateKey } from "@shared/eatTime";

export const COMPLIANCE_RANGES = [
  { days: 7, label: "7 days", chartUnit: "day", slideUnit: "day" },
  { days: 30, label: "1 month", chartUnit: "day", slideUnit: "week" },
  { days: 90, label: "1 quarter", chartUnit: "week", slideUnit: "month" },
  { days: 365, label: "1 year", chartUnit: "month", slideUnit: "month" },
] as const;

export type ComplianceRangeDays = (typeof COMPLIANCE_RANGES)[number]["days"];
export type ComplianceChartUnit = (typeof COMPLIANCE_RANGES)[number]["chartUnit"];
export type ComplianceSlideUnit = (typeof COMPLIANCE_RANGES)[number]["slideUnit"];

export interface ComplianceHistoryDatum {
  snapshotDate: string;
  compliancePct: number;
  required: boolean;
}

export interface ComplianceSummaryDatum extends ComplianceHistoryDatum {
  onHoldTotal: number;
  onHoldReviewed: number;
  doingTotal: number;
  doingUpdated: number;
  messageTotal: number;
  messageReplied: number;
  messageNeedsClarification: number;
  emailTotal: number;
  emailCompleted: number;
  emailNeedsClarification: number;
  clarificationOpen: number;
  evidenceCount: number;
  verificationStatus: string;
}

export interface ComplianceRangeSummary {
  average: number;
  verifiedDays: number;
  requiredDays: number;
  protectedDays: number;
  fullyCompliantDays: number;
  expectedChecks: number;
  passedChecks: number;
  missingEvidence: number;
  evidenceRecords: number;
  openClarifications: number;
  messageResponseRate: number;
  messagesReplied: number;
  messagesExpected: number;
  emailCompletionRate: number;
  emailsCompleted: number;
  emailsExpected: number;
}

export interface ComplianceChartBucket {
  id: string;
  label: string;
  title: string;
  pct: number;
  days: number;
}

export interface ComplianceEvidenceSlide<T extends ComplianceHistoryDatum> {
  id: string;
  label: string;
  detail: string;
  average: number;
  requiredDays: number;
  verifiedDays: number;
  rows: T[];
}

function utcDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`);
}

function shortDate(dateKey: string) {
  return utcDate(dateKey).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function average(rows: ComplianceHistoryDatum[]) {
  const required = rows.filter((row) => row.required);
  if (required.length === 0) return 100;
  return Math.round(required.reduce((sum, row) => sum + row.compliancePct, 0) / required.length);
}

export function selectComplianceRange<T extends ComplianceHistoryDatum>(history: T[], days: ComplianceRangeDays): T[] {
  if (history.length === 0) return [];
  const newest = history.reduce((latest, row) => row.snapshotDate > latest ? row.snapshotDate : latest, history[0].snapshotDate);
  const start = addDaysToDateKey(newest, -(days - 1));
  return history
    .filter((row) => row.snapshotDate >= start && row.snapshotDate <= newest)
    .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate));
}

export function complianceRangeAverage(rows: ComplianceHistoryDatum[]) {
  return average(rows);
}

export function summarizeComplianceRange(rows: ComplianceSummaryDatum[]): ComplianceRangeSummary {
  const requiredRows = rows.filter((row) => row.required);
  const expectedChecks = requiredRows.reduce((sum, row) => sum
    + row.onHoldTotal + row.doingTotal
    + Math.max(0, row.messageTotal - row.messageNeedsClarification)
    + Math.max(0, row.emailTotal - row.emailNeedsClarification), 0);
  const passedChecks = requiredRows.reduce((sum, row) => sum
    + row.onHoldReviewed + row.doingUpdated + row.messageReplied + row.emailCompleted, 0);
  const messagesExpected = requiredRows.reduce((sum, row) => sum + Math.max(0, row.messageTotal - row.messageNeedsClarification), 0);
  const messagesReplied = requiredRows.reduce((sum, row) => sum + row.messageReplied, 0);
  const emailsExpected = requiredRows.reduce((sum, row) => sum + Math.max(0, row.emailTotal - row.emailNeedsClarification), 0);
  const emailsCompleted = requiredRows.reduce((sum, row) => sum + row.emailCompleted, 0);
  return {
    average: average(rows),
    verifiedDays: rows.filter((row) => row.verificationStatus.startsWith("verified")).length,
    requiredDays: requiredRows.length,
    protectedDays: rows.length - requiredRows.length,
    fullyCompliantDays: requiredRows.filter((row) => row.compliancePct === 100).length,
    expectedChecks,
    passedChecks,
    missingEvidence: Math.max(0, expectedChecks - passedChecks),
    evidenceRecords: rows.reduce((sum, row) => sum + row.evidenceCount, 0),
    openClarifications: rows.reduce((sum, row) => sum + row.clarificationOpen, 0),
    messageResponseRate: messagesExpected === 0 ? 100 : Math.round((messagesReplied / messagesExpected) * 100),
    messagesReplied,
    messagesExpected,
    emailCompletionRate: emailsExpected === 0 ? 100 : Math.round((emailsCompleted / emailsExpected) * 100),
    emailsCompleted,
    emailsExpected,
  };
}

function bucketId(dateKey: string, unit: ComplianceChartUnit | ComplianceSlideUnit) {
  if (unit === "day") return dateKey;
  if (unit === "week") return weekBoundsFromDateKey(dateKey).startDate;
  return dateKey.slice(0, 7);
}

function bucketLabel(id: string, unit: ComplianceChartUnit) {
  if (unit === "day") return utcDate(id).toLocaleDateString("en-US", { month: "numeric", day: "numeric", timeZone: "UTC" });
  if (unit === "week") return shortDate(id);
  return utcDate(`${id}-01`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

export function buildComplianceChartBuckets(rows: ComplianceHistoryDatum[], unit: ComplianceChartUnit): ComplianceChartBucket[] {
  const groups = new Map<string, ComplianceHistoryDatum[]>();
  for (const row of rows) {
    if (!row.required) continue;
    const id = bucketId(row.snapshotDate, unit);
    groups.set(id, [...(groups.get(id) ?? []), row]);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, bucketRows]) => ({
      id,
      label: bucketLabel(id, unit),
      title: unit === "day" ? shortDate(id) : unit === "week" ? `Week of ${shortDate(id)}` : utcDate(`${id}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
      pct: average(bucketRows),
      days: bucketRows.length,
    }));
}

function slideLabel(id: string, unit: ComplianceSlideUnit) {
  if (unit === "day") return utcDate(id).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  if (unit === "week") return `Week of ${shortDate(id)}`;
  return utcDate(`${id}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function buildEvidenceSlides<T extends ComplianceHistoryDatum>(rows: T[], unit: ComplianceSlideUnit): ComplianceEvidenceSlide<T>[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = bucketId(row.snapshotDate, unit);
    groups.set(id, [...(groups.get(id) ?? []), row]);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([id, slideRows]) => {
      const sortedRows = [...slideRows].sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate));
      const requiredRows = sortedRows.filter((row) => row.required);
      return {
        id,
        label: slideLabel(id, unit),
        detail: `${sortedRows.length} day${sortedRows.length === 1 ? "" : "s"} · ${requiredRows.length} reviewed`,
        average: average(sortedRows),
        requiredDays: requiredRows.length,
        verifiedDays: sortedRows.length,
        rows: sortedRows,
      };
    });
}
