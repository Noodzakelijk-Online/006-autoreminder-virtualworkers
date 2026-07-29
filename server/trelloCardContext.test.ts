import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("axios", () => ({
  default: { get: vi.fn() },
}));

import axios from "axios";
import { clearCardContextCache, fetchCardContext } from "./trelloCardContext";

const activityAt = "2026-07-13T08:00:00.000Z";

describe("Trello card context cache", () => {
  beforeEach(() => {
    clearCardContextCache();
    vi.clearAllMocks();
    vi.mocked(axios.get).mockImplementation(async (url: string) => {
      if (url.endsWith("/cards/card-1")) {
        return {
          data: {
            id: "card-1",
            name: "Prepare client update",
            desc: "Summarize progress",
            due: null,
            dueComplete: false,
            url: "https://trello.com/c/card-1",
            shortUrl: "https://trello.com/c/card-1",
            idBoard: "board-1",
            idList: "list-1",
            dateLastActivity: activityAt,
            members: [],
            labels: [],
            attachments: [],
            customFieldItems: [],
          },
        } as never;
      }
      if (url.endsWith("/cards/card-1/checklists") || url.endsWith("/cards/card-1/actions") || url.endsWith("/boards/board-1/customFields")) {
        return { data: [] } as never;
      }
      throw new Error(`Unexpected Trello URL: ${url}`);
    });
  });

  it("reuses full context when Trello reports unchanged card activity", async () => {
    const known = { boardName: "Client Board", listName: "Doing", dateLastActivity: activityAt };
    const first = await fetchCardContext("card-1", "key", "token", known);
    const callsAfterFirstFetch = vi.mocked(axios.get).mock.calls.length;
    const second = await fetchCardContext("card-1", "key", "token", known);

    expect(first.name).toBe("Prepare client update");
    expect(second).toMatchObject({ boardName: "Client Board", listName: "Doing" });
    expect(callsAfterFirstFetch).toBe(4);
    expect(axios.get).toHaveBeenCalledTimes(callsAfterFirstFetch);
  });
});
