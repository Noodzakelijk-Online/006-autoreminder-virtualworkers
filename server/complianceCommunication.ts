import { dateKeyInEat } from "../shared/eatTime";
import type { ComplianceCommunicationEvidenceInput, ComplianceSnapshotInput } from "./db";
import type { GmailComplianceObservation } from "./gmailIngestion";

const METHOD_VERSION = "communication-compliance-v1";
const MESSAGE_RESPONSE_WINDOW_MS = 12 * 60 * 60_000;

type CommunicationRecord = {
  channel: string;
  externalId: string;
  threadId: string | null;
  sender: string | null;
  subject: string | null;
  summary: string | null;
  occurredAt: Date;
  respondedAt: Date | null;
  metadataJson: string | null;
};

type EmailRecord = {
  gmailMessageId: string;
  gmailThreadId: string;
  subject: string;
  fromAddress: string;
  receivedAt: Date;
  category: "financial" | "non_financial";
  status: "pending" | "processed" | "archived";
  deadlineAt: Date | null;
  processedAt: Date | null;
  archivedAt: Date | null;
};

type ResolutionRecord = {
  evidenceKey: string;
  resolution: "completed" | "not_completed" | "not_required" | null;
  response: string | null;
  respondedAt: Date | null;
};

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
}

function resolvedOutcome(resolution: ResolutionRecord | undefined) {
  if (resolution?.resolution === "completed") return "verified" as const;
  if (resolution?.resolution === "not_completed") return "missed" as const;
  if (resolution?.resolution === "not_required") return "excluded" as const;
  return null;
}

function applyResolution(
  fact: ComplianceCommunicationEvidenceInput,
  resolution: ResolutionRecord | undefined,
): ComplianceCommunicationEvidenceInput {
  const outcome = resolvedOutcome(resolution);
  if (!outcome) return fact;
  return {
    ...fact,
    outcome,
    evidenceType: "joyce_confirmation",
    evidenceAt: resolution?.respondedAt ?? fact.verifiedAt,
    evidenceJson: JSON.stringify({
      version: METHOD_VERSION,
      sourceEvidence: JSON.parse(fact.evidenceJson),
      clarification: {
        resolution: resolution?.resolution,
        response: resolution?.response,
        respondedAt: resolution?.respondedAt?.toISOString() ?? null,
      },
    }),
  };
}

function messageFact(
  dateKey: string,
  record: CommunicationRecord,
  cutoff: Date,
  verifiedAt: Date,
): ComplianceCommunicationEvidenceInput | null {
  if (record.channel === "gmail") return null;
  const occurredAt = new Date(record.occurredAt);
  const dueAt = new Date(occurredAt.getTime() + MESSAGE_RESPONSE_WINDOW_MS);
  if (dateKeyInEat(dueAt) !== dateKey || dueAt.getTime() > cutoff.getTime()) return null;
  const respondedAt = record.respondedAt ? new Date(record.respondedAt) : null;
  const replyIsValid = Boolean(respondedAt && respondedAt.getTime() > occurredAt.getTime() && respondedAt.getTime() <= cutoff.getTime());
  const inconsistentReply = Boolean(respondedAt && respondedAt.getTime() <= occurredAt.getTime());
  const metadata = parseMetadata(record.metadataJson);
  const evidenceKey = `message:${record.channel}:${record.externalId}`.slice(0, 256);
  const outcome = replyIsValid ? "verified" : inconsistentReply ? "needs_clarification" : "missed";
  return {
    snapshotDate: dateKey,
    evidenceKey,
    kind: "message_response",
    channel: record.channel,
    externalId: record.externalId,
    title: record.subject || record.summary || `Message from ${record.sender || "external sender"}`,
    sourceUrl: typeof metadata.cardUrl === "string" ? metadata.cardUrl : null,
    occurredAt,
    dueAt,
    outcome,
    evidenceType: replyIsValid ? "source_reply" : inconsistentReply ? "inconsistent_reply_timestamp" : "response_deadline_missed",
    evidenceAt: replyIsValid ? respondedAt : null,
    evidenceJson: JSON.stringify({
      version: METHOD_VERSION,
      threadId: record.threadId,
      sender: record.sender,
      occurredAt: occurredAt.toISOString(),
      dueAt: dueAt.toISOString(),
      respondedAt: respondedAt?.toISOString() ?? null,
      metadata,
    }),
    verifiedAt,
  };
}

function emailFact(
  dateKey: string,
  email: EmailRecord,
  observation: GmailComplianceObservation | undefined,
  cutoff: Date,
  verifiedAt: Date,
): ComplianceCommunicationEvidenceInput | null {
  const receivedAt = new Date(email.receivedAt);
  const dueAt = email.deadlineAt
    ? new Date(email.deadlineAt)
    : new Date(receivedAt.getTime() + (email.category === "financial" ? 48 : 12) * 60 * 60_000);
  if (dateKeyInEat(dueAt) !== dateKey || dueAt.getTime() > cutoff.getTime()) return null;
  const sentReplyAt = observation?.sentReplyAt && observation.sentReplyAt.getTime() <= cutoff.getTime()
    ? observation.sentReplyAt
    : null;
  const processedAt = email.processedAt && new Date(email.processedAt).getTime() <= cutoff.getTime() ? new Date(email.processedAt) : null;
  const archivedAt = email.archivedAt && new Date(email.archivedAt).getTime() <= cutoff.getTime() ? new Date(email.archivedAt) : null;
  const processedAndArchived = Boolean(processedAt && archivedAt && observation?.available && observation.archived === true);
  const legacyArchiveWithoutProcessing = Boolean(archivedAt && !processedAt);

  let outcome: ComplianceCommunicationEvidenceInput["outcome"];
  let evidenceType: string;
  let evidenceAt: Date | null;
  if (sentReplyAt) {
    outcome = "verified";
    evidenceType = "gmail_sent_reply";
    evidenceAt = sentReplyAt;
  } else if (processedAndArchived) {
    outcome = "verified";
    evidenceType = "processed_and_gmail_archived";
    evidenceAt = archivedAt;
  } else if (!observation?.available || observation.archived == null || legacyArchiveWithoutProcessing) {
    outcome = "needs_clarification";
    evidenceType = legacyArchiveWithoutProcessing ? "legacy_archive_without_processing" : "gmail_verification_unavailable";
    evidenceAt = null;
  } else {
    outcome = "missed";
    evidenceType = processedAt ? "processed_not_archived" : "email_deadline_missed";
    evidenceAt = processedAt;
  }

  return {
    snapshotDate: dateKey,
    evidenceKey: `email:gmail:${email.gmailMessageId}`.slice(0, 256),
    kind: "email_processing",
    channel: "gmail",
    externalId: email.gmailMessageId,
    title: email.subject,
    sourceUrl: `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(email.gmailThreadId)}`,
    occurredAt: receivedAt,
    dueAt,
    outcome,
    evidenceType,
    evidenceAt,
    evidenceJson: JSON.stringify({
      version: METHOD_VERSION,
      gmailThreadId: email.gmailThreadId,
      category: email.category,
      localStatus: email.status,
      receivedAt: receivedAt.toISOString(),
      dueAt: dueAt.toISOString(),
      processedAt: processedAt?.toISOString() ?? null,
      archivedAt: archivedAt?.toISOString() ?? null,
      gmail: observation ? {
        available: observation.available,
        archived: observation.archived,
        sentReplyAt: observation.sentReplyAt?.toISOString() ?? null,
        checkedAt: observation.checkedAt.toISOString(),
        error: observation.error,
      } : null,
    }),
    verifiedAt,
  };
}

export function buildCommunicationComplianceDay(input: {
  dateKey: string;
  messages: CommunicationRecord[];
  emails: EmailRecord[];
  gmailObservations: Map<string, GmailComplianceObservation>;
  resolutions: ResolutionRecord[];
  cutoff: Date;
  verifiedAt: Date;
}) {
  const resolutions = new Map(input.resolutions.map((row) => [row.evidenceKey, row]));
  const facts = [
    ...input.messages.map((record) => messageFact(input.dateKey, record, input.cutoff, input.verifiedAt)),
    ...input.emails.map((email) => emailFact(input.dateKey, email, input.gmailObservations.get(email.gmailMessageId), input.cutoff, input.verifiedAt)),
  ].filter((fact): fact is ComplianceCommunicationEvidenceInput => Boolean(fact))
    .map((fact) => applyResolution(fact, resolutions.get(fact.evidenceKey)));

  const included = facts.filter((fact) => fact.outcome !== "excluded");
  const messages = included.filter((fact) => fact.kind === "message_response");
  const emails = included.filter((fact) => fact.kind === "email_processing");
  return {
    facts,
    aggregate: {
      messageTotal: messages.length,
      messageReplied: messages.filter((fact) => fact.outcome === "verified").length,
      messageMissed: messages.filter((fact) => fact.outcome === "missed").length,
      messageNeedsClarification: messages.filter((fact) => fact.outcome === "needs_clarification").length,
      emailTotal: emails.length,
      emailCompleted: emails.filter((fact) => fact.outcome === "verified").length,
      emailMissed: emails.filter((fact) => fact.outcome === "missed").length,
      emailNeedsClarification: emails.filter((fact) => fact.outcome === "needs_clarification").length,
      clarificationOpen: facts.filter((fact) => fact.outcome === "needs_clarification").length,
    } satisfies Partial<ComplianceSnapshotInput>,
  };
}
