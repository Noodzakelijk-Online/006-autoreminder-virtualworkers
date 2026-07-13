/**
 * Tests for emailInbox and cardSnooze tRPC procedures.
 *
 * These tests verify:
 * - emailInbox.getPendingCount returns { count: number }
 * - emailInbox.archiveAll fails closed without persistence
 * - emailInbox.upsertBatch accepts valid email payloads
 * - cardSnooze.getSnoozedIds returns { cardIds: string[] }
 * - cardSnooze.snooze and cancel work correctly
 * - cardSnooze.resurfaceExpired returns { success: true, resurfaced: number }
 */
import { afterAll, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { emailTasks } from "../drizzle/schema";
import { like } from "drizzle-orm";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

const caller = appRouter.createCaller(createAuthContext());
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
const itWithoutDb = process.env.DATABASE_URL ? it.skip : it;
afterAll(async () => {
  const db = await getDb();
  if (db) await db.delete(emailTasks).where(like(emailTasks.gmailMessageId, "test-%"));
});

// ── emailInbox ────────────────────────────────────────────────────────────────

describe("emailInbox.getPendingCount", () => {
  it("returns an object with a numeric count", async () => {
    const result = await caller.emailInbox.getPendingCount();
    expect(result).toHaveProperty("count");
    expect(typeof result.count).toBe("number");
    expect(result.count).toBeGreaterThanOrEqual(0);
  }, 30000);
});

describe("emailInbox.getPending", () => {
  it("returns an array", async () => {
    const result = await caller.emailInbox.getPending();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("emailInbox.getAll", () => {
  it("returns an array", async () => {
    const result = await caller.emailInbox.getAll();
    expect(Array.isArray(result)).toBe(true);
  });
});

describeWithDb("emailInbox.upsertBatch", () => {
  it("upserts a batch of email tasks and returns success", async () => {
    const testEmails = [
      {
        gmailMessageId: "test-msg-001",
        gmailThreadId: "test-thread-001",
        subject: "Test Financial Email",
        fromAddress: "bank@example.com",
        fromName: "Bank",
        snippet: "Your account balance…",
        receivedAt: new Date("2026-01-01T10:00:00Z"),
        category: "financial" as const,
        status: "pending" as const,
        deadlineAt: new Date("2026-01-03T10:00:00Z"),
        suggestedNextAction: "Check account balance",
        llmSummary: "Bank notification about account",
      },
      {
        gmailMessageId: "test-msg-002",
        gmailThreadId: "test-thread-002",
        subject: "Test Non-Financial Email",
        fromAddress: "client@example.com",
        fromName: "Client",
        snippet: "Project update…",
        receivedAt: new Date("2026-01-01T11:00:00Z"),
        category: "non_financial" as const,
        status: "pending" as const,
      },
    ];

    const result = await caller.emailInbox.upsertBatch(testEmails);
    expect(result.success).toBe(true);
    expect(result.upserted).toBe(2);
  });

  it("handles idempotent upsert (same message ID twice)", async () => {
    const email = {
      gmailMessageId: "test-idempotent-001",
      gmailThreadId: "test-thread-idempotent",
      subject: "Idempotent Test",
      fromAddress: "test@example.com",
      fromName: "Test",
      receivedAt: new Date("2026-01-01T12:00:00Z"),
      category: "non_financial" as const,
      status: "pending" as const,
    };

    const r1 = await caller.emailInbox.upsertBatch([email]);
    const r2 = await caller.emailInbox.upsertBatch([email]);
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });
});

describe("emailInbox.archiveAll API shape", () => {
  itWithoutDb("fails closed when persistence is unavailable", async () => {
    await expect(caller.emailInbox.archiveAll()).rejects.toThrow("Database not available");
  });
});

// ── cardSnooze ────────────────────────────────────────────────────────────────

describe("cardSnooze.getSnoozedIds", () => {
  it("returns an object with cardIds array", async () => {
    const result = await caller.cardSnooze.getSnoozedIds();
    expect(result).toHaveProperty("cardIds");
    expect(Array.isArray(result.cardIds)).toBe(true);
  });
});

describe("cardSnooze.getActive", () => {
  it("returns an array of active snoozes", async () => {
    const result = await caller.cardSnooze.getActive();
    expect(Array.isArray(result)).toBe(true);
  });
});

describeWithDb("cardSnooze.snooze and cancel", () => {
  const testCardId = `test-card-snooze-${Date.now()}`;

  it("snoozes a card and it appears in getSnoozedIds", async () => {
    const tomorrow = new Date(Date.now() + 86400000);
    const result = await caller.cardSnooze.snooze({
      cardId: testCardId,
      cardName: "Test Snooze Card",
      cardUrl: "https://trello.com/c/test",
      boardName: "Test Board",
      listName: "ON HOLD",
      snoozedUntil: tomorrow,
      note: "Testing snooze",
    });
    expect(result.success).toBe(true);

    const ids = await caller.cardSnooze.getSnoozedIds();
    expect(ids.cardIds).toContain(testCardId);
  });

  it("cancels a snooze and card disappears from getSnoozedIds", async () => {
    const result = await caller.cardSnooze.cancel({ cardId: testCardId });
    expect(result.success).toBe(true);

    const ids = await caller.cardSnooze.getSnoozedIds();
    expect(ids.cardIds).not.toContain(testCardId);
  });
});

describe("cardSnooze.resurfaceExpired", () => {
  it("returns success with resurfaced count", async () => {
    const result = await caller.cardSnooze.resurfaceExpired();
    expect(result.success).toBe(true);
    expect(typeof result.resurfaced).toBe("number");
    expect(result.resurfaced).toBeGreaterThanOrEqual(0);
  });
});
