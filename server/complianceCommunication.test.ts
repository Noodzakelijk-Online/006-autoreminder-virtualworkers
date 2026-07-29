import { describe, expect, it } from "vitest";
import { buildCommunicationComplianceDay } from "./complianceCommunication";

const verifiedAt = new Date("2026-07-14T20:05:00Z");
const cutoff = new Date("2026-07-14T20:00:00Z");

describe("communication compliance", () => {
  it("scores a source-backed Trello reply inside the response window", () => {
    const result = buildCommunicationComplianceDay({
      dateKey: "2026-07-14",
      messages: [{
        channel: "trello",
        externalId: "card-1:message-1",
        threadId: "card-1",
        sender: "Client",
        subject: "Client request",
        summary: "Please confirm",
        occurredAt: new Date("2026-07-13T18:00:00Z"),
        respondedAt: new Date("2026-07-14T05:00:00Z"),
        metadataJson: JSON.stringify({ cardUrl: "https://trello.com/c/card-1" }),
      }],
      emails: [],
      gmailObservations: new Map(),
      resolutions: [],
      cutoff,
      verifiedAt,
    });
    expect(result.aggregate).toMatchObject({ messageTotal: 1, messageReplied: 1, messageMissed: 0, clarificationOpen: 0 });
    expect(result.facts[0]).toMatchObject({ outcome: "verified", evidenceType: "source_reply" });
  });

  it("accepts an email only when processing and Gmail archive are both proven", () => {
    const receivedAt = new Date("2026-07-12T20:00:00Z");
    const result = buildCommunicationComplianceDay({
      dateKey: "2026-07-14",
      messages: [],
      emails: [{
        gmailMessageId: "gmail-1",
        gmailThreadId: "thread-1",
        subject: "Invoice",
        fromAddress: "billing@example.com",
        receivedAt,
        category: "financial",
        status: "archived",
        deadlineAt: null,
        processedAt: new Date("2026-07-14T16:00:00Z"),
        archivedAt: new Date("2026-07-14T17:00:00Z"),
      }],
      gmailObservations: new Map([["gmail-1", {
        available: true,
        archived: true,
        sentReplyAt: null,
        checkedAt: verifiedAt,
        error: null,
      }]]),
      resolutions: [],
      cutoff,
      verifiedAt,
    });
    expect(result.aggregate).toMatchObject({ emailTotal: 1, emailCompleted: 1, emailMissed: 0 });
    expect(result.facts[0]).toMatchObject({ outcome: "verified", evidenceType: "processed_and_gmail_archived" });
  });

  it("asks Joyce when Gmail evidence is unavailable and honors her durable outcome", () => {
    const base = {
      dateKey: "2026-07-14",
      messages: [],
      emails: [{
        gmailMessageId: "gmail-2",
        gmailThreadId: "thread-2",
        subject: "Platform message",
        fromAddress: "platform@example.com",
        receivedAt: new Date("2026-07-14T02:00:00Z"),
        category: "non_financial" as const,
        status: "pending" as const,
        deadlineAt: null,
        processedAt: null,
        archivedAt: null,
      }],
      gmailObservations: new Map([["gmail-2", {
        available: false,
        archived: null,
        sentReplyAt: null,
        checkedAt: verifiedAt,
        error: "connection unavailable",
      }]]),
      cutoff,
      verifiedAt,
    };
    const unresolved = buildCommunicationComplianceDay({ ...base, resolutions: [] });
    expect(unresolved.aggregate).toMatchObject({ emailNeedsClarification: 1, clarificationOpen: 1 });

    const resolved = buildCommunicationComplianceDay({
      ...base,
      resolutions: [{
        evidenceKey: "email:gmail:gmail-2",
        resolution: "completed",
        response: "Replied in Gmail at 16:10 EAT.",
        respondedAt: verifiedAt,
      }],
    });
    expect(resolved.aggregate).toMatchObject({ emailCompleted: 1, emailNeedsClarification: 0, clarificationOpen: 0 });
    expect(resolved.facts[0]).toMatchObject({ outcome: "verified", evidenceType: "joyce_confirmation" });
  });
});
