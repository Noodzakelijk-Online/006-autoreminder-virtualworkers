import { describe, it, expect, vi, beforeEach } from "vitest";
import { getJoyceCards, getJoyceRecentActions, getCardsNeedingDueDate, getCardsNeedingDailyUpdate, getOnHoldCards, getJoyceCommentedCardIdsToday, getRegisteredWebhooks, clearBoardListCache, moveCardToDoing } from "./trello";

// Mock axios
vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError),
  },
}));

import axios from "axios";

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Build a raw mock card as returned by the Trello /members/{id}/cards endpoint.
 * Note: the API does NOT embed the list object — it only returns idList and idBoard.
 * getJoyceCards then fetches /boards/{idBoard}/lists to resolve the list name.
 */
const mockCard = (id: string, name: string, listName = "DOING") => ({
  id,
  name,
  dateLastActivity: new Date().toISOString(),
  due: null,
  url: `https://trello.com/c/${id}`,
  idList: `list-${id}`,
  idBoard: "board-1",
  // NOTE: no `list` property here — the API doesn't return it
  _listName: listName, // internal helper field used by mockBoardLists
});

/**
 * Build the mock board-lists response that maps idList → list name.
 * Pass the array of mockCards that share the same board.
 */
const mockBoardLists = (cards: ReturnType<typeof mockCard>[]) =>
  cards.map(c => ({ id: c.idList, name: c._listName }));

// Helper: build a mock action
const mockAction = (id: string, cardId: string, cardName: string) => ({
  id,
  type: "commentCard",
  date: new Date().toISOString(),
  data: {
    card: { id: cardId, name: cardName },
    text: `Comment on ${cardName}`,
  },
  memberCreator: { id: "user1", fullName: "Noodzakelijk Online", username: "noodzakelijk" },
});

/**
 * Set up the three-call mock sequence that getJoyceCards now requires:
 *   1. GET /members/{id}/cards  → returns rawCards
 *   2. GET /boards/{id}/lists   → returns board list objects (one call per unique board)
 *   3. GET /boards/{id}         → returns board name (one call per unique board)
 * getBoardListsCached uses Promise.all([lists, board]) so both are fired in parallel
 * but axios mock resolves them in registration order.
 */
function mockGetJoyceCards(cards: ReturnType<typeof mockCard>[]) {
  // Call 1: cards endpoint
  (axios.get as any).mockResolvedValueOnce({ data: cards });
  // Call 2: board lists endpoint (one call for "board-1")
  (axios.get as any).mockResolvedValueOnce({ data: mockBoardLists(cards) });
  // Call 3: board name endpoint (one call for "board-1")
  (axios.get as any).mockResolvedValueOnce({ data: { id: "board-1", name: "Test Board" } });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("Trello API Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearBoardListCache(); // Ensure each test starts with a fresh cache
  });

  describe("getJoyceCards", () => {
    it("does not log Trello key or token when a request fails", async () => {
      const error = {
        isAxiosError: true,
        code: "EACCES",
        config: {
          url: "https://api.trello.com/1/members/joyjemimajj1/cards",
          params: {
            key: "secret-key",
            token: "secret-token",
          },
        },
      };
      (axios.get as any).mockRejectedValueOnce(error);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      await expect(getJoyceCards("secret-key", "secret-token")).rejects.toThrow("Failed to fetch Trello cards");

      const logged = JSON.stringify(consoleSpy.mock.calls);
      expect(logged).not.toContain("secret-key");
      expect(logged).not.toContain("secret-token");
      expect(logged).toContain("/1/members/joyjemimajj1/cards");
      consoleSpy.mockRestore();
    });
  });

  describe("getRegisteredWebhooks", () => {
    it("redacts token path segments when webhook lookup fails", async () => {
      const error = {
        isAxiosError: true,
        code: "EACCES",
        config: {
          url: "https://api.trello.com/1/tokens/secret-token/webhooks",
          params: {
            key: "secret-key",
            token: "secret-token",
          },
        },
      };
      (axios.get as any).mockRejectedValueOnce(error);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      await expect(getRegisteredWebhooks("secret-key", "secret-token")).resolves.toEqual([]);

      const logged = JSON.stringify(consoleSpy.mock.calls);
      expect(logged).not.toContain("secret-key");
      expect(logged).not.toContain("secret-token");
      expect(logged).toContain("/1/tokens/:token/webhooks");
      consoleSpy.mockRestore();
    });
  });

  describe("getCardsNeedingDueDate", () => {
    it("should return only cards with no due date", async () => {
      const cards = [
        mockCard("c1", "No Due Date Card", "TODO"),
        { ...mockCard("c2", "Has Due Date", "TODO"), due: "2026-06-01T00:00:00.000Z" },
      ];
      mockGetJoyceCards(cards);
      const result = await getCardsNeedingDueDate("key", "token");
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("c1");
    });

    it("should exclude cards in DONE lists even if they have no due date", async () => {
      const cards = [
        mockCard("c1", "Active No Due", "TODO"),
        mockCard("c2", "Done No Due", "done"),
      ];
      mockGetJoyceCards(cards);
      const result = await getCardsNeedingDueDate("key", "token");
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("c1");
    });

    it("should return empty array when all active cards have due dates", async () => {
      const cards = [{ ...mockCard("c1", "Card 1", "TODO"), due: "2026-06-01T00:00:00.000Z" }];
      mockGetJoyceCards(cards);
      const result = await getCardsNeedingDueDate("key", "token");
      expect(result).toEqual([]);
    });
  });

  describe("getCardsNeedingDailyUpdate", () => {
    it("should return only cards in DOING lists", async () => {
      const cards = [
        mockCard("c1", "Doing Card", "doing"),
        mockCard("c2", "TODO Card", "TODO"),
        mockCard("c3", "In Progress Card", "in progress"),
      ];
      mockGetJoyceCards(cards);
      const result = await getCardsNeedingDailyUpdate("key", "token");
      expect(result.length).toBe(2);
      expect(result.map(c => c.id).sort()).toEqual(["c1", "c3"].sort());
    });

    it("should sort by closest due date first, no-due-date cards last", async () => {
      const cards = [
        { ...mockCard("c1", "Far Due", "doing"), due: "2026-12-01T00:00:00.000Z" },
        { ...mockCard("c2", "Near Due", "doing"), due: "2026-06-01T00:00:00.000Z" },
        mockCard("c3", "No Due", "doing"),
      ];
      mockGetJoyceCards(cards);
      const result = await getCardsNeedingDailyUpdate("key", "token");
      expect(result[0].id).toBe("c2");
      expect(result[1].id).toBe("c1");
      expect(result[2].id).toBe("c3");
    });

    it("should return empty array when no DOING cards exist", async () => {
      const cards = [mockCard("c1", "TODO Card", "TODO")];
      mockGetJoyceCards(cards);
      const result = await getCardsNeedingDailyUpdate("key", "token");
      expect(result).toEqual([]);
    });
  });

  describe("getOnHoldCards", () => {
    it("should return only cards in ON-HOLD lists", async () => {
      const cards = [
        mockCard("c1", "On Hold Card", "on-hold"),
        mockCard("c2", "Doing Card", "doing"),
        mockCard("c3", "On Hold 2", "on hold"),
      ];
      mockGetJoyceCards(cards);
      const result = await getOnHoldCards("key", "token");
      expect(result.length).toBe(2);
      expect(result.map(c => c.id).sort()).toEqual(["c1", "c3"].sort());
    });

    it("should match 'onhold' variant", async () => {
      const cards = [mockCard("c1", "Card", "onhold")];
      mockGetJoyceCards(cards);
      const result = await getOnHoldCards("key", "token");
      expect(result.length).toBe(1);
    });

    it("should return empty array when no ON-HOLD cards exist", async () => {
      const cards = [mockCard("c1", "Doing Card", "doing")];
      mockGetJoyceCards(cards);
      const result = await getOnHoldCards("key", "token");
      expect(result).toEqual([]);
    });
  });

  describe("getJoyceRecentActions", () => {
    it("should fetch card activities from Trello API", async () => {
      // Call 1+2: getJoyceCards (cards + board lists)
      mockGetJoyceCards([mockCard("card1", "Test Card 1")]);
      // Call 3: /cards/{id}/actions
      (axios.get as any).mockResolvedValueOnce({
        data: [mockAction("action1", "card1", "Test Card 1")],
      });

      const result = await getJoyceRecentActions("test-key", "test-token");

      expect(axios.get).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should return array of card updates with correct structure", async () => {
      mockGetJoyceCards([mockCard("card1", "Test Card")]);
      (axios.get as any).mockResolvedValueOnce({
        data: [mockAction("action1", "card1", "Test Card")],
      });

      const result = await getJoyceRecentActions("test-key", "test-token");

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("type");
      expect(result[0]).toHaveProperty("date");
      expect(result[0]).toHaveProperty("data");
      expect(result[0]).toHaveProperty("memberCreator");
    });

    it("should filter out cards in DONE lists", async () => {
      // Two cards: one in DOING (should appear), one in DONE (should be filtered)
      const cards = [
        mockCard("card1", "Active Card", "DOING"),
        mockCard("card2", "Done Card", "DONE"),
      ];
      mockGetJoyceCards(cards);
      // Only one card action request should be made (for card1 only)
      (axios.get as any).mockResolvedValueOnce({
        data: [mockAction("action1", "card1", "Active Card")],
      });

      const result = await getJoyceRecentActions("test-key", "test-token");

      // Result should only contain the action from the active card
      expect(result.length).toBe(1);
      expect(result[0].data.card?.name).toBe("Active Card");
    });

    it("should limit results to specified number of updates", async () => {
      const cards = [
        mockCard("c1", "Card 1"),
        mockCard("c2", "Card 2"),
        mockCard("c3", "Card 3"),
      ];
      mockGetJoyceCards(cards);
      // Each card returns 2 actions = 6 total, but limit is 4
      for (let i = 0; i < 3; i++) {
        (axios.get as any).mockResolvedValueOnce({
          data: [
            mockAction(`a${i}a`, `c${i + 1}`, `Card ${i + 1}`),
            mockAction(`a${i}b`, `c${i + 1}`, `Card ${i + 1}`),
          ],
        });
      }

      const result = await getJoyceRecentActions("test-key", "test-token", 4);

      expect(result.length).toBeLessThanOrEqual(4);
    });

    it("should handle API errors gracefully", async () => {
      (axios.get as any).mockRejectedValueOnce(new Error("API Error"));

      await expect(getJoyceRecentActions("test-key", "test-token")).rejects.toThrow();
    });

    it("should return empty array when no cards are assigned", async () => {
      // Call 1: cards endpoint returns empty array (no board IDs → no board-lists call)
      (axios.get as any).mockResolvedValueOnce({ data: [] });

      const result = await getJoyceRecentActions("test-key", "test-token");

      expect(result).toEqual([]);
    });
  });

  // ── getJoyceCommentedCardIdsToday ──────────────────────────────────────────
  // The function makes 2 parallel axios.get calls:
  //   1. Joyce's actions via board owner token (JOYCE_MEMBER_ID)
  //   2. Board owner's actions (BOARD_OWNER_MEMBER_ID)
  // Each test must provide 2 mockResolvedValueOnce calls accordingly.
  describe("getJoyceCommentedCardIdsToday", () => {
    it("should return a Set containing card IDs commented on today", async () => {
      const nowIso = new Date().toISOString();
      // Call 1: Joyce's actions via board owner token
      (axios.get as any).mockResolvedValueOnce({
        data: [
          {
            id: "action1",
            type: "commentCard",
            date: nowIso,
            data: { card: { id: "card-abc", name: "Some Card" }, text: "update" },
            memberCreator: { id: "joyjemimajj1", fullName: "Joyce", username: "joyjemimajj1" },
          },
        ],
      });
      // Call 2: board owner's actions (empty)
      (axios.get as any).mockResolvedValueOnce({ data: [] });
      const result = await getJoyceCommentedCardIdsToday("test-key", "test-token");
      expect(result).toBeInstanceOf(Set);
      expect(result.has("card-abc")).toBe(true);
    });

    it("should not include cards commented on a different day", async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      // Call 1: Joyce's actions via board owner token (yesterday's comment)
      (axios.get as any).mockResolvedValueOnce({
        data: [
          {
            id: "action2",
            type: "commentCard",
            date: yesterday,
            data: { card: { id: "card-xyz", name: "Old Card" }, text: "old" },
            memberCreator: { id: "joyjemimajj1", fullName: "Joyce", username: "joyjemimajj1" },
          },
        ],
      });
      // Call 2: board owner's actions (empty)
      (axios.get as any).mockResolvedValueOnce({ data: [] });
      const result = await getJoyceCommentedCardIdsToday("test-key", "test-token");
      expect(result.has("card-xyz")).toBe(false);
    });

    it("should return empty Set when API fails (graceful degradation)", async () => {
      // Both calls reject — Promise.all will reject, caught by try/catch
      (axios.get as any).mockRejectedValueOnce(new Error("Network error"));
      (axios.get as any).mockRejectedValueOnce(new Error("Network error"));
      const result = await getJoyceCommentedCardIdsToday("test-key", "test-token");
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it("should return empty Set when there are no comment actions", async () => {
      // Call 1: Joyce's actions (empty)
      (axios.get as any).mockResolvedValueOnce({ data: [] });
      // Call 2: board owner's actions (empty)
      (axios.get as any).mockResolvedValueOnce({ data: [] });
      const result = await getJoyceCommentedCardIdsToday("test-key", "test-token");
      expect(result.size).toBe(0);
    });
  });

  describe("moveCardToDoing", () => {
    it("moves the card to the board's canonical DOING list", async () => {
      (axios.get as any)
        .mockResolvedValueOnce({ data: { idBoard: "board-1", idList: "backlog" } })
        .mockResolvedValueOnce({ data: [{ id: "backlog", name: "Backlog" }, { id: "doing", name: "DOING" }] })
        .mockResolvedValueOnce({ data: { id: "board-1", name: "Operations" } });
      (axios.put as any).mockResolvedValueOnce({ data: { id: "card-1" } });

      const result = await moveCardToDoing("card-1", "key", "token");

      expect(result).toEqual({ moved: true, previousListId: "backlog", targetListId: "doing", targetListName: "DOING" });
      expect(axios.put).toHaveBeenCalledWith(
        "https://api.trello.com/1/cards/card-1",
        null,
        { params: { key: "key", token: "token", idList: "doing" } },
      );
    });

    it("returns a truthful no-op when the card is already in DOING", async () => {
      (axios.get as any)
        .mockResolvedValueOnce({ data: { idBoard: "board-1", idList: "doing" } })
        .mockResolvedValueOnce({ data: [{ id: "doing", name: "DOING" }] })
        .mockResolvedValueOnce({ data: { id: "board-1", name: "Operations" } });

      const result = await moveCardToDoing("card-1", "key", "token");

      expect(result.moved).toBe(false);
      expect(axios.put).not.toHaveBeenCalled();
    });
  });
});
