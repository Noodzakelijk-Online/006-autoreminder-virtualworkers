import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getTrelloCommentToken: vi.fn() }));
vi.mock("./trello", () => ({ postCardComment: vi.fn() }));
vi.mock("./aptlssReassessment", () => ({ queueCardReassessment: vi.fn() }));
vi.mock("./sse", () => ({ broadcastTrelloInvalidate: vi.fn() }));

const { getTrelloCommentToken } = await import("./db");
const { postCardComment } = await import("./trello");
const { queueCardReassessment } = await import("./aptlssReassessment");
const { broadcastTrelloInvalidate } = await import("./sse");
const {
  formatJoyceComment,
  isAptlssSystemComment,
  postJoyceCardComment,
  postSystemCardComment,
} = await import("./trelloCommentService");

describe("Trello comment attribution", () => {
  beforeEach(() => {
    vi.stubEnv("TrelloAPIKey", "board-key");
    vi.stubEnv("TrelloAPIToken", "board-token");
    vi.mocked(postCardComment).mockResolvedValue({ id: "action-1", date: "2026-07-12T08:00:00.000Z" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("adds a Joyce signature without duplicating an existing one", () => {
    expect(formatJoyceComment("Update complete", false)).toBe("Update complete\n\n~ Joyce");
    expect(formatJoyceComment("Update complete\n\n~ Joyce", false)).toBe("Update complete\n\n~ Joyce");
  });

  it("uses Joyce's stored token without proxy mention when available", async () => {
    vi.mocked(getTrelloCommentToken).mockResolvedValue("joyce-token");

    const result = await postJoyceCardComment("card-1", "Update complete");

    expect(result.attribution).toBe("joyce_token");
    expect(postCardComment).toHaveBeenCalledWith(
      "card-1",
      "Update complete\n\n~ Joyce",
      "board-key",
      "joyce-token",
    );
    expect(queueCardReassessment).toHaveBeenCalledWith("card-1", "manual");
    expect(broadcastTrelloInvalidate).toHaveBeenCalledOnce();
  });

  it("makes board-owner proxy comments explicitly attributable to Joyce", async () => {
    vi.mocked(getTrelloCommentToken).mockResolvedValue(null);

    const result = await postJoyceCardComment("card-1", "Update complete");

    expect(result.attribution).toBe("board_owner_for_joyce");
    expect(postCardComment).toHaveBeenCalledWith(
      "card-1",
      "@joyjemimajj1\n\nUpdate complete\n\n~ Joyce",
      "board-key",
      "board-token",
    );
  });

  it("marks system notes so reply monitoring can exclude them", async () => {
    await postSystemCardComment("card-1", "Assessment refreshed");

    const postedText = vi.mocked(postCardComment).mock.calls[0]?.[1];
    expect(postedText).toBe("[APTLSS System]\n\nAssessment refreshed");
    expect(isAptlssSystemComment(postedText)).toBe(true);
  });
});
