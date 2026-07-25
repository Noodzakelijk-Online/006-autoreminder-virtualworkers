import { afterAll, describe, expect, it } from "vitest";
import { and, eq, like } from "drizzle-orm";
import { scheduledJobLeases, scheduledJobRuns } from "../drizzle/schema";
import { getDb } from "./db";
import { JobAlreadyRunningError, reconcileAbandonedJobRuns, runTrackedJob } from "./scheduledJobsDb";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("scheduled job crash recovery", () => {
  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    await db.delete(scheduledJobRuns).where(like(scheduledJobRuns.jobKey, "test-%"));
    await db.delete(scheduledJobLeases).where(like(scheduledJobLeases.jobKey, "test-%"));
  }, 120_000);

  it("marks stale running rows as abandoned", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    const jobKey = `test-abandoned-${Date.now()}`;
    const now = new Date("2026-07-15T12:00:00Z");
    await db!.insert(scheduledJobRuns).values({
      jobKey,
      trigger: "cron",
      status: "running",
      startedAt: new Date(now.getTime() - 3 * 60 * 60_000),
    });

    await reconcileAbandonedJobRuns(now);
    const [run] = await db!.select().from(scheduledJobRuns).where(and(
      eq(scheduledJobRuns.jobKey, jobKey),
      eq(scheduledJobRuns.status, "abandoned"),
    )).limit(1);
    expect(run).toMatchObject({
      jobKey,
      status: "abandoned",
      errorMessage: "The server stopped before this job recorded a final result.",
    });
    expect(run.finishedAt).toEqual(now);
  }, 120_000);

  it("prevents the same job from running in two server processes", async () => {
    const jobKey = `test-lease-${Date.now()}`;
    let releaseFirst!: () => void;
    let markStarted!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const firstStarted = new Promise<void>((resolve) => { markStarted = resolve; });
    const first = runTrackedJob({
      jobKey,
      trigger: "manual",
      run: async () => {
        markStarted();
        await firstGate;
        return "first";
      },
    });
    await firstStarted;

    await expect(runTrackedJob({
      jobKey,
      trigger: "cron",
      run: async () => "duplicate",
    })).rejects.toBeInstanceOf(JobAlreadyRunningError);

    releaseFirst();
    await expect(first).resolves.toBe("first");
    await expect(runTrackedJob({
      jobKey,
      trigger: "manual",
      run: async () => "next",
    })).resolves.toBe("next");
  }, 120_000);
});
