import { describe, expect, it } from "vitest";
import {
  classifyGmailTask,
  deduplicateGmailTasks,
  normalizeGmailMessage,
  type NormalizedGmailTask,
} from "./gmailIngestion";

function task(overrides: Partial<NormalizedGmailTask> = {}): NormalizedGmailTask {
  return {
    gmailMessageId: "message-1",
    gmailThreadId: "thread-1",
    subject: "Project update",
    fromAddress: "sender@example.com",
    fromName: "Sender",
    snippet: "Here is the requested project update.",
    receivedAt: new Date("2026-07-12T12:00:00Z"),
    category: "non_financial",
    status: "pending",
    suggestedNextAction: "Review the update.",
    llmSummary: "Sender shared an update.",
    ...overrides,
  };
}

describe("Gmail ingestion normalization", () => {
  it("classifies financial evidence and produces a concrete next action", () => {
    const result = classifyGmailTask({
      subject: "Invoice 492 is due",
      snippet: "Please arrange payment by Friday.",
      fromName: "Supplier",
      fromAddress: "billing@example.com",
    });

    expect(result.category).toBe("financial");
    expect(result.suggestedNextAction).toContain("payment or bookkeeping");
    expect(result.llmSummary).toContain("Supplier");
  });

  it("recognizes a support case as operational rather than financial", () => {
    const result = classifyGmailTask({
      subject: "Support case 11245591",
      snippet: "Run a clean reproduction and send the timestamp.",
      fromName: "Support",
      fromAddress: "support@example.com",
    });

    expect(result.category).toBe("non_financial");
    expect(result.suggestedNextAction).toContain("troubleshooting or follow-up");
  });

  it("preserves Gmail identifiers, snippet, sender, and received timestamp", () => {
    const normalized = normalizeGmailMessage({
      id: "19f572b6b3214f0a",
      threadId: "19f4b41f1d80a087",
      snippet: "Exact Gmail snippet",
      internalDate: String(new Date("2026-07-12T16:31:29Z").getTime()),
      payload: {
        headers: [
          { name: "From", value: "OpenAI Support <support@openai.com>" },
          { name: "Subject", value: "Bug report" },
        ],
      },
    });

    expect(normalized).toMatchObject({
      gmailMessageId: "19f572b6b3214f0a",
      gmailThreadId: "19f4b41f1d80a087",
      snippet: "Exact Gmail snippet",
      fromName: "OpenAI Support",
      fromAddress: "support@openai.com",
      subject: "Bug report",
    });
    expect(normalized.receivedAt.toISOString()).toBe("2026-07-12T16:31:29.000Z");
  });

  it("keeps only the newest message in each Gmail thread", () => {
    const retained = deduplicateGmailTasks([
      task({ gmailMessageId: "old", receivedAt: new Date("2026-07-12T10:00:00Z") }),
      task({ gmailMessageId: "new", receivedAt: new Date("2026-07-12T11:00:00Z") }),
      task({ gmailMessageId: "other", gmailThreadId: "thread-2", receivedAt: new Date("2026-07-12T09:00:00Z") }),
    ]);

    expect(retained.map((item) => item.gmailMessageId)).toEqual(["new", "other"]);
  });
});
