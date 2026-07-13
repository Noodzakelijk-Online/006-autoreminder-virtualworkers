import { getTrelloCommentToken } from "./db";
import { postCardComment } from "./trello";
import { queueCardReassessment } from "./aptlssReassessment";
import { broadcastTrelloInvalidate } from "./sse";

const JOYCE_MENTION = "@joyjemimajj1";
const SIGNATURE_PATTERN = /~\s*(?:joyce|angel)\s*$/i;
const SYSTEM_PREFIX = "[APTLSS System]";

function credentials() {
  const apiKey = process.env.TrelloAPIKey?.trim();
  const apiToken = process.env.TrelloAPIToken?.trim();
  if (!apiKey || !apiToken) throw new Error("Trello credentials not configured");
  return { apiKey, apiToken };
}

export function formatJoyceComment(text: string, mentionJoyce: boolean) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Trello comment cannot be empty");
  const attributed = mentionJoyce && !trimmed.toLowerCase().startsWith(JOYCE_MENTION)
    ? `${JOYCE_MENTION}\n\n${trimmed}`
    : trimmed;
  return SIGNATURE_PATTERN.test(attributed) ? attributed : `${attributed}\n\n~ Joyce`;
}

export function isAptlssSystemComment(text: string | null | undefined) {
  return typeof text === "string" && text.trimStart().startsWith(SYSTEM_PREFIX);
}

/** Post an approved communication as Joyce, using her token when configured. */
export async function postJoyceCardComment(cardId: string, text: string) {
  const { apiKey, apiToken } = credentials();
  const personalToken = await getTrelloCommentToken();
  const postingToken = personalToken?.trim() || apiToken;
  const comment = formatJoyceComment(text, postingToken === apiToken);
  const action = await postCardComment(cardId, comment, apiKey, postingToken);
  queueCardReassessment(cardId, "manual");
  broadcastTrelloInvalidate();
  return {
    ...action,
    attribution: postingToken === apiToken ? "board_owner_for_joyce" as const : "joyce_token" as const,
  };
}

/** Post an internal system note that must not be evaluated as a Joyce reply. */
export async function postSystemCardComment(cardId: string, text: string) {
  const { apiKey, apiToken } = credentials();
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Trello comment cannot be empty");
  const comment = trimmed.startsWith(SYSTEM_PREFIX) ? trimmed : `${SYSTEM_PREFIX}\n\n${trimmed}`;
  const action = await postCardComment(cardId, comment, apiKey, apiToken);
  queueCardReassessment(cardId, "manual");
  broadcastTrelloInvalidate();
  return action;
}
