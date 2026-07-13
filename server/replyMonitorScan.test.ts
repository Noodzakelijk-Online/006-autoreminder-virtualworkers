import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("axios", () => ({
  default: { get: vi.fn() },
}));

vi.mock("./trello", () => ({
  getJoyceCards: vi.fn(),
}));

import axios from "axios";
import { getJoyceCards } from "./trello";
import { clearReplyMonitorCommentCache, scanTrelloReplyThreads } from "./replyMonitor";

function card(dateLastActivity: string) {
  return {
    id: "card-1",
    name: "Client question",
    dateLastActivity,
    due: null,
    url: "https://trello.com/c/card-1",
    idList: "list-1",
    idBoard: "board-1",
    list: { id: "list-1", name: "Doing" },
    boardName: "Client Board",
  };
}

describe("reply monitor scan cache", () => {
  beforeEach(() => {
    clearReplyMonitorCommentCache();
    vi.clearAllMocks();
    vi.mocked(axios.get).mockResolvedValue({
      data: [{
        id: "comment-1",
        type: "commentCard",
        date: "2026-07-13T08:01:00.000Z",
        data: { text: "Can you confirm the delivery date?" },
        memberCreator: { id: "client-1", username: "client", fullName: "Client" },
      }],
    } as never);
  });

  it("fetches comments again only after card activity changes", async () => {
    vi.mocked(getJoyceCards).mockResolvedValue([card("2026-07-13T08:01:00.000Z")]);

    await scanTrelloReplyThreads("key", "token");
    await scanTrelloReplyThreads("key", "token");
    expect(axios.get).toHaveBeenCalledTimes(1);

    vi.mocked(getJoyceCards).mockResolvedValue([card("2026-07-13T08:02:00.000Z")]);
    await scanTrelloReplyThreads("key", "token");
    expect(axios.get).toHaveBeenCalledTimes(2);
  });
});
