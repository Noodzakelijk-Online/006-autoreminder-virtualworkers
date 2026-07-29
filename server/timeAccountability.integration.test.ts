import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray, like } from "drizzle-orm";
import {
  timeDayReviews,
  timeEntries,
  timeEntryEvents,
  timeReconciliationItems,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  correctTimeEntry,
  createManualTimeEntry,
  getTimeDayReview,
  getTimeEntryEventsForDate,
  voidTimeEntry,
} from "./timeAccountability";
import { reviewAndLockTimeDay } from "./timeReconciliation";

const itWithDb = process.env.DATABASE_URL ? it : it.skip;
const testDate = "2020-01-15";

describe("time accountability ledger integration", () => {
  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    const entries = await db
      .select({ id: timeEntries.id })
      .from(timeEntries)
      .where(like(timeEntries.cardId, "time-ledger-test-%"));
    if (entries.length > 0) {
      await db.delete(timeEntryEvents).where(
        inArray(
          timeEntryEvents.timeEntryId,
          entries.map(entry => entry.id)
        )
      );
      await db.delete(timeEntries).where(
        inArray(
          timeEntries.id,
          entries.map(entry => entry.id)
        )
      );
    }
    await db.delete(timeDayReviews).where(eq(timeDayReviews.dateKey, testDate));
    await db
      .delete(timeReconciliationItems)
      .where(eq(timeReconciliationItems.dateKey, testDate));
  });

  itWithDb(
    "preserves create, correction, and void evidence",
    async () => {
      const cardId = `time-ledger-test-${Date.now()}`;
      const created = await createManualTimeEntry({
        dateKey: testDate,
        startTime: "09:00",
        endTime: "10:00",
        cardId,
        cardName: "Ledger test",
        cardUrl: `https://trello.com/c/${cardId}`,
        boardName: "Test",
        listName: "Doing",
        category: "client_work",
        reason: "Forgot to start the timer",
      });
      await expect(
        createManualTimeEntry({
          dateKey: testDate,
          startTime: "09:30",
          endTime: "10:30",
          cardId: `${cardId}-overlap`,
          cardName: "Overlapping test",
          cardUrl: `https://trello.com/c/${cardId}-overlap`,
          boardName: "Test",
          listName: "Doing",
          category: "client_work",
          reason: "Forgot another overlapping timer",
        })
      ).rejects.toThrow("overlaps");

      const corrected = await correctTimeEntry(
        created.id,
        1_800,
        "Removed an untracked interruption"
      );
      expect(corrected.durationSeconds).toBe(1_800);
      const review = await reviewAndLockTimeDay(testDate);
      expect(review?.status).toBe("locked");
      const voided = await voidTimeEntry(created.id, "Duplicate test evidence");
      expect(voided.isVoided).toBe(true);
      expect((await getTimeDayReview(testDate))?.status).toBe("needs_review");
      const events = await getTimeEntryEventsForDate(testDate);
      expect(
        events
          .filter(event => event.timeEntryId === created.id)
          .map(event => event.eventType)
      ).toEqual(["manual_create", "corrected", "voided"]);
    },
    20_000
  );
});
