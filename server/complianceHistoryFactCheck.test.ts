import { describe, expect, it } from "vitest";
import {
  buildHistoricalComplianceDay,
  reconstructCardAtCutoff,
  type HistoricalTrelloAction,
  type HistoricalTrelloCard,
} from "./complianceHistoryFactCheck";

const joyce = { id: "joyce-id", username: "joyjemimajj1", fullName: "Joyce" };
const owner = { id: "owner-id", username: "noodzakelijkonline", fullName: "Owner" };

function action(input: Partial<HistoricalTrelloAction> & Pick<HistoricalTrelloAction, "id" | "type" | "date">): HistoricalTrelloAction {
  return { data: {}, ...input };
}

function card(overrides: Partial<HistoricalTrelloCard> = {}): HistoricalTrelloCard {
  return {
    id: "60ed781bc8066c5f0906fed2",
    name: "Daily client work",
    url: "https://trello.com/c/card",
    idMembers: [joyce.id],
    idList: "doing-list",
    idBoard: "board",
    closed: false,
    listName: "DOING",
    boardName: "Client board",
    actions: [],
    ...overrides,
  };
}

describe("historical compliance fact-check", () => {
  it("replays assignment, list, and closed state backwards from current Trello state", () => {
    const result = reconstructCardAtCutoff(card({
      idMembers: [],
      listName: "Done",
      closed: true,
      actions: [
        action({ id: "assigned", type: "removeMemberFromCard", date: "2026-07-14T08:00:00.000Z", data: { idMember: joyce.id } }),
        action({ id: "moved", type: "updateCard", date: "2026-07-14T09:00:00.000Z", data: { listBefore: { name: "DOING" }, listAfter: { name: "Done" } } }),
        action({ id: "closed", type: "updateCard", date: "2026-07-14T10:00:00.000Z", data: { old: { closed: false } } }),
      ],
    }), new Date("2026-07-13T20:00:00.000Z"), joyce.id);

    expect(result).toMatchObject({ exists: true, assignedToJoyce: true, listName: "DOING", closed: false });
  });

  it("records direct and explicitly attributed proxy comments as update evidence", () => {
    const direct = card({
      id: "60ed781bc8066c5f0906fed2",
      actions: [action({
        id: "direct-update",
        type: "commentCard",
        date: "2026-07-13T10:00:00.000Z",
        data: { text: "Daily progress update." },
        memberCreator: joyce,
      })],
    });
    const proxy = card({
      id: "678660c97df3405136d523fd",
      actions: [action({
        id: "proxy-update",
        type: "commentCard",
        date: "2026-07-13T11:00:00.000Z",
        data: { text: "@joyjemimajj1\n\nProgress made.\n\n~ Joyce" },
        memberCreator: owner,
      })],
    });
    const result = buildHistoricalComplianceDay({
      dateKey: "2026-07-13",
      cards: [direct, proxy],
      joyce,
      owner,
      reviewedOnHoldIds: new Set(),
      verifiedAt: new Date("2026-07-14T00:00:00.000Z"),
      source: "fact_check",
    });

    expect(result.compliancePct).toBe(100);
    expect(result.snapshot.doingUpdated).toBe(2);
    expect(result.evidence.map((row) => row.evidenceType)).toEqual(["joyce_comment", "joyce_proxy_comment"]);
  });

  it("requires proof and preserves missed cards when no qualifying update exists", () => {
    const result = buildHistoricalComplianceDay({
      dateKey: "2026-07-13",
      cards: [card()],
      joyce,
      owner,
      reviewedOnHoldIds: new Set(),
      verifiedAt: new Date("2026-07-14T00:00:00.000Z"),
      source: "fact_check",
    });

    expect(result.compliancePct).toBe(0);
    expect(result.snapshot.doingMissedCards).toEqual([{ id: "60ed781bc8066c5f0906fed2", name: "Daily client work", url: "https://trello.com/c/card" }]);
    expect(result.evidence[0]).toMatchObject({ compliant: false, evidenceType: "none" });
  });

  it("counts a non-system human comment as a card update while preserving its attribution", () => {
    const human = { id: "va-id", username: "active-va", fullName: "Active VA" };
    const result = buildHistoricalComplianceDay({
      dateKey: "2026-07-13",
      cards: [card({
        actions: [action({
          id: "human-update",
          type: "commentCard",
          date: "2026-07-13T12:00:00.000Z",
          data: { text: "Step 5 is complete; the translated documents are ready." },
          memberCreator: human,
        })],
      })],
      joyce,
      owner,
      reviewedOnHoldIds: new Set(),
      verifiedAt: new Date("2026-07-14T00:00:00.000Z"),
      source: "fact_check",
    });

    expect(result.compliancePct).toBe(100);
    expect(result.evidence[0]).toMatchObject({ compliant: true, evidenceType: "human_card_update", evidenceActionId: "human-update" });
  });

  it("marks Sunday as protected and excludes all penalties", () => {
    const result = buildHistoricalComplianceDay({
      dateKey: "2026-07-12",
      cards: [card()],
      joyce,
      owner,
      reviewedOnHoldIds: new Set(),
      verifiedAt: new Date("2026-07-13T00:00:00.000Z"),
      source: "fact_check",
    });

    expect(result.snapshot).toMatchObject({ required: false, verificationStatus: "verified_protected", d1Instances: 0 });
    expect(result.compliancePct).toBe(100);
    expect(result.evidence).toEqual([]);
  });
});
