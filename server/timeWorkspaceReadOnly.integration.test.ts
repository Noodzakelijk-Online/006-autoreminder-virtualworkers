import { describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { timeReconciliationItems } from "../drizzle/schema";
import { getDb } from "./db";
import { getTimeWorkspace } from "./timeReconciliation";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("time workspace query semantics", () => {
  it("does not persist reconciliation rows while reading", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    const dateKey = "2099-01-02";
    const countRows = async () => {
      const [row] = await db!.select({ count: sql<number>`count(*)` })
        .from(timeReconciliationItems)
        .where(and(
          eq(timeReconciliationItems.dateKey, dateKey),
          eq(timeReconciliationItems.status, "open"),
        ));
      return Number(row?.count ?? 0);
    };
    const before = await countRows();
    await getTimeWorkspace(dateKey);
    expect(await countRows()).toBe(before);
  }, 120_000);
});
