import axios from "axios";

const TRELLO_API_BASE = "https://api.trello.com/1";
const JOYCE_MEMBER_ID = "joyjemimajj1";
// Board owner member ID — comments posted via the dashboard's inline comment box use this token
const BOARD_OWNER_MEMBER_ID = "noodzakelijkonline";

function logTrelloError(message: string, error: unknown) {
  if (axios.isAxiosError(error)) {
    let urlPath: string | undefined;
    try {
      const url = error.config?.url;
      urlPath = url ? sanitizeTrelloLogPath(new URL(url, TRELLO_API_BASE).pathname) : undefined;
    } catch {
      urlPath = undefined;
    }

    console.error(message, {
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      urlPath,
    });
    return;
  }

  console.error(message, error instanceof Error ? { message: error.message } : { message: String(error) });
}

function sanitizeTrelloLogPath(pathname: string) {
  return pathname.replace(/\/tokens\/[^/]+/g, "/tokens/:token");
}

// List names that are considered "done" — filter these out from Recent Updates
const DONE_LIST_NAMES = new Set(["done", "completed", "finished", "archived", "closed"]);

// List names that are considered "doing"
const DOING_LIST_NAMES = new Set(["doing", "in progress", "in-progress"]);

// List names that are considered "on-hold"
const ON_HOLD_LIST_NAMES = new Set(["on-hold", "on hold", "onhold"]);

// List names that are considered "to-do" / backlog
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

interface TrelloList {
  id: string;
  name: string;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc?: string;
  dateLastActivity: string;
  due: string | null;
  dueComplete?: boolean;
  url: string;
  shortUrl?: string;
  labels?: Array<{ id?: string; name?: string; color?: string }>;
  attachments?: Array<{ id?: string; name?: string; url?: string }>;
  idList: string;
  idBoard?: string;
  list?: TrelloList;
  boardName?: string;
}

// ── Server-side board/list cache (5-minute TTL) ───────────────────────────────
interface BoardListCacheEntry {
  lists: TrelloList[];
  boardName: string;
  expiresAt: number;
}
const boardListCache = new Map<string, BoardListCacheEntry>();
const BOARD_LIST_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type TrelloCacheStatus = { fetchedAt: string | null; stale: boolean; source: "live" | "cache" | "none" };
let cardCache: { cards: TrelloCard[]; expiresAt: number; staleUntil: number; fetchedAt: string } | null = null;
let cardRequest: Promise<TrelloCard[]> | null = null;
let cardCacheStatus: TrelloCacheStatus = { fetchedAt: null, stale: false, source: "none" };
let commentCache: { ids: Set<string>; expiresAt: number; staleUntil: number; fetchedAt: string } | null = null;
const CARD_CACHE_TTL_MS = 2 * 60 * 1000;
const CARD_CACHE_STALE_MS = 30 * 60 * 1000;

export function getTrelloCacheStatus(): TrelloCacheStatus {
  return { ...cardCacheStatus };
}

export function invalidateTrelloCardCache(): void {
  cardCache = null;
  cardRequest = null;
  cardCacheStatus = { fetchedAt: null, stale: false, source: "none" };
}

/** Exposed for testing only — clears the board list cache so tests start clean */
export function clearBoardListCache(): void {
  boardListCache.clear();
  invalidateTrelloCardCache();
  commentCache = null;
}

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

interface TrelloAction {
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

/**
 * Get all open cards assigned to Joyce, excluding cards in "done" lists.
 * The /members/{id}/cards endpoint does NOT embed the list object, so we
 * use the cached getBoardListsCached helper (5-min TTL) to fetch each
 * board's lists + name, build an idList → {list, boardName} map, and
 * attach both to every card.
 */
export async function getJoyceCards(apiKey: string, apiToken: string): Promise<TrelloCard[]> {
  if (cardCache && Date.now() < cardCache.expiresAt) {
    cardCacheStatus = { fetchedAt: cardCache.fetchedAt, stale: false, source: "cache" };
    return cardCache.cards;
  }
  if (cardRequest) return cardRequest;
  cardRequest = fetchJoyceCards(apiKey, apiToken);
  try {
    return await cardRequest;
  } finally {
    cardRequest = null;
  }
}

async function fetchJoyceCards(apiKey: string, apiToken: string): Promise<TrelloCard[]> {
  try {
    // Step 1: Fetch all open cards (includes idList and idBoard)
    const response = await axios.get(
      `${TRELLO_API_BASE}/members/${JOYCE_MEMBER_ID}/cards`,
      {
        params: {
          key: apiKey,
          token: apiToken,
          filter: "open",
          fields: "id,name,desc,dateLastActivity,due,dueComplete,url,shortUrl,idList,idBoard,closed",
          labels: "all",
          label_fields: "id,name,color",
          attachments: "true",
          attachment_fields: "id,name,url",
        },
      }
    );

    const rawCards: (TrelloCard & { idBoard?: string })[] = response.data;

    // Step 2: Collect unique board IDs
    const boardIds = Array.from(new Set(rawCards.map(c => c.idBoard).filter(Boolean))) as string[];

    // Step 3: Fetch all lists + board names via cache (one call per unique board)
    const boardData = await Promise.all(
      boardIds.map(boardId => getBoardListsCached(boardId, apiKey, apiToken))
    );

    // Step 4: Build idList → {list, boardName} map
    const listMap = new Map<string, { list: TrelloList; boardName: string }>();
    for (let i = 0; i < boardIds.length; i++) {
      const { lists, boardName } = boardData[i];
      for (const list of lists) {
        listMap.set(list.id, { list, boardName });
      }
    }

    // Step 5: Attach list object and boardName to each card
    const cards: TrelloCard[] = rawCards.map(card => {
      const entry = listMap.get(card.idList);
      return {
        ...card,
        list: entry?.list,
        boardName: entry?.boardName,
      };
    });

    // Step 6: Filter out cards that are in a "done" list
    const openCards = cards.filter(card => {
      if (card.list && isDoneList(card.list.name)) return false;
      return true;
    });
    const fetchedAt = new Date().toISOString();
    cardCache = { cards: openCards, expiresAt: Date.now() + CARD_CACHE_TTL_MS, staleUntil: Date.now() + CARD_CACHE_STALE_MS, fetchedAt };
    cardCacheStatus = { fetchedAt, stale: false, source: "live" };
    return openCards;
  } catch (error) {
    logTrelloError("[Trello] Failed to fetch Joyce's cards:", error);
    if (cardCache && Date.now() < cardCache.staleUntil) {
      cardCacheStatus = { fetchedAt: cardCache.fetchedAt, stale: true, source: "cache" };
      return cardCache.cards;
    }
    cardCacheStatus = { fetchedAt: cardCache?.fetchedAt ?? null, stale: true, source: "none" };
    throw new Error("Failed to fetch Trello cards");
  }
}

/**
 * Get all active cards assigned to Joyce that have no due date set.
 * Joyce must assign a due date to each of these today.
 */
export async function getCardsNeedingDueDate(apiKey: string, apiToken: string): Promise<TrelloCard[]> {
  const cards = await getJoyceCards(apiKey, apiToken);
  return cards.filter(card => card.due === null || card.due === undefined);
}

/**
 * Get all cards assigned to Joyce that are in the DOING list.
 * Joyce must post a daily update on each one before 23:00 Kenyan time.
 * Results are sorted by closest due date first (null due dates go last).
 */
export async function getCardsNeedingDailyUpdate(apiKey: string, apiToken: string): Promise<TrelloCard[]> {
  const cards = await getJoyceCards(apiKey, apiToken);
  const doingCards = cards.filter(card => card.list && isDoingList(card.list.name));

  // Sort by closest due date first; cards with no due date go to the end
  return doingCards.sort((a, b) => {
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return new Date(a.due).getTime() - new Date(b.due).getTime();
  });
}

/**
 * Get all cards assigned to Joyce that are in the ON-HOLD list.
 * Joyce must review these daily and move workable ones to DOING.
 */
export async function getOnHoldCards(apiKey: string, apiToken: string): Promise<TrelloCard[]> {
  const cards = await getJoyceCards(apiKey, apiToken);
  return cards.filter(card => card.list && isOnHoldList(card.list.name));
}

/**
 * Get recent activity on cards assigned to Joyce (excluding DONE list cards).
 *
 * Strategy:
 * 1. Fetch all open cards assigned to Joyce (already filters out DONE lists)
 * 2. Sort by dateLastActivity (most recently updated first)
 * 3. For the top 15 most recently active cards, fetch their actions in parallel
 * 4. Flatten, sort by date descending, return the most recent `limit` actions
 *
 * This shows ALL activity on Joyce's active cards (by anyone — employer, Joyce, etc.),
 * not just actions performed by Joyce herself.
 */
export async function getJoyceRecentActions(
  apiKey: string,
  apiToken: string,
  limit: number = 10
): Promise<TrelloAction[]> {
  try {
    // Step 1: Get all active (non-done) cards assigned to Joyce
    const cards = await getJoyceCards(apiKey, apiToken);

    if (cards.length === 0) {
      return [];
    }

    // Step 2: Sort by most recently active and take top 15 to query
    const sortedCards = [...cards]
      .sort((a, b) => new Date(b.dateLastActivity).getTime() - new Date(a.dateLastActivity).getTime())
      .slice(0, 15);

    // Step 3: Fetch actions for each card in parallel
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

    // Step 4: Flatten, sort by date descending, return top `limit`
    const allActions = allActionArrays
      .flat()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);

    return allActions;
  } catch (error) {
    logTrelloError("[Trello] Failed to fetch Joyce's recent actions:", error);
    throw new Error("Failed to fetch Trello actions");
  }
}

/**
 * Get the set of card IDs where Joyce herself posted a comment today (Kenyan time, EAT = UTC+3).
 * Used to auto-resolve Alert 2: a DOING card is "updated" when Joyce comments on it today.
 */
export async function getJoyceCommentedCardIdsToday(
  apiKey: string,
  apiToken: string,
  joycePersonalToken?: string | null
): Promise<Set<string>> {
  if (commentCache && Date.now() < commentCache.expiresAt) return new Set(commentCache.ids);
  try {
    // Determine today's date in Kenyan time (EAT = UTC+3)
    const nowUtcMs = Date.now();
    const eatOffsetMs = 3 * 60 * 60 * 1000;
    const todayEAT = new Date(nowUtcMs + eatOffsetMs).toISOString().slice(0, 10); // "YYYY-MM-DD"

    const isToday = (dateStr: string) => {
      const actionDateEAT = new Date(new Date(dateStr).getTime() + eatOffsetMs)
        .toISOString()
        .slice(0, 10);
      return actionDateEAT === todayEAT;
    };

    // Build parallel requests:
    // 1. Joyce's actions via board owner token (always — covers comments she made directly)
    // 2. Board owner's actions (always — covers inline dashboard comments posted as board owner)
    // 3. Joyce's actions via her personal token (when set — most accurate, covers all her direct comments)
    const requests: Promise<any>[] = [
      axios.get(`${TRELLO_API_BASE}/members/${JOYCE_MEMBER_ID}/actions`, {
        params: { key: apiKey, token: apiToken, filter: "commentCard", limit: 100 },
      }),
      axios.get(`${TRELLO_API_BASE}/members/${BOARD_OWNER_MEMBER_ID}/actions`, {
        params: { key: apiKey, token: apiToken, filter: "commentCard", limit: 100 },
      }),
    ];

    if (joycePersonalToken) {
      // Fetch Joyce's actions using her own token — this is the most reliable source
      // and will catch comments she made on any board she has access to
      requests.push(
        axios.get(`${TRELLO_API_BASE}/members/me/actions`, {
          params: { key: apiKey, token: joycePersonalToken, filter: "commentCard", limit: 100 },
        })
      );
    }

    const [joyceResp, ownerResp, joycePersonalResp] = await Promise.all(requests);

    const commentedCardIds = new Set<string>();

    // Count all of Joyce's own comments today (via board owner token)
    for (const action of joyceResp.data as TrelloAction[]) {
      if (isToday(action.date) && action.data.card?.id) {
        commentedCardIds.add(action.data.card.id);
      }
    }

    // Count board-owner comments today that mention @joyjemimajj1
    // (these are comments posted via the dashboard's inline quick-comment box
    //  when Joyce's personal Trello token is not configured in Settings)
    for (const action of ownerResp.data as TrelloAction[]) {
      if (
        isToday(action.date) &&
        action.data.card?.id &&
        typeof action.data.text === "string" &&
        action.data.text.toLowerCase().includes("@joyjemimajj1")
      ) {
        commentedCardIds.add(action.data.card.id);
      }
    }

    // Count Joyce's comments via her personal token (most accurate — catches all her direct comments)
    if (joycePersonalResp) {
      for (const action of joycePersonalResp.data as TrelloAction[]) {
        if (isToday(action.date) && action.data.card?.id) {
          commentedCardIds.add(action.data.card.id);
        }
      }
    }

    const fetchedAt = new Date().toISOString();
    commentCache = {
      ids: new Set(commentedCardIds),
      expiresAt: Date.now() + CARD_CACHE_TTL_MS,
      staleUntil: Date.now() + CARD_CACHE_STALE_MS,
      fetchedAt,
    };
    return commentedCardIds;
  } catch (error) {
    logTrelloError("[Trello] Failed to fetch Joyce's comment actions:", error);
    if (commentCache && Date.now() < commentCache.staleUntil) return new Set(commentCache.ids);
    return new Set(); // Graceful degradation — show all cards as needing update
  }
}

export interface TrelloBoard {
  id: string;
  name: string;
}

/**
 * Get all open boards Joyce is a member of.
 * Used to map idModel (board ID) → board name in the webhook health panel.
 */
export async function getJoyceBoards(apiKey: string, apiToken: string): Promise<TrelloBoard[]> {
  try {
    const res = await axios.get<TrelloBoard[]>(
      `${TRELLO_API_BASE}/members/me/boards`,
      {
        params: {
          key: apiKey,
          token: apiToken,
          filter: "open",
          fields: "id,name",
        },
      }
    );
    return res.data;
  } catch (error) {
    logTrelloError("[Trello] Failed to fetch Joyce's boards:", error);
    return [];
  }
}

/**
 * Get all Trello webhooks registered for the current token.
 * Used by the webhook health check panel on the dashboard.
 */
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
    logTrelloError("[Trello] Failed to fetch registered webhooks:", error);
    return [];
  }
}

/**
 * Post a comment on a Trello card.
 * @returns The created action object from Trello.
 */
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

export type MoveCardResult = {
  moved: boolean;
  previousListId: string;
  targetListId: string;
  targetListName: string;
};

/** Move a card to the board's canonical DOING/In Progress list. */
export async function moveCardToDoing(
  cardId: string,
  apiKey: string,
  apiToken: string,
): Promise<MoveCardResult> {
  const cardResponse = await axios.get<{ idBoard: string; idList: string }>(
    `${TRELLO_API_BASE}/cards/${cardId}`,
    {
      params: { key: apiKey, token: apiToken, fields: "idBoard,idList" },
    },
  );
  const { idBoard, idList: previousListId } = cardResponse.data;
  if (!idBoard) throw new Error("Trello card does not identify its board");

  const { lists } = await getBoardListsCached(idBoard, apiKey, apiToken);
  const doingLists = lists.filter((list) => isDoingList(list.name));
  if (doingLists.length === 0) {
    throw new Error("This board has no open DOING or In Progress list");
  }

  const target = doingLists.find((list) => list.name.trim().toLowerCase() === "doing") ?? doingLists[0];
  if (target.id === previousListId) {
    return {
      moved: false,
      previousListId,
      targetListId: target.id,
      targetListName: target.name,
    };
  }

  await axios.put(
    `${TRELLO_API_BASE}/cards/${cardId}`,
    null,
    { params: { key: apiKey, token: apiToken, idList: target.id } },
  );
  cardCache = null;
  cardCacheStatus = { fetchedAt: null, stale: false, source: "none" };

  return {
    moved: true,
    previousListId,
    targetListId: target.id,
    targetListName: target.name,
  };
}
