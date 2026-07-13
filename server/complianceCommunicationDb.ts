import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import {
  communicationEvidence,
  complianceClarificationRequests,
  complianceCommunicationEvidence,
  dailyComplianceSnapshots,
  emailTasks,
} from "../drizzle/schema";
import { getDb } from "./db";

export async function getComplianceSourceData(start: Date, end: Date) {
  const db = await getDb();
  if (!db) throw new Error("Compliance database is unavailable");
  const communicationStart = new Date(start.getTime() - 12 * 60 * 60_000);
  const emailStart = new Date(start.getTime() - 48 * 60 * 60_000);
  const snapshotStart = new Date(start.getTime() + 3 * 60 * 60_000).toISOString().slice(0, 10);
  const snapshotEnd = new Date(end.getTime() + 3 * 60 * 60_000).toISOString().slice(0, 10);
  const [messages, emails, resolutions] = await Promise.all([
    db.select().from(communicationEvidence).where(and(
      eq(communicationEvidence.responseRequired, true),
      gte(communicationEvidence.occurredAt, communicationStart),
      lt(communicationEvidence.occurredAt, end),
    )).orderBy(asc(communicationEvidence.occurredAt)),
    db.select().from(emailTasks).where(and(
      gte(emailTasks.receivedAt, emailStart),
      lt(emailTasks.receivedAt, end),
    )).orderBy(asc(emailTasks.receivedAt)),
    db.select().from(complianceClarificationRequests).where(and(
      eq(complianceClarificationRequests.status, "resolved"),
      sql`${complianceClarificationRequests.snapshotDate} >= ${snapshotStart}`,
      sql`${complianceClarificationRequests.snapshotDate} < ${snapshotEnd}`,
    )),
  ]);
  return { messages, emails, resolutions };
}

export async function getComplianceCommunicationEvidenceByDate(dateKey: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(complianceCommunicationEvidence)
    .where(sql`DATE_FORMAT(${complianceCommunicationEvidence.snapshotDate}, '%Y-%m-%d') = ${dateKey}`)
    .orderBy(asc(complianceCommunicationEvidence.kind), asc(complianceCommunicationEvidence.occurredAt));
}

export async function getComplianceClarifications(status: "open" | "resolved" | "all" = "open", limit = 100) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(complianceClarificationRequests);
  const rows = status === "all"
    ? await query.orderBy(desc(complianceClarificationRequests.requestedAt)).limit(Math.min(Math.max(limit, 1), 500))
    : await query.where(eq(complianceClarificationRequests.status, status))
      .orderBy(status === "open" ? asc(complianceClarificationRequests.requestedAt) : desc(complianceClarificationRequests.requestedAt))
      .limit(Math.min(Math.max(limit, 1), 500));
  return rows;
}

export class ComplianceClarificationError extends Error {
  constructor(message: string, public readonly code: "NOT_FOUND" | "ALREADY_RESOLVED" | "INVALID_UPDATE") {
    super(message);
  }
}

export async function resolveComplianceClarification(input: {
  id: number;
  resolution: "completed" | "not_completed" | "not_required";
  response: string;
}) {
  const response = input.response.trim();
  if (response.length < 10) {
    throw new ComplianceClarificationError("Provide a concrete update of at least 10 characters", "INVALID_UPDATE");
  }
  const db = await getDb();
  if (!db) throw new Error("Compliance database is unavailable");
  return db.transaction(async (tx) => {
    const [request] = await tx.select().from(complianceClarificationRequests)
      .where(eq(complianceClarificationRequests.id, input.id)).limit(1);
    if (!request) throw new ComplianceClarificationError("Clarification request not found", "NOT_FOUND");
    if (request.status !== "open") throw new ComplianceClarificationError("This clarification has already been resolved", "ALREADY_RESOLVED");

    const now = new Date();
    const outcome = input.resolution === "completed" ? "verified"
      : input.resolution === "not_completed" ? "missed"
        : "excluded";
    await tx.update(complianceClarificationRequests).set({
      status: "resolved",
      resolution: input.resolution,
      response,
      respondedAt: now,
      resolvedAt: now,
      updatedAt: now,
    }).where(eq(complianceClarificationRequests.id, input.id));
    await tx.update(complianceCommunicationEvidence).set({
      outcome,
      evidenceType: "joyce_confirmation",
      evidenceAt: now,
      verifiedAt: now,
      evidenceJson: JSON.stringify({
        version: "communication-compliance-v1",
        clarificationId: request.id,
        resolution: input.resolution,
        response,
        confirmedAt: now.toISOString(),
      }),
      updatedAt: now,
    }).where(and(
      sql`DATE_FORMAT(${complianceCommunicationEvidence.snapshotDate}, '%Y-%m-%d') = DATE_FORMAT(${request.snapshotDate}, '%Y-%m-%d')`,
      eq(complianceCommunicationEvidence.evidenceKey, request.evidenceKey),
    ));

    const facts = await tx.select({
      kind: complianceCommunicationEvidence.kind,
      outcome: complianceCommunicationEvidence.outcome,
    }).from(complianceCommunicationEvidence)
      .where(sql`DATE_FORMAT(${complianceCommunicationEvidence.snapshotDate}, '%Y-%m-%d') = DATE_FORMAT(${request.snapshotDate}, '%Y-%m-%d')`);
    const openRows = await tx.select({ id: complianceClarificationRequests.id }).from(complianceClarificationRequests)
      .where(and(
        sql`DATE_FORMAT(${complianceClarificationRequests.snapshotDate}, '%Y-%m-%d') = DATE_FORMAT(${request.snapshotDate}, '%Y-%m-%d')`,
        eq(complianceClarificationRequests.status, "open"),
      ));
    const count = (kind: typeof facts[number]["kind"], result?: typeof facts[number]["outcome"]) => facts.filter((fact) => fact.kind === kind && (!result || fact.outcome === result)).length;
    await tx.update(dailyComplianceSnapshots).set({
      messageTotal: facts.filter((fact) => fact.kind === "message_response" && fact.outcome !== "excluded").length,
      messageReplied: count("message_response", "verified"),
      messageMissed: count("message_response", "missed"),
      messageNeedsClarification: count("message_response", "needs_clarification"),
      emailTotal: facts.filter((fact) => fact.kind === "email_processing" && fact.outcome !== "excluded").length,
      emailCompleted: count("email_processing", "verified"),
      emailMissed: count("email_processing", "missed"),
      emailNeedsClarification: count("email_processing", "needs_clarification"),
      clarificationOpen: openRows.length,
      verificationStatus: openRows.length > 0 ? "needs_clarification" : "verified",
      updatedAt: now,
    }).where(sql`DATE_FORMAT(${dailyComplianceSnapshots.snapshotDate}, '%Y-%m-%d') = DATE_FORMAT(${request.snapshotDate}, '%Y-%m-%d')`);
    return { success: true, outcome, snapshotDate: String(request.snapshotDate).slice(0, 10) };
  });
}
