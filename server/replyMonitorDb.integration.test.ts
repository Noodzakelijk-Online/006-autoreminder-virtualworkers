import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { eq, like } from "drizzle-orm";
import { replyThreads, unsignedMessageFlags, vagueReplyFlags } from "../drizzle/schema";
import { getDb } from "./db";
import {
  getActiveUnsignedFlags,
  getActiveVagueReplyFlags,
  getAllReplyThreads,
  insertUnsignedFlag,
  insertVagueReplyFlag,
  upsertReplyThread,
} from "./replyMonitorDb";

const itWithDb = process.env.DATABASE_URL ? it : it.skip;

describe("Reply Monitor database integration", () => {
  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    await db.delete(unsignedMessageFlags).where(like(unsignedMessageFlags.cardId, "audit-%"));
    await db.delete(vagueReplyFlags).where(like(vagueReplyFlags.cardId, "audit-%"));
    await db.delete(replyThreads).where(like(replyThreads.cardId, "audit-%"));
  });

  itWithDb("persists one current thread and durable exception flags", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const cardId = `audit-${suffix}`;
    const base = {
      source: "trello" as const,
      cardId,
      cardName: "Audit thread",
      cardUrl: `https://trello.example/${cardId}`,
      boardName: "Audit",
      listName: "Doing",
      lastNonJoyceMsgAt: new Date(),
      lastNonJoyceAuthor: "Client",
      lastNonJoyceText: "Please confirm",
      lastJoyceReplyAt: null,
      status: "pending" as const,
      demerited: false,
    };

    await upsertReplyThread(base);
    await upsertReplyThread({ ...base, cardName: "Audit thread updated", status: "overdue" });
    const vagueId = await insertVagueReplyFlag({
      source: "trello",
      cardId,
      cardName: base.cardName,
      cardUrl: base.cardUrl,
      actionId: `audit-vague-${suffix}`,
      messageText: "I will get back to you soon",
      flaggedAt: new Date(),
    });
    const unsignedId = await insertUnsignedFlag({
      source: "trello",
      cardId,
      cardName: base.cardName,
      cardUrl: base.cardUrl,
      actionId: `audit-unsigned-${suffix}`,
      messageText: "Update without a signature",
      flaggedAt: new Date(),
    });

    expect((await getAllReplyThreads()).filter((row) => row.cardId === cardId)).toEqual([
      expect.objectContaining({ cardName: "Audit thread updated", status: "overdue" }),
    ]);
    expect((await getActiveVagueReplyFlags()).some((row) => row.id === vagueId)).toBe(true);
    expect((await getActiveUnsignedFlags()).some((row) => row.id === unsignedId)).toBe(true);

    const db = await getDb();
    await db!.delete(unsignedMessageFlags).where(eq(unsignedMessageFlags.cardId, cardId));
    await db!.delete(vagueReplyFlags).where(eq(vagueReplyFlags.cardId, cardId));
    await db!.delete(replyThreads).where(eq(replyThreads.cardId, cardId));
  });
});
