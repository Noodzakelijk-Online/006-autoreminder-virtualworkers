import { describe, expect, it } from "vitest";
import { deriveVerifiedEmailState } from "./emailOutcomeVerification";

const baseTask = {
  id: 7,
  gmailMessageId: "message-1",
  gmailThreadId: "thread-1",
  subject: "Action required",
  fromAddress: "client@example.com",
  fromName: "Client",
  snippet: null,
  receivedAt: new Date("2026-07-15T08:00:00Z"),
  category: "non_financial" as const,
  status: "pending" as const,
  deadlineAt: null,
  trelloCardId: null,
  trelloCardName: null,
  trelloCardUrl: null,
  suggestedNextAction: null,
  llmSummary: null,
  processedAt: null,
  archivedAt: null,
  createdAt: new Date("2026-07-15T08:00:00Z"),
  updatedAt: new Date("2026-07-15T08:00:00Z"),
};

describe("Gmail outcome verification", () => {
  it("closes a processed task only after Gmail confirms archive", () => {
    const processedAt = new Date("2026-07-15T09:00:00Z");
    const checkedAt = new Date("2026-07-15T09:05:00Z");
    const result = deriveVerifiedEmailState(
      { ...baseTask, status: "processed", processedAt },
      { available: true, archived: true, sentReplyAt: null, checkedAt, error: null },
    );
    expect(result.update).toEqual({ status: "archived", processedAt, archivedAt: checkedAt });
    expect(result.result).toMatchObject({ verified: true, archived: true });
  });

  it("records a verified reply as processed without claiming archive", () => {
    const sentReplyAt = new Date("2026-07-15T09:00:00Z");
    const result = deriveVerifiedEmailState(baseTask, {
      available: true,
      archived: false,
      sentReplyAt,
      checkedAt: new Date("2026-07-15T09:05:00Z"),
      error: null,
    });
    expect(result.update).toEqual({ status: "processed", processedAt: sentReplyAt });
    expect(result.result).toMatchObject({ verified: true, replied: true, archived: false });
  });

  it("does not close an archived message without a processing record", () => {
    const result = deriveVerifiedEmailState(baseTask, {
      available: true,
      archived: true,
      sentReplyAt: null,
      checkedAt: new Date("2026-07-15T09:05:00Z"),
      error: null,
    });
    expect(result.update).toBeNull();
    expect(result.result).toMatchObject({ verified: false, needsProcessingRecord: true });
  });

  it("fails closed when Gmail evidence is unavailable", () => {
    const result = deriveVerifiedEmailState(baseTask, {
      available: false,
      archived: null,
      sentReplyAt: null,
      checkedAt: new Date("2026-07-15T09:05:00Z"),
      error: "OAuth unavailable",
    });
    expect(result.update).toBeNull();
    expect(result.result).toMatchObject({ verified: false, error: "OAuth unavailable" });
  });
});
