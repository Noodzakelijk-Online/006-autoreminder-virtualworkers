import { randomUUID } from "crypto";
import { and, desc, eq, getTableColumns, gte, lt, lte, max, ne, sql } from "drizzle-orm";
import { scheduledJobLeases, scheduledJobRuns } from "../drizzle/schema";
import { getDb } from "./db";
import { broadcast } from "./sse";

export type JobTrigger = "cron" | "external" | "manual";

const JOB_RETENTION_MS = 90 * 24 * 60 * 60_000;
const DEFAULT_ABANDONED_AFTER_MS = 2 * 60 * 60_000;
const DEFAULT_LEASE_MS = 2 * 60 * 60_000;
let nextRetentionPruneAt = 0;

export class JobAlreadyRunningError extends Error {
  constructor(readonly jobKey: string) {
    super(`Job ${jobKey} is already running in another server process.`);
    this.name = "JobAlreadyRunningError";
  }
}

function leaseDurationMs() {
  const configuredMinutes = Number(process.env.SCHEDULED_JOB_LEASE_MINUTES ?? 120);
  return Number.isFinite(configuredMinutes) && configuredMinutes >= 5
    ? configuredMinutes * 60_000
    : DEFAULT_LEASE_MS;
}

async function acquireJobLease(jobKey: string) {
  const db = await getDb();
  if (!db) return null;
  const ownerToken = randomUUID();
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs());
  const values = {
    jobKey,
    ownerToken,
    acquiredAt: now,
    heartbeatAt: now,
    leaseExpiresAt,
  };
  await db.update(scheduledJobLeases).set(values).where(and(
    eq(scheduledJobLeases.jobKey, jobKey),
    lte(scheduledJobLeases.leaseExpiresAt, now),
  ));
  await db.insert(scheduledJobLeases).values(values).onDuplicateKeyUpdate({
    set: { jobKey: sql`${scheduledJobLeases.jobKey}` },
  });
  const [lease] = await db.select({ ownerToken: scheduledJobLeases.ownerToken })
    .from(scheduledJobLeases)
    .where(eq(scheduledJobLeases.jobKey, jobKey))
    .limit(1);
  if (lease?.ownerToken !== ownerToken) throw new JobAlreadyRunningError(jobKey);
  return ownerToken;
}

async function heartbeatJobLease(jobKey: string, ownerToken: string) {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  await db.update(scheduledJobLeases).set({
    heartbeatAt: now,
    leaseExpiresAt: new Date(now.getTime() + leaseDurationMs()),
  }).where(and(
    eq(scheduledJobLeases.jobKey, jobKey),
    eq(scheduledJobLeases.ownerToken, ownerToken),
  ));
}

async function releaseJobLease(jobKey: string, ownerToken: string | null) {
  if (!ownerToken) return;
  const db = await getDb();
  if (!db) return;
  await db.delete(scheduledJobLeases).where(and(
    eq(scheduledJobLeases.jobKey, jobKey),
    eq(scheduledJobLeases.ownerToken, ownerToken),
  ));
}

function abandonedAfterMs() {
  const configuredMinutes = Number(process.env.SCHEDULED_JOB_ABANDONED_AFTER_MINUTES ?? 120);
  return Number.isFinite(configuredMinutes) && configuredMinutes >= 15
    ? configuredMinutes * 60_000
    : DEFAULT_ABANDONED_AFTER_MS;
}

export async function reconcileAbandonedJobRuns(now = new Date()) {
  const db = await getDb();
  if (!db) return 0;
  const cutoff = new Date(now.getTime() - abandonedAfterMs());
  const result = await db.update(scheduledJobRuns).set({
    status: "abandoned",
    finishedAt: now,
    errorMessage: "The server stopped before this job recorded a final result.",
  }).where(and(
    eq(scheduledJobRuns.status, "running"),
    lt(scheduledJobRuns.startedAt, cutoff),
  ));
  return Number((result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0);
}

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
  await reconcileAbandonedJobRuns();
  await pruneOldJobRuns();
  const leaseOwner = await acquireJobLease(args.jobKey);
  const heartbeatEveryMs = Math.max(60_000, Math.floor(leaseDurationMs() / 3));
  const heartbeat = leaseOwner ? setInterval(() => {
    void heartbeatJobLease(args.jobKey, leaseOwner).catch((error) => {
      console.error(`[ScheduledJob] Failed to renew ${args.jobKey} lease:`, error);
    });
  }, heartbeatEveryMs) : null;
  heartbeat?.unref();
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
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    await releaseJobLease(args.jobKey, leaseOwner);
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
