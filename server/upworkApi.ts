import { UPWORK_GRAPHQL_URL, refreshUpworkAccessToken } from "./upworkOauth";
import { getUpworkOauthConnection } from "./upworkIntegrationSettings";

export interface UpworkStory {
  storyId: string;
  userId: string;
  userName: string;
  message: string;
  createdAt: number;
}

export interface UpworkRoom {
  roomId: string;
  roomName: string;
  topic: string;
  unreadCount: number;
  latestStory: UpworkStory | null;
  stories: UpworkStory[];
}

export interface UpworkMessageSnapshot {
  ownerUserId: string;
  organizationId: string | null;
  rooms: UpworkRoom[];
}

interface GraphqlError { message?: string }
interface PageInfo { endCursor?: string | null; hasNextPage?: boolean }

async function upworkGraphql<T>(input: {
  accessToken: string;
  organizationId: string | null;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<T> {
  const headers: Record<string, string> = {
    accept: "application/json",
    authorization: `Bearer ${input.accessToken}`,
    "content-type": "application/json",
  };
  if (input.organizationId) headers["X-Upwork-API-TenantId"] = input.organizationId;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(UPWORK_GRAPHQL_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: input.query, variables: input.variables ?? {} }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({})) as { data?: T; errors?: GraphqlError[] };
    if (!response.ok || payload.errors?.length || !payload.data) {
      const detail = payload.errors?.map((error) => error.message).filter(Boolean).join("; ") || `${response.status} ${response.statusText}`;
      throw new Error(`Upwork GraphQL request failed: ${detail}`);
    }
    return payload.data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Upwork GraphQL request timed out");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const ROOMS_QUERY = `
  query ReplyMonitorRooms($filter: RoomFilter, $pagination: Pagination, $sortOrder: SortOrder) {
    roomList(filter: $filter, pagination: $pagination, sortOrder: $sortOrder) {
      totalCount
      edges {
        node {
          id
          roomName
          topic
          numUnread
          latestStory { id createdDateTime updatedDateTime user { id name } message }
        }
      }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

const STORIES_QUERY = `
  query ReplyMonitorStories($filter: RoomStoryFilter) {
    roomStories(filter: $filter) {
      totalCount
      edges { node { id createdDateTime updatedDateTime user { id name } message } }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

type StoryNode = {
  id?: string;
  createdDateTime?: string;
  updatedDateTime?: string;
  user?: { id?: string; name?: string };
  message?: string | null;
};

type RoomNode = {
  id?: string;
  roomName?: string;
  topic?: string | null;
  numUnread?: number | null;
  latestStory?: StoryNode | null;
};

type RoomStoriesData = {
  roomStories: { edges?: Array<{ node?: StoryNode }>; pageInfo?: PageInfo };
};

type RoomListData = {
  roomList: { edges?: Array<{ node?: RoomNode }>; pageInfo?: PageInfo };
};

function normalizeStory(node: StoryNode | null | undefined): UpworkStory | null {
  if (!node?.id || !node.user?.id) return null;
  const createdAt = new Date(node.createdDateTime || node.updatedDateTime || "").getTime();
  if (!Number.isFinite(createdAt)) return null;
  return {
    storyId: String(node.id),
    userId: String(node.user.id),
    userName: node.user.name?.trim() || "Upwork user",
    message: node.message?.trim() || "",
    createdAt,
  };
}

async function fetchRoomStories(input: {
  accessToken: string;
  organizationId: string | null;
  roomId: string;
}): Promise<UpworkStory[]> {
  const stories: UpworkStory[] = [];
  let after: string | null = "0";
  for (let page = 0; page < 4; page++) {
    const data: RoomStoriesData = await upworkGraphql<RoomStoriesData>({
      accessToken: input.accessToken,
      organizationId: input.organizationId,
      query: STORIES_QUERY,
      variables: {
        filter: {
          roomId_eq: input.roomId,
          storyFilter: { pagination: { after, first: 50 } },
        },
      },
    });
    for (const edge of data.roomStories.edges ?? []) {
      const story = normalizeStory(edge.node);
      if (story?.message) stories.push(story);
    }
    const pageInfo: PageInfo | undefined = data.roomStories.pageInfo;
    if (!pageInfo?.hasNextPage || !pageInfo.endCursor) break;
    after = pageInfo.endCursor;
  }
  return Array.from(new Map(stories.map((story) => [story.storyId, story])).values())
    .sort((left, right) => left.createdAt - right.createdAt);
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return output;
}

export async function fetchUpworkMessageSnapshot(): Promise<UpworkMessageSnapshot> {
  const connection = await getUpworkOauthConnection();
  if (!connection) throw new Error("Upwork messages are not connected. Configure OAuth in Settings.");
  const { accessToken } = await refreshUpworkAccessToken();
  const roomNodes: RoomNode[] = [];
  let after: string | null = "0";
  for (let page = 0; page < 10; page++) {
    const data: RoomListData = await upworkGraphql<RoomListData>({
      accessToken,
      organizationId: connection.organizationId,
      query: ROOMS_QUERY,
      variables: {
        filter: {
          subscribed_eq: true,
          includeUnreadIfActive_eq: true,
          includeHidden_eq: false,
        },
        pagination: { after, first: 50 },
        sortOrder: "DESC",
      },
    });
    for (const edge of data.roomList.edges ?? []) if (edge.node?.id) roomNodes.push(edge.node);
    const pageInfo: PageInfo | undefined = data.roomList.pageInfo;
    if (!pageInfo?.hasNextPage || !pageInfo.endCursor) break;
    after = pageInfo.endCursor;
  }

  const uniqueRooms = Array.from(new Map(roomNodes.map((room) => [String(room.id), room])).values());
  const rooms = await mapWithConcurrency(uniqueRooms, 4, async (room): Promise<UpworkRoom> => {
    const roomId = String(room.id);
    const stories = await fetchRoomStories({ accessToken, organizationId: connection.organizationId, roomId });
    return {
      roomId,
      roomName: room.roomName?.trim() || room.topic?.trim() || "Upwork conversation",
      topic: room.topic?.trim() || "Direct Message",
      unreadCount: Math.max(0, Number(room.numUnread) || 0),
      latestStory: normalizeStory(room.latestStory),
      stories,
    };
  });
  return { ownerUserId: connection.userId, organizationId: connection.organizationId, rooms };
}
