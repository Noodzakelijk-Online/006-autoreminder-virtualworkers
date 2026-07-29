import { afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

import { handoffRecords } from "../drizzle/schema";
import { getDb } from "./db";
import { persistHandoffDraft, updateHandoffChecklist } from "./operatorRecordsDb";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("handoff checklist persistence", () => {
  const dateKey = "2099-01-01";

  afterAll(async () => {
    const db = await getDb();
    if (db) await db.delete(handoffRecords).where(and(
      eq(handoffRecords.dateKey, dateKey as unknown as Date),
      eq(handoffRecords.handoffType, "manual"),
    ));
  }, 120_000);

  it("stores checklist progress and marks a completed handoff reviewed", async () => {
    const checklist = [
      { id: "log_time", label: "Log time and close timers", done: false },
      { id: "close_browser_tabs", label: "Save needed references and close work tabs", done: false },
    ];
    const record = await persistHandoffDraft({
      dateKey,
      handoffType: "manual",
      content: "Test handoff",
      checklist,
    });
    const result = await updateHandoffChecklist(record.id, checklist.map((item) => ({ ...item, done: true })));

    expect(result.status).toBe("reviewed");
    const db = await getDb();
    const [saved] = await db!.select().from(handoffRecords).where(eq(handoffRecords.id, record.id)).limit(1);
    expect(saved.status).toBe("reviewed");
    expect(saved.reviewedAt).toBeInstanceOf(Date);
    expect(JSON.parse(saved.checklistJson)).toEqual(checklist.map((item) => ({ ...item, done: true })));
  }, 120_000);
});
