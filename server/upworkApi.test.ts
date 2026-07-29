import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./upworkOauth", () => ({
  UPWORK_GRAPHQL_URL: "https://api.upwork.test/graphql",
  refreshUpworkAccessToken: vi.fn(async () => ({ accessToken: "access-token", expiresIn: 86_400 })),
}));

vi.mock("./upworkIntegrationSettings", () => ({
  getUpworkOauthConnection: vi.fn(async () => ({
    refreshToken: "refresh-token",
    userId: "owner-1",
    userName: "Owner",
    organizationId: "org-1",
    connectedAt: "2026-07-15T10:00:00.000Z",
    source: "database",
  })),
}));

import { getUpworkOauthConnection } from "./upworkIntegrationSettings";
import { fetchUpworkMessageSnapshot } from "./upworkApi";

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchUpworkMessageSnapshot", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("reads official room and story pages with the tenant and owner context", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({
        data: {
          roomList: {
            edges: [{ node: {
              id: "room-1",
              roomName: "Ada Client",
              topic: "Website delivery",
              numUnread: 2,
              latestStory: {
                id: "story-2",
                createdDateTime: "2026-07-15T11:00:00.000Z",
                user: { id: "client-1", name: "Ada Client" },
                message: "Can you confirm delivery?",
              },
            } }],
            pageInfo: { hasNextPage: false, endCursor: "room-end" },
          },
        },
      }))
      .mockResolvedValueOnce(response({
        data: {
          roomStories: {
            edges: [
              { node: { id: "story-2", createdDateTime: "2026-07-15T11:00:00.000Z", user: { id: "client-1", name: "Ada Client" }, message: "Can you confirm delivery?" } },
              { node: { id: "story-1", createdDateTime: "2026-07-15T10:00:00.000Z", user: { id: "owner-1", name: "Owner" }, message: "I will check. ~ Joyce" } },
            ],
            pageInfo: { hasNextPage: false, endCursor: "story-end" },
          },
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await fetchUpworkMessageSnapshot();

    expect(snapshot).toMatchObject({ ownerUserId: "owner-1", organizationId: "org-1" });
    expect(snapshot.rooms).toHaveLength(1);
    expect(snapshot.rooms[0]).toMatchObject({
      roomId: "room-1",
      roomName: "Ada Client",
      topic: "Website delivery",
      unreadCount: 2,
    });
    expect(snapshot.rooms[0].stories.map((story) => story.storyId)).toEqual(["story-1", "story-2"]);
    const firstRequest = fetchMock.mock.calls[0];
    expect((firstRequest[1] as RequestInit).headers).toMatchObject({
      authorization: "Bearer access-token",
      "X-Upwork-API-TenantId": "org-1",
    });
    const roomVariables = JSON.parse(String((firstRequest[1] as RequestInit).body)).variables;
    expect(roomVariables.filter).toEqual({
      subscribed_eq: true,
      includeUnreadIfActive_eq: true,
      includeHidden_eq: false,
    });
  });

  it("treats GraphQL errors returned with HTTP 200 as source failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ errors: [{ message: "Missing Messaging - Read-Only Access" }] })));
    await expect(fetchUpworkMessageSnapshot()).rejects.toThrow("Missing Messaging - Read-Only Access");
  });

  it("fails closed when no owner-approved OAuth connection exists", async () => {
    vi.mocked(getUpworkOauthConnection).mockResolvedValueOnce(null);
    await expect(fetchUpworkMessageSnapshot()).rejects.toThrow("not connected");
  });
});
