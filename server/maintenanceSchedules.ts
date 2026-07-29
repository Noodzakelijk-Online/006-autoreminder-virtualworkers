import { eq } from "drizzle-orm";
import { appSettings } from "../drizzle/schema";
import { getDb } from "./db";
import {
  getGmailIngestionSettings,
  setGmailIngestionSettings,
  type GmailIngestionInterval,
} from "./gmailIngestionSettings";

export const MAINTENANCE_JOB_KEYS = [
  "aptlss_maintenance",
  "workspace_ingestion",
  "reply_monitor",
  "eod_compliance",
  "weekly_analysis",
] as const;

export type MaintenanceScheduleJobKey = (typeof MAINTENANCE_JOB_KEYS)[number];

export type MaintenanceSchedule = {
  enabled: boolean;
  intervalMinutes: number;
};

export type MaintenanceSchedules = Record<MaintenanceScheduleJobKey, MaintenanceSchedule>;

const SETTINGS_KEY = "maintenanceSchedules";

export const MAINTENANCE_JOB_CATALOG: Record<MaintenanceScheduleJobKey, {
  title: string;
  category: "Intelligence" | "Communication" | "Accountability";
  description: string;
  detail: string;
  intervalOptions: number[];
}> = {
  aptlss_maintenance: {
    title: "APTLSS assessment",
    category: "Intelligence",
    description: "Refreshes card state, priority, next actions, blockers, and planning intelligence.",
    detail: "Reads current Trello and linked evidence, reassesses stale cards, repairs decision flags, prepares follow-up drafts, and refreshes the daily plan when needed. It does not post or move Trello cards.",
    intervalOptions: [15, 30, 60, 120, 240, 720, 1_440],
  },
  workspace_ingestion: {
    title: "Workspace ingestion",
    category: "Intelligence",
    description: "Indexes read-only Gmail, Google Drive, and Trello evidence for APTLSS.",
    detail: "Collects connected workspace evidence, deduplicates it, links it to matching cards, and queues reassessment when a material link changes.",
    intervalOptions: [5, 15, 30, 60, 120, 240, 720, 1_440],
  },
  reply_monitor: {
    title: "Reply monitor",
    category: "Communication",
    description: "Checks response deadlines, vague replies, and missing message signatures.",
    detail: "Scans supported communication threads, updates response evidence, and creates review flags. Automatic runs may notify the owner but never send a reply on Joyce's behalf.",
    intervalOptions: [5, 15, 30, 60, 120, 240],
  },
  eod_compliance: {
    title: "End-of-day compliance",
    category: "Accountability",
    description: "Fact-checks one workday and records compliance and browser-organization evidence.",
    detail: "Verifies DOING updates, ON-HOLD reviews, communication processing, and end-of-day tab hygiene. It records evidence and exceptions without applying pay changes automatically.",
    intervalOptions: [720, 1_440, 2_880, 4_320, 10_080],
  },
  weekly_analysis: {
    title: "Weekly analysis",
    category: "Accountability",
    description: "Finds week-level delivery patterns and evidence-grounded process improvements.",
    detail: "Aggregates stalled work, overdue commitments, recurring blockers, estimate drift, and unclear scope into a durable weekly APTLSS snapshot.",
    intervalOptions: [1_440, 2_880, 4_320, 10_080, 20_160, 40_320],
  },
};

const DEFAULT_SCHEDULES: MaintenanceSchedules = {
  aptlss_maintenance: { enabled: true, intervalMinutes: 60 },
  workspace_ingestion: { enabled: false, intervalMinutes: 60 },
  reply_monitor: { enabled: true, intervalMinutes: 15 },
  eod_compliance: { enabled: true, intervalMinutes: 1_440 },
  weekly_analysis: { enabled: true, intervalMinutes: 10_080 },
};

function isJobKey(value: string): value is MaintenanceScheduleJobKey {
  return MAINTENANCE_JOB_KEYS.includes(value as MaintenanceScheduleJobKey);
}

function normalizeSchedule(jobKey: MaintenanceScheduleJobKey, value: Partial<MaintenanceSchedule> | undefined) {
  const fallback = DEFAULT_SCHEDULES[jobKey];
  const options = MAINTENANCE_JOB_CATALOG[jobKey].intervalOptions;
  return {
    enabled: typeof value?.enabled === "boolean" ? value.enabled : fallback.enabled,
    intervalMinutes: options.includes(Number(value?.intervalMinutes))
      ? Number(value?.intervalMinutes)
      : fallback.intervalMinutes,
  };
}

async function readStoredSchedules(): Promise<Partial<MaintenanceSchedules>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, SETTINGS_KEY)).limit(1);
  if (!rows[0]?.value) return {};
  try {
    return JSON.parse(rows[0].value) as Partial<MaintenanceSchedules>;
  } catch {
    return {};
  }
}

async function writeStoredSchedules(settings: MaintenanceSchedules) {
  const db = await getDb();
  if (!db) throw new Error("Database is required to persist maintenance schedules");
  await db.insert(appSettings).values({ key: SETTINGS_KEY, value: JSON.stringify(settings) })
    .onDuplicateKeyUpdate({ set: { value: JSON.stringify(settings) } });
}

export async function getMaintenanceSchedules(): Promise<MaintenanceSchedules> {
  const [stored, workspace] = await Promise.all([
    readStoredSchedules(),
    getGmailIngestionSettings(),
  ]);
  const schedules = Object.fromEntries(
    MAINTENANCE_JOB_KEYS.map((jobKey) => [jobKey, normalizeSchedule(jobKey, stored[jobKey])]),
  ) as MaintenanceSchedules;
  schedules.workspace_ingestion = {
    enabled: workspace.enabled,
    intervalMinutes: workspace.intervalMinutes,
  };
  return schedules;
}

export async function setMaintenanceSchedule(
  jobKey: MaintenanceScheduleJobKey,
  schedule: MaintenanceSchedule,
): Promise<MaintenanceSchedules> {
  if (!isJobKey(jobKey)) throw new Error("Unknown maintenance job");
  const normalized = normalizeSchedule(jobKey, schedule);
  if (normalized.intervalMinutes !== schedule.intervalMinutes) {
    throw new Error("Select a supported interval for this maintenance job");
  }

  if (jobKey === "workspace_ingestion") {
    await setGmailIngestionSettings({
      enabled: normalized.enabled,
      intervalMinutes: normalized.intervalMinutes as GmailIngestionInterval,
    });
  } else {
    const current = await getMaintenanceSchedules();
    current[jobKey] = normalized;
    await writeStoredSchedules(current);
  }
  return getMaintenanceSchedules();
}

export function maintenanceIntervalLabel(minutes: number) {
  if (minutes < 60) return `Every ${minutes} minutes`;
  if (minutes === 60) return "Every hour";
  if (minutes < 1_440) return `Every ${minutes / 60} hours`;
  if (minutes === 1_440) return "Every day";
  if (minutes < 10_080) return `Every ${minutes / 1_440} days`;
  if (minutes === 10_080) return "Every week";
  return `Every ${minutes / 10_080} weeks`;
}
