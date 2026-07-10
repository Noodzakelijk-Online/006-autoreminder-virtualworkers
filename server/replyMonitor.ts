/**
 * Reply Monitor — Trello card comment thread tracking.
 *
 * Scans all active Trello cards assigned to Joyce and:
 *  1. Detects threads where someone else commented last and Joyce has not replied within 12h.
 *  2. Detects vague/deferral replies from Joyce (e.g. "I'll get back to you tonight").
 *
 * Called by the 15-minute cron job. Results are persisted to:
 *  - reply_threads  — one row per card, tracks last non-Joyce comment and Joyce's last reply
 *  - vague_reply_flags — one row per vague reply action ID (deduped by actionId)
 */

import axios from "axios";

const TRELLO_API_BASE = "https://api.trello.com/1";

// Joyce's Trello member identifiers
const JOYCE_MEMBER_IDS = new Set([
  "joyjemimajj1",
  "664ed797b37eb4605ed64bc1",
]);

// Board owner — comments posted via the dashboard's inline comment box
const BOARD_OWNER_MEMBER_ID = "noodzakelijkonline";

// Valid signatures that must appear at the end of every owner message
const VALID_SIGNATURES = ["~ angel", "~ joyce"];

/**
 * Check whether a message text ends with a valid signature.
 * Accepts: "~ Angel", "~ Joyce" (case-insensitive), possibly followed by whitespace.
 */
export function hasValidSignature(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return VALID_SIGNATURES.some(sig => lower.endsWith(sig));
}

/**
 * Determine if a comment is an "owner" comment — i.e., posted by the board owner
 * or Joyce (both are considered owner-account messages that require a signature).
 */
export function isOwnerComment(action: TrelloCommentAction): boolean {
  const username = action.memberCreator?.username?.toLowerCase() ?? "";
  const id = action.memberCreator?.id ?? "";
  return (
    JOYCE_MEMBER_IDS.has(username) ||
    JOYCE_MEMBER_IDS.has(id) ||
    username === BOARD_OWNER_MEMBER_ID
  );
}

// 12-hour reply deadline in milliseconds
export const REPLY_DEADLINE_MS = 12 * 60 * 60 * 1000;

// 1-hour vague-reply correction window in milliseconds
export const VAGUE_CORRECTION_WINDOW_MS = 60 * 60 * 1000;

/**
 * Vague/deferral patterns — case-insensitive.
 * A reply is vague if it matches any of these patterns without substantive content.
 * The check is: does the message ONLY contain a deferral without any actual information?
 */
const VAGUE_PATTERNS: RegExp[] = [
  /i('ll|'ll| will| am going to| can) (get|come) back to you/i,
  /will (get|come) back to you/i,
  /i('ll|'ll| will) (respond|reply|update|follow up|check|look into|look at|get to) (you |this |it |on this )?(today|tonight|tomorrow|later|soon|shortly|asap|in a (bit|moment|while|few))/i,
  /will (respond|reply|update|follow up|check|look into) (today|tonight|tomorrow|later|soon|shortly|asap)/i,
  /let me (check|look into|look at|get back to you|follow up|come back to you)/i,
  /i('ll|'ll| will) (check|look into|look at|follow up|come back)/i,
  /give me (a moment|a bit|some time|until tonight|until today|until tomorrow)/i,
  /i need (to check|to look|more time|a moment)/i,
  /\btonight\b|\btoday\b|\btomorrow\b/i,  // standalone time words in short messages
];

/**
 * Determine if a comment text is a vague/deferral reply.
 * Short messages (< 120 chars) containing deferral patterns are flagged.
 * Longer substantive messages are NOT flagged even if they contain "tonight".
 */
export function isVagueReply(text: string): boolean {
  const trimmed = text.trim();
  // Very short messages (< 120 chars) — apply all patterns
  if (trimmed.length < 120) {
    for (const pattern of VAGUE_PATTERNS) {
      if (pattern.test(trimmed)) return true;
    }
  } else {
    // Longer messages — only flag if they match the strong deferral patterns
    // (not the standalone "tonight"/"today" which could appear in substantive messages)
    const strongPatterns = VAGUE_PATTERNS.slice(0, -1); // exclude the last standalone-word pattern
    for (const pattern of strongPatterns) {
      if (pattern.test(trimmed)) return true;
    }
  }
  return false;
}

/**
 * Determine if a comment was made by Joyce (either via her own token or the board owner token
 * with her @mention, which is how the dashboard inline comment box works).
 */
export function isJoyceComment(action: TrelloCommentAction): boolean {
  const username = action.memberCreator?.username?.toLowerCase() ?? "";
  const id = action.memberCreator?.id ?? "";
  // Direct Joyce comment
  if (JOYCE_MEMBER_IDS.has(username) || JOYCE_MEMBER_IDS.has(id)) return true;
  // Board-owner comment that starts with "@joyjemimajj1" — posted via dashboard inline box
  if (
    username === BOARD_OWNER_MEMBER_ID &&
    typeof action.data?.text === "string" &&
    action.data.text.toLowerCase().trimStart().startsWith("@joyjemimajj1")
  ) {
    return true;
  }
  return false;
}

export interface TrelloCommentAction {
  id: string;
  type: string;
  date: string;
  data: {
    card?: { id: string; name: string };
    text?: string;
  };
  memberCreator: {
    id: string;
    fullName: string;
    username: string;
  };
}

export interface CardThreadState {
  cardId: string;
  cardName: string;
  cardUrl: string;
  boardName: string;
  listName: string;
  /** Most recent comment NOT from Joyce */
  lastNonJoyceMsgAt: Date | null;
  lastNonJoyceAuthor: string;
  lastNonJoyceText: string;
  /** Most recent comment FROM Joyce */
  lastJoyceReplyAt: Date | null;
  /** Whether Joyce still needs to reply (last comment is not from Joyce) */
  needsReply: boolean;
  /** How many ms have elapsed since the non-Joyce comment (null if no non-Joyce comment) */
  elapsedMs: number | null;
  /** Whether the 12h deadline has been exceeded */
  isOverdue: boolean;
  /** Vague replies from Joyce detected in this card's comments */
  vagueReplies: Array<{
    actionId: string;
    text: string;
    date: Date;
  }>;
  /** Unsigned owner messages detected in this card's comments */
  unsignedMessages: Array<{
    actionId: string;
    text: string;
    date: Date;
  }>;
}

interface TrelloCard {
  id: string;
  name: string;
  url: string;
  idList: string;
  idBoard?: string;
  list?: { id: string; name: string };
  boardName?: string;
  dateLastActivity: string;
}

/**
 * Fetch the last N comments on a Trello card.
 */
async function getCardComments(
  cardId: string,
  apiKey: string,
  apiToken: string,
  limit = 50
): Promise<TrelloCommentAction[]> {
  try {
    const response = await axios.get(
      `${TRELLO_API_BASE}/cards/${cardId}/actions`,
      {
        params: {
          key: apiKey,
          token: apiToken,
          filter: "commentCard",
          limit,
        },
      }
    );
    return response.data as TrelloCommentAction[];
  } catch {
    return [];
  }
}

/**
 * Analyse a card's comment thread and return its reply state.
 */
export function analyseCardThread(
  card: TrelloCard,
  comments: TrelloCommentAction[]
): CardThreadState {
  const now = Date.now();

  // Sort comments oldest → newest
  const sorted = [...comments].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let lastNonJoyceMsgAt: Date | null = null;
  let lastNonJoyceAuthor = "";
  let lastNonJoyceText = "";
  let lastJoyceReplyAt: Date | null = null;
  const vagueReplies: CardThreadState["vagueReplies"] = [];
  const unsignedMessages: CardThreadState["unsignedMessages"] = [];

  for (const action of sorted) {
    const text = action.data?.text ?? "";
    const date = new Date(action.date);

    if (isJoyceComment(action)) {
      lastJoyceReplyAt = date;
      // Check for vague reply
      if (isVagueReply(text)) {
        vagueReplies.push({ actionId: action.id, text, date });
      }
      // Check for missing signature
      if (!hasValidSignature(text)) {
        unsignedMessages.push({ actionId: action.id, text, date });
      }
    } else if (isOwnerComment(action)) {
      // Board-owner comment (not Joyce) — also requires signature
      if (!hasValidSignature(text)) {
        unsignedMessages.push({ actionId: action.id, text, date });
      }
      // Still counts as non-Joyce for reply tracking
      lastNonJoyceMsgAt = date;
      lastNonJoyceAuthor = action.memberCreator?.fullName || action.memberCreator?.username || "Unknown";
      lastNonJoyceText = text.length > 200 ? text.slice(0, 200) + "…" : text;
    } else {
      // Someone else commented
      lastNonJoyceMsgAt = date;
      lastNonJoyceAuthor = action.memberCreator?.fullName || action.memberCreator?.username || "Unknown";
      lastNonJoyceText = text.length > 200 ? text.slice(0, 200) + "…" : text;
    }
  }

  // Joyce needs to reply if:
  // - There is at least one non-Joyce comment
  // - AND Joyce has never replied, OR the last non-Joyce comment is AFTER Joyce's last reply
  const needsReply =
    lastNonJoyceMsgAt !== null &&
    (lastJoyceReplyAt === null || lastNonJoyceMsgAt > lastJoyceReplyAt);

  const elapsedMs = needsReply && lastNonJoyceMsgAt
    ? now - lastNonJoyceMsgAt.getTime()
    : null;

  const isOverdue = elapsedMs !== null && elapsedMs > REPLY_DEADLINE_MS;

  return {
    cardId: card.id,
    cardName: card.name,
    cardUrl: card.url,
    boardName: card.boardName ?? "",
    listName: card.list?.name ?? "",
    lastNonJoyceMsgAt,
    lastNonJoyceAuthor,
    lastNonJoyceText,
    lastJoyceReplyAt,
    needsReply,
    elapsedMs,
    isOverdue,
    vagueReplies,
    unsignedMessages,
  };
}

/**
 * Scan all active Trello cards assigned to Joyce and return thread states.
 * Cards with no comments at all are skipped.
 * Cards in DONE lists are skipped.
 *
 * To avoid hammering the Trello API, we only scan cards that have had
 * activity in the last 7 days (dateLastActivity).
 */
export async function scanTrelloReplyThreads(
  apiKey: string,
  apiToken: string,
  joycePersonalToken?: string | null
): Promise<CardThreadState[]> {
  // Fetch all active cards assigned to Joyce (reuse existing helper via direct API call)
  const cardsResp = await axios.get(`${TRELLO_API_BASE}/members/joyjemimajj1/cards`, {
    params: {
      key: apiKey,
      token: apiToken,
      filter: "open",
      fields: "id,name,dateLastActivity,due,url,idList,idBoard",
    },
  });
  const rawCards: TrelloCard[] = cardsResp.data;

  // Resolve board/list names using the Trello boards API
  const boardIds = Array.from(new Set(rawCards.map(c => c.idBoard).filter(Boolean))) as string[];
  const boardDataMap = new Map<string, { lists: Array<{ id: string; name: string }>; boardName: string }>();

  await Promise.all(
    boardIds.map(async boardId => {
      try {
        const [listsResp, boardResp] = await Promise.all([
          axios.get(`${TRELLO_API_BASE}/boards/${boardId}/lists`, {
            params: { key: apiKey, token: apiToken, fields: "id,name" },
          }),
          axios.get(`${TRELLO_API_BASE}/boards/${boardId}`, {
            params: { key: apiKey, token: apiToken, fields: "id,name" },
          }),
        ]);
        boardDataMap.set(boardId, {
          lists: listsResp.data,
          boardName: boardResp.data.name,
        });
      } catch {
        boardDataMap.set(boardId, { lists: [], boardName: "Unknown Board" });
      }
    })
  );

  // Attach list and board names to cards
  const cards: TrelloCard[] = rawCards.map(card => {
    const boardData = card.idBoard ? boardDataMap.get(card.idBoard) : undefined;
    const list = boardData?.lists.find(l => l.id === card.idList);
    return { ...card, list, boardName: boardData?.boardName };
  });

  // Filter out DONE cards and cards with no recent activity (>7 days)
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const DONE_NAMES = new Set(["done", "completed", "finished", "archived", "closed"]);
  const activeCards = cards.filter(card => {
    if (card.list && DONE_NAMES.has(card.list.name.trim().toLowerCase())) return false;
    if (new Date(card.dateLastActivity).getTime() < sevenDaysAgo) return false;
    return true;
  });

  if (activeCards.length === 0) return [];

  // Fetch comments for each active card in parallel (batched to avoid rate limits)
  const BATCH_SIZE = 10;
  const results: CardThreadState[] = [];

  for (let i = 0; i < activeCards.length; i += BATCH_SIZE) {
    const batch = activeCards.slice(i, i + BATCH_SIZE);
    const commentBatches = await Promise.all(
      batch.map(card => getCardComments(card.id, apiKey, joycePersonalToken ?? apiToken))
    );
    for (let j = 0; j < batch.length; j++) {
      const comments = commentBatches[j];
      if (comments.length === 0) continue; // No comments — skip
      const state = analyseCardThread(batch[j], comments);
      // Only include cards that have a non-Joyce comment (i.e., someone replied)
      if (state.lastNonJoyceMsgAt !== null) {
        results.push(state);
      }
    }
    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < activeCards.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return results;
}
