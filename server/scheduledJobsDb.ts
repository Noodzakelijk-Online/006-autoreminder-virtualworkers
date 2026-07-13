import { and, desc, eq, getTableColumns, gte, lt, max, ne } from "drizzle-orm";
import { scheduledJobRuns } from "../drizzle/schema";
import { getDb } from "./db";
import { broadcast } from "./sse";

export type JobTrigger = "cron" | "external" | "manual";

const JOB_RETENTION_MS = 90 * 24 * 60 * 60_000;
let nextRetentionPruneAt = 0;

async function pruneOldJobRuns() {
  const now = Date.now();
  if (now < nextRetentionPruneAt) return;
  const db = await getDb();
  if (!db) return;
  nextRetentionPruneAt = now + 24 * 60 * 60_000;
  await db.delete(scheduledJobRuns).where(and(
    lt(scheduledJobRuns.startedAt, new Date(now - JOB_RETENTION_MS)),
    ne(scheduledJobRuns.status, "running"),
  ));
}

export async function runTrackedJob<T>(args: {
  jobKey: string;
  trigger?: JobTrigger;
  run: () => Promise<T>;
  summarize?: (result: T) => { recordsProcessed?: number; detail?: string };
}): Promise<T> {
  const db = await getDb();
  await pruneOldJobRuns();
  const startedAt = new Date();
  let runId: number | null = null;
  if (db) {
    const [inserted] = await db.insert(scheduledJobRuns).values({
      jobKey: args.jobKey,
      trigger: args.trigger ?? "cron",
      status: "running",
      startedAt,
    });
    runId = Number((inserted as { insertId?: number }).insertId ?? 0) || null;
  }

  try {
    const result = await args.run();
    if (db && runId) {
      const summary = args.summarize?.(result);
      await db.update(scheduledJobRuns).set({
        status: "success",
        finishedAt: new Date(),
        durationMs: Math.max(0, Date.now() - startedAt.getTime()),
        recordsProcessed: Math.max(0, Math.round(summary?.recordsProcessed ?? 0)),
        detail: summary?.detail ?? null,
      }).where(eq(scheduledJobRuns.id, runId));
      broadcast("jobs-invalidate");
    }
    return result;
  } catch (error) {
    if (db && runId) {
      await db.update(scheduledJobRuns).set({
        status: "error",
        finishedAt: new Date(),
        durationMs: Math.max(0, Date.now() - startedAt.getTime()),
        errorMessage: error instanceof Error ? error.message : String(error),
      }).where(eq(scheduledJobRuns.id, runId));
      broadcast("jobs-invalidate");
    }
    throw error;
  }
}

export async function getRecentJobRuns(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scheduledJobRuns).orderBy(desc(scheduledJobRuns.startedAt)).limit(Math.max(1, Math.min(200, limit)));
}

export async function getLatestJobRuns() {
  const db = await getDb();
  if (!db) return [];
  const latestByJob = db
    .select({
      jobKey: scheduledJobRuns.jobKey,
      latestId: max(scheduledJobRuns.id).as("latestId"),
    })
    .from(scheduledJobRuns)
    .groupBy(scheduledJobRuns.jobKey)
    .as("latest_job_runs");
  return db
    .select({ ...getTableColumns(scheduledJobRuns) })
    .from(scheduledJobRuns)
    .innerJoin(latestByJob, eq(scheduledJobRuns.id, latestByJob.latestId))
    .orderBy(desc(scheduledJobRuns.startedAt));
}

export async function countJobErrorsSince(since: Date) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ id: scheduledJobRuns.id }).from(scheduledJobRuns).where(and(
    eq(scheduledJobRuns.status, "error"),
    gte(scheduledJobRuns.startedAt, since),
  ));
  return rows.length;
}
