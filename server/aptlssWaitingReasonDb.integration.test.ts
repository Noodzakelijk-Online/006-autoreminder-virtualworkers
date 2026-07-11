import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { like } from "drizzle-orm";
import { aptlssWaitingReasons } from "../drizzle/schema";
import { interpretWaitingReason } from "./aptlssWaitingReason";
import {
  getActiveWaitingReason,
  getWaitingReasonHistory,
  recordAptlssWaitingReason,
  resolveAptlssWaitingReason,
} from "./aptlssWaitingReasonDb";
import { getDb } from "./db";

const itWithDb = process.env.DATABASE_URL ? it : it.skip;

describe("APTLSS waiting evidence ledger integration", () => {
  afterAll(async () => {
    const db = await getDb();
    if (db) await db.delete(aptlssWaitingReasons).where(like(aptlssWaitingReasons.cardId, "waiting-evidence-%"));
  });

  itWithDb("preserves versions and exposes only the latest active reason", async () => {
    const cardId = `waiting-evidence-${Date.now()}`;
    const base = {
      cardId,
      cardName: "Waiting evidence test",
      cardUrl: `https://trello.com/c/${cardId}`,
      boardName: "Test",
      listName: "On Hold",
      recordedBy: "integration-test",
    };
    await recordAptlssWaitingReason({
      ...base,
      interpretation: interpretWaitingReason("Waiting for Sarah to send the logo files tomorrow.", { nowMs: Date.parse("2026-07-11T07:00:00Z") }),
    });
    await recordAptlssWaitingReason({
      ...base,
      interpretation: interpretWaitingReason("Waiting for Robert to approve the final logo by Friday.", { nowMs: Date.parse("2026-07-11T07:00:00Z") }),
    });

    const active = await getActiveWaitingReason(cardId);
    const history = await getWaitingReasonHistory(cardId);
    expect(active?.waitingOn).toBe("robert");
    expect(active?.interpretationValue.nextAction).toContain("Robert");
    expect(history).toHaveLength(2);
    expect(history.map((row) => row.status)).toEqual(["active", "superseded"]);

    await resolveAptlssWaitingReason(cardId);
    await expect(getActiveWaitingReason(cardId)).resolves.toBeNull();
    expect((await getWaitingReasonHistory(cardId))[0].status).toBe("resolved");
  });
});
