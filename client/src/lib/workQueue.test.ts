import { describe, expect, it } from "vitest";
import { normalizeWorkQueue, workQueueSourceFromPlan, type WorkQueueSourceData } from "./workQueue";

type SourceCard = NonNullable<WorkQueueSourceData["doingCards"]>[number];

function card(id: string, name = id, extras: Partial<SourceCard> = {}) {
  return {
    id,
    name,
    url: `https://trello.example/${id}`,
    boardName: "Client Board",
    listName: "Doing",
    due: null,
    dateLastActivity: "2026-07-09T10:00:00.000Z",
    ...extras,
  };
}

describe("normalizeWorkQueue", () => {
  it("deduplicates cards by highest priority lane", () => {
    const queue = normalizeWorkQueue({
      overdueCards: [card("shared", "Shared card", { due: "2026-07-08T10:00:00.000Z" })],
      doingCards: [card("shared", "Shared card", { due: "2026-07-08T10:00:00.000Z" })],
      onHoldCards: [card("shared", "Shared card")],
    });

    expect(queue.cards).toHaveLength(1);
    expect(queue.cards[0]).toMatchObject({
      id: "shared",
      lane: "overdue",
      risk: "High",
    });
    expect(queue.lanes.map((lane) => [lane.id, lane.count])).toEqual([
      ["overdue", 1],
      ["doing", 0],
      ["onhold", 0],
    ]);
  });

  it("excludes doing cards already updated today", () => {
    const queue = normalizeWorkQueue({
      doingCards: [
        card("needs-update", "Needs update", { updatedToday: false }),
        card("already-updated", "Already updated", { updatedToday: true }),
      ],
    });

    expect(queue.cards.map((item) => item.id)).toEqual(["needs-update"]);
    expect(queue.lanes.find((lane) => lane.id === "doing")?.count).toBe(1);
  });

  it("keeps Now and Next Up focused to the first four queue cards", () => {
    const queue = normalizeWorkQueue({
      overdueCards: [
        card("one"),
        card("two"),
        card("three"),
        card("four"),
        card("five"),
      ],
    });

    expect(queue.nowItem?.id).toBe("one");
    expect(queue.nextItems.map((item) => item.id)).toEqual(["two", "three", "four"]);
  });

  it("promotes the active day-plan card so Today and Day plan agree on Now", () => {
    const queue = normalizeWorkQueue({
      overdueCards: [card("overdue")],
      doingCards: [card("planned-now")],
    }, "planned-now");

    expect(queue.nowItem?.id).toBe("planned-now");
    expect(queue.nextItems[0]?.id).toBe("overdue");
  });

  it("orders each lane by the most actionable stale signal", () => {
    const queue = normalizeWorkQueue({
      overdueCards: [
        card("later-overdue", "Later overdue", { due: "2026-07-08T10:00:00.000Z" }),
        card("oldest-overdue", "Oldest overdue", { due: "2026-07-06T10:00:00.000Z" }),
      ],
      doingCards: [
        card("doing-no-due", "Doing no due", { due: null, dateLastActivity: "2026-07-01T10:00:00.000Z" }),
        card("doing-due", "Doing due", { due: "2026-07-09T10:00:00.000Z", dateLastActivity: "2026-07-08T10:00:00.000Z" }),
      ],
      onHoldCards: [
        card("newer-hold", "Newer hold", { dateLastActivity: "2026-07-08T10:00:00.000Z" }),
        card("older-hold", "Older hold", { dateLastActivity: "2026-07-02T10:00:00.000Z" }),
      ],
    });

    expect(queue.cards.map((item) => item.id)).toEqual([
      "oldest-overdue",
      "later-overdue",
      "doing-due",
      "doing-no-due",
      "older-hold",
      "newer-hold",
    ]);
  });
});

describe("workQueueSourceFromPlan", () => {
  it("keeps Today usable from a saved plan when live Trello is temporarily unavailable", () => {
    const source = workQueueSourceFromPlan([
      { cardId: "overdue", cardName: "Overdue card", boardName: "Ops", listName: "To Do", flags: ["Overdue"] },
      { cardId: "blocked", cardName: "Blocked card", boardName: "Ops", listName: "On Hold", flags: ["Blocked"] },
      { cardId: "doing", cardName: "Doing card", boardName: "Ops", listName: "Doing", flags: [] },
      { cardId: "doing", cardName: "Duplicate block", boardName: "Ops", listName: "Doing", flags: [] },
      { cardId: null, cardName: "Protected block", boardName: "Routine", listName: "Protected", flags: ["Protected"] },
    ]);

    expect(source.overdueCards?.map((item) => item.id)).toEqual(["overdue"]);
    expect(source.onHoldCards?.map((item) => item.id)).toEqual(["blocked"]);
    expect(source.doingCards?.map((item) => item.id)).toEqual(["doing"]);
  });
});
