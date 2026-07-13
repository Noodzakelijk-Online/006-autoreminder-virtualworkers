import axios from "axios";

const TRELLO_API_BASE = "https://api.trello.com/1";

// List names filters
const DONE_LIST_NAMES = new Set(["done", "completed", "finished", "archived", "closed"]);
const DOING_LIST_NAMES = new Set(["doing", "in progress", "in-progress"]);
const ON_HOLD_LIST_NAMES = new Set(["on-hold", "on hold", "onhold"]);
const TODO_LIST_NAMES = new Set(["to do", "todo", "to-do", "backlog", "inbox", "new", "queue"]);

function isDoneList(listName: string): boolean {
  return DONE_LIST_NAMES.has(listName.trim().toLowerCase());
}

export function isDoingList(listName: string): boolean {
  return DOING_LIST_NAMES.has(listName.trim().toLowerCase());
}

export function isOnHoldList(listName: string): boolean {
  return ON_HOLD_LIST_NAMES.has(listName.trim().toLowerCase());
}

export function getListCategory(listName: string): "on-hold" | "doing" | "todo" | "other" {
  const n = listName.trim().toLowerCase();
  if (ON_HOLD_LIST_NAMES.has(n)) return "on-hold";
  if (DOING_LIST_NAMES.has(n)) return "doing";
  if (TODO_LIST_NAMES.has(n)) return "todo";
  return "other";
}

export interface TrelloList {
  id: string;
  name: string;
}

export interface TrelloCard {
  id: string;
  name: string;
  dateLastActivity: string;
  due: string | null;
  url: string;
  idList: string;
  idBoard?: string;
  list?: TrelloList;
  boardName?: string;
}

export interface TrelloAction {
  id: string;
  type: string;
  date: string;
  data: {
    card?: {
      id: string;
      name: string;
    };
    text?: string;
    listBefore?: { name: string };
    listAfter?: { name: string };
    old?: { due?: string; name?: string; desc?: string };
  };
  memberCreator: {
    id: string;
    fullName: string;
    username: string;
  };
}

interface BoardListCacheEntry {
  lists: TrelloList[];
  boardName: string;
  expiresAt: number;
}
const boardListCache = new Map<string, BoardListCacheEntry>();
const BOARD_LIST_CACHE_TTL_MS = 5 * 60 * 1000;

async function getBoardListsCached(
  boardId: string,
  apiKey: string,
  apiToken: string
): Promise<{ lists: TrelloList[]; boardName: string }> {
  const cached = boardListCache.get(boardId);
  if (cached && Date.now() < cached.expiresAt) {
    return { lists: cached.lists, boardName: cached.boardName };
  }
  try {
    const [listsRes, boardRes] = await Promise.all([
      axios.get<TrelloList[]>(`${TRELLO_API_BASE}/boards/${boardId}/lists`, {
        params: { key: apiKey, token: apiToken, filter: "open", fields: "id,name" },
      }),
      axios.get<{ id: string; name: string }>(`${TRELLO_API_BASE}/boards/${boardId}`, {
        params: { key: apiKey, token: apiToken, fields: "id,name" },
      }),
    ]);
    const entry: BoardListCacheEntry = {
      lists: listsRes.data,
      boardName: boardRes.data.name,
      expiresAt: Date.now() + BOARD_LIST_CACHE_TTL_MS,
    };
    boardListCache.set(boardId, entry);
    return { lists: entry.lists, boardName: entry.boardName };
  } catch {
    return { lists: [], boardName: "Unknown Board" };
  }
}

/**
 * Get worker's open cards assigned, excluding DONE lists
 */
export async function getWorkerCards(apiKey: string, apiToken: string, trelloMemberId: string): Promise<TrelloCard[]> {
  try {
    const response = await axios.get(
      `${TRELLO_API_BASE}/members/${trelloMemberId}/cards`,
      {
        params: {
          key: apiKey,
          token: apiToken,
          filter: "open",
          fields: "id,name,dateLastActivity,due,url,idList,idBoard",
        },
      }
    );

    const rawCards: (TrelloCard & { idBoard?: string })[] = response.data;
    const boardIds = Array.from(new Set(rawCards.map(c => c.idBoard).filter(Boolean))) as string[];
    const boardData = await Promise.all(
      boardIds.map(boardId => getBoardListsCached(boardId, apiKey, apiToken))
    );

    const listMap = new Map<string, { list: TrelloList; boardName: string }>();
    for (let i = 0; i < boardIds.length; i++) {
      const { lists, boardName } = boardData[i];
      for (const list of lists) {
        listMap.set(list.id, { list, boardName });
      }
    }

    const cards: TrelloCard[] = rawCards.map(card => {
      const entry = listMap.get(card.idList);
      return {
        ...card,
        list: entry?.list,
        boardName: entry?.boardName,
      };
    });

    return cards.filter(card => {
      if (card.list && isDoneList(card.list.name)) return false;
      return true;
    });
  } catch (error) {
    console.error(`[Trello] Failed to fetch worker cards for ${trelloMemberId}:`, error);
    throw new Error("Failed to fetch Trello cards");
  }
}

export async function getCardsNeedingDueDate(apiKey: string, apiToken: string, trelloMemberId: string): Promise<TrelloCard[]> {
  const cards = await getWorkerCards(apiKey, apiToken, trelloMemberId);
  return cards.filter(card => card.due === null || card.due === undefined);
}

export async function getCardsNeedingDailyUpdate(apiKey: string, apiToken: string, trelloMemberId: string): Promise<TrelloCard[]> {
  const cards = await getWorkerCards(apiKey, apiToken, trelloMemberId);
  const doingCards = cards.filter(card => card.list && isDoingList(card.list.name));

  return doingCards.sort((a, b) => {
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return new Date(a.due).getTime() - new Date(b.due).getTime();
  });
}

export async function getOnHoldCards(apiKey: string, apiToken: string, trelloMemberId: string): Promise<TrelloCard[]> {
  const cards = await getWorkerCards(apiKey, apiToken, trelloMemberId);
  return cards.filter(card => card.list && isOnHoldList(card.list.name));
}

export async function getWorkerRecentActions(
  apiKey: string,
  apiToken: string,
  trelloMemberId: string,
  limit: number = 10
): Promise<TrelloAction[]> {
  try {
    const cards = await getWorkerCards(apiKey, apiToken, trelloMemberId);
    if (cards.length === 0) return [];

    const sortedCards = [...cards]
      .sort((a, b) => new Date(b.dateLastActivity).getTime() - new Date(a.dateLastActivity).getTime())
      .slice(0, 15);

    const actionRequests = sortedCards.map(card =>
      axios.get(`${TRELLO_API_BASE}/cards/${card.id}/actions`, {
        params: {
          key: apiKey,
          token: apiToken,
          filter: "commentCard,updateCard,createCard,addMemberToCard,removeMemberFromCard,updateCheckItemStateOnCard",
          limit: 5,
        },
      }).then(res => res.data as TrelloAction[]).catch(() => [] as TrelloAction[])
    );

    const allActionArrays = await Promise.all(actionRequests);
    const allActions = allActionArrays
      .flat()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);

    return allActions;
  } catch (error) {
    console.error("[Trello] Failed to fetch worker actions:", error);
    throw new Error("Failed to fetch Trello actions");
  }
}

export async function getWorkerCommentedCardIdsToday(
  apiKey: string,
  apiToken: string,
  trelloMemberId: string,
  boardOwnerMemberId?: string,
  personalToken?: string | null
): Promise<Set<string>> {
  try {
    const nowUtcMs = Date.now();
    const eatOffsetMs = 3 * 60 * 60 * 1000;
    const todayEAT = new Date(nowUtcMs + eatOffsetMs).toISOString().slice(0, 10);

    const isToday = (dateStr: string) => {
      const actionDateEAT = new Date(new Date(dateStr).getTime() + eatOffsetMs)
        .toISOString()
        .slice(0, 10);
      return actionDateEAT === todayEAT;
    };

    const requests: Promise<any>[] = [
      axios.get(`${TRELLO_API_BASE}/members/${trelloMemberId}/actions`, {
        params: { key: apiKey, token: apiToken, filter: "commentCard", limit: 100 },
      }),
    ];

    if (boardOwnerMemberId) {
      requests.push(
        axios.get(`${TRELLO_API_BASE}/members/${boardOwnerMemberId}/actions`, {
          params: { key: apiKey, token: apiToken, filter: "commentCard", limit: 100 },
        })
      );
    }

    if (personalToken) {
      requests.push(
        axios.get(`${TRELLO_API_BASE}/members/me/actions`, {
          params: { key: apiKey, token: personalToken, filter: "commentCard", limit: 100 },
        })
      );
    }

    const responses = await Promise.all(requests);
    const commentedCardIds = new Set<string>();

    // Worker comments
    const workerActions = responses[0].data as TrelloAction[];
    for (const action of workerActions) {
      if (isToday(action.date) && action.data.card?.id) {
        commentedCardIds.add(action.data.card.id);
      }
    }

    // Owner comments mentioning worker
    if (boardOwnerMemberId && responses[1]) {
      const ownerActions = responses[1].data as TrelloAction[];
      for (const action of ownerActions) {
        if (
          isToday(action.date) &&
          action.data.card?.id &&
          typeof action.data.text === "string" &&
          action.data.text.toLowerCase().includes(`@${trelloMemberId.toLowerCase()}`)
        ) {
          commentedCardIds.add(action.data.card.id);
        }
      }
    }

    // Personal token comments
    const personalResp = personalToken ? (boardOwnerMemberId ? responses[2] : responses[1]) : null;
    if (personalResp) {
      const personalActions = personalResp.data as TrelloAction[];
      for (const action of personalActions) {
        if (isToday(action.date) && action.data.card?.id) {
          commentedCardIds.add(action.data.card.id);
        }
      }
    }

    return commentedCardIds;
  } catch (error) {
    console.error("[Trello] Failed to fetch commented cards:", error);
    return new Set();
  }
}

export async function getCardsDueToday(apiKey: string, apiToken: string, trelloMemberId: string): Promise<TrelloCard[]> {
  try {
    const allCards = await getWorkerCards(apiKey, apiToken, trelloMemberId);
    const eatOffsetMs = 3 * 60 * 60 * 1000;
    const todayEAT = new Date(Date.now() + eatOffsetMs).toISOString().slice(0, 10);
    return allCards.filter(card => {
      if (!card.due) return false;
      const dueDateEAT = new Date(new Date(card.due).getTime() + eatOffsetMs)
        .toISOString()
        .slice(0, 10);
      return dueDateEAT === todayEAT;
    });
  } catch (error) {
    console.error("[Trello] Failed to fetch cards due today:", error);
    return [];
  }
}

export async function getOverdueCards(apiKey: string, apiToken: string, trelloMemberId: string): Promise<TrelloCard[]> {
  try {
    const allCards = await getWorkerCards(apiKey, apiToken, trelloMemberId);
    const now = Date.now();
    return allCards.filter(card => {
      if (!card.due) return false;
      return new Date(card.due).getTime() < now;
    });
  } catch (error) {
    console.error("[Trello] Failed to fetch overdue cards:", error);
    return [];
  }
}

export interface TrelloBoard {
  id: string;
  name: string;
}

export async function getWorkerBoards(apiKey: string, apiToken: string): Promise<TrelloBoard[]> {
  try {
    const res = await axios.get<TrelloBoard[]>(
      `${TRELLO_API_BASE}/members/me/boards`,
      {
        params: { key: apiKey, token: apiToken, filter: "open", fields: "id,name" },
      }
    );
    return res.data;
  } catch (error) {
    console.error("[Trello] Failed to fetch boards:", error);
    return [];
  }
}

export async function getWeeklyHours(apiKey: string, apiToken: string, trelloMemberId?: string): Promise<{
  totalHours: number;
  targetMin: number;
  targetMax: number;
  weekStart: string;
  weekEnd: string;
}> {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)

  return {
    totalHours: 0, // Placeholder
    targetMin: 50,
    targetMax: 55,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
  };
}



export interface TrelloWebhook {
  id: string;
  description: string;
  idModel: string;
  callbackURL: string;
  active: boolean;
  consecutiveFailures: number;
  firstConsecutiveFailDate: string | null;
}

export async function getRegisteredWebhooks(apiKey: string, apiToken: string): Promise<TrelloWebhook[]> {
  try {
    const response = await axios.get(
      `${TRELLO_API_BASE}/tokens/${apiToken}/webhooks`,
      {
        params: { key: apiKey, token: apiToken },
      }
    );
    return response.data as TrelloWebhook[];
  } catch (error) {
    console.error("[Trello] Failed to fetch registered webhooks:", error);
    return [];
  }
}

export async function postCardComment(
  cardId: string,
  text: string,
  apiKey: string,
  apiToken: string
): Promise<{ id: string; date: string }> {
  const response = await axios.post(
    `${TRELLO_API_BASE}/cards/${cardId}/actions/comments`,
    null,
    {
      params: { key: apiKey, token: apiToken, text },
    }
  );
  return { id: response.data.id, date: response.data.date };
}
