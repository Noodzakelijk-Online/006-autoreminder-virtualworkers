import { describe, expect, it } from "vitest";
import { getTrelloMemberCardsPath, summarizeTrelloError } from "./services/trello-manus";

describe("Trello error summaries", () => {
  it("retains operational rate-limit facts without leaking request credentials", () => {
    const summary = summarizeTrelloError({
      isAxiosError: true,
      code: "ERR_BAD_REQUEST",
      config: {
        url: "https://api.trello.com/1/cards?key=secret-key&token=secret-token",
      },
      response: {
        status: 429,
        data: {
          error: "API_TOKEN_LIMIT_EXCEEDED",
          message: "Rate limit exceeded for token secret-token",
        },
        headers: {
          "retry-after": "Wed, 29 Jul 2026 21:39:10 GMT",
        },
      },
    });

    expect(summary).toEqual({
      type: "TrelloApiError",
      status: 429,
      providerCode: "API_TOKEN_LIMIT_EXCEEDED",
      retryAfter: "Wed, 29 Jul 2026 21:39:10 GMT",
      transportCode: "ERR_BAD_REQUEST",
    });
    expect(JSON.stringify(summary)).not.toContain("secret-key");
    expect(JSON.stringify(summary)).not.toContain("secret-token");
  });
});

describe("Trello worker scope", () => {
  it("uses the configured member instead of the API token owner", () => {
    expect(getTrelloMemberCardsPath("member-123")).toBe("/members/member-123/cards");
    expect(getTrelloMemberCardsPath("")).toBe("/members/me/cards");
  });
});
