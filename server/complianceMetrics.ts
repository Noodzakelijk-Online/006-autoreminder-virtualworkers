import { dayOfWeekForDateKey } from "../shared/workerTime";

type Schedule = {
  workStartTime: string;
  workEndTime: string;
  workingDays: number[];
  breaks: Array<{ startTime: string; durationMinutes: number }>;
};

type ComplianceCounts = {
  onHoldTotal: number;
  onHoldReviewed: number;
  doingTotal: number;
  doingUpdated: number;
  messageTotal: number;
  messageReplied: number;
  emailTotal: number;
  emailCompleted: number;
};

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function calculateScheduledTargetSeconds(schedule: Schedule, dateKey: string) {
  if (!schedule.workingDays.includes(dayOfWeekForDateKey(dateKey))) return 0;
  const start = minutes(schedule.workStartTime);
  const end = minutes(schedule.workEndTime);
  if (end <= start) return 0;
  const breakMinutes = schedule.breaks.reduce((total, item) => {
    const breakStart = minutes(item.startTime);
    const breakEnd = breakStart + Math.max(0, item.durationMinutes);
    return total + Math.max(0, Math.min(end, breakEnd) - Math.max(start, breakStart));
  }, 0);
  return Math.max(0, end - start - breakMinutes) * 60;
}

export function calculateCompliancePercentage(row: ComplianceCounts) {
  const total = row.onHoldTotal + row.doingTotal + row.messageTotal + row.emailTotal;
  if (total === 0) return 100;
  const completed = row.onHoldReviewed + row.doingUpdated + row.messageReplied + row.emailCompleted;
  return Math.round((completed / total) * 100);
}
