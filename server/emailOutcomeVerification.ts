import { eq } from "drizzle-orm";
import { emailTasks } from "../drizzle/schema";
import { getDb } from "./db";
import { verifyGmailTaskOutcomes, type GmailComplianceObservation } from "./gmailIngestion";

type EmailTask = typeof emailTasks.$inferSelect;

export function deriveVerifiedEmailState(task: EmailTask, observation: GmailComplianceObservation | undefined) {
  if (!observation?.available) return {
    update: null,
    result: {
      id: task.id,
      verified: false,
      archived: false,
      replied: false,
      needsProcessingRecord: false,
      error: observation?.error ?? "Gmail verification was unavailable",
    },
  };

  const replied = Boolean(observation.sentReplyAt);
  const archived = observation.archived === true;
  const processedAt = task.processedAt ?? observation.sentReplyAt ?? null;
  const canClose = archived && Boolean(processedAt);
  const update = canClose
    ? { status: "archived" as const, processedAt, archivedAt: observation.checkedAt }
    : replied && !task.processedAt
      ? { status: "processed" as const, processedAt }
      : null;

  return {
    update,
    result: {
      id: task.id,
      verified: canClose || replied,
      archived,
      replied,
      needsProcessingRecord: archived && !processedAt,
      error: null,
    },
  };
}

async function verifyTasks(tasks: EmailTask[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const observations = await verifyGmailTaskOutcomes(tasks.map((task) => ({
    gmailMessageId: task.gmailMessageId,
    gmailThreadId: task.gmailThreadId,
    receivedAt: task.receivedAt,
  })));
  const results = [];

  for (const task of tasks) {
    const observation = observations.get(task.gmailMessageId);
    const derived = deriveVerifiedEmailState(task, observation);
    if (derived.update) await db.update(emailTasks).set(derived.update).where(eq(emailTasks.id, task.id));
    results.push(derived.result);
  }

  return results;
}

export async function verifyEmailTaskOutcome(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [task] = await db.select().from(emailTasks).where(eq(emailTasks.id, id)).limit(1);
  if (!task) throw new Error("Email task not found");
  const [result] = await verifyTasks([task]);
  return result;
}

export async function verifyProcessedEmailOutcomes() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const tasks = await db.select().from(emailTasks).where(eq(emailTasks.status, "processed"));
  const results = await verifyTasks(tasks);
  return {
    checked: results.length,
    closed: results.filter((result) => result.archived).length,
    replied: results.filter((result) => result.replied).length,
    unresolved: results.filter((result) => !result.archived).length,
    unavailable: results.filter((result) => Boolean(result.error)).length,
  };
}
