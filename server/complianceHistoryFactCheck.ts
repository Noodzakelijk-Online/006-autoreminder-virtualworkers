import axios from "axios";
import {
  addDaysToDateKey,
  assertDateKey,
  dateKeyInEat,
  differenceInDateKeys,
  eatDateRangeUtc,
  timeKeyInEat,
} from "../shared/eatTime";
import {
  getComplianceHistory,
  getOnHoldChecksBetween,
  upsertVerifiedComplianceSnapshot,
  type ComplianceCardEvidenceInput,
  type ComplianceSnapshotInput,
} from "./db";
import { getListCategory } from "./trello";

const TRELLO_API_BASE = "https://api.trello.com/1";
const JOYCE_USERNAME = "joyjemimajj1";
const OWNER_USERNAME = "noodzakelijkonline";
const METHOD_VERSION = "trello-action-replay-v1";
const MAX_BACKFILL_DAYS = 366;

type TrelloMember = { id: string; username: string; fullName: string };
type TrelloBoard = { id: string; name: string; closed?: boolean };
type TrelloList = { id: string; name: string };

export type HistoricalTrelloAction = {
  id: string;
  type: string;
  date: string;
  data: {
    idMember?: string;
    text?: string;
    card?: { id: string; name?: string };
    member?: { id: string; name?: string };
    listBefore?: { id?: string; name: string };
    listAfter?: { id?: string; name: string };
    old?: { closed?: boolean };
  };
  memberCreator?: Partial<TrelloMember>;
};

export type HistoricalTrelloCard = {
  id: string;
  name: string;
  url: string;
  idMembers: string[];
  idList: string;
  idBoard: string;
  closed: boolean;
  listName: string;
  boardName: string;
  actions: HistoricalTrelloAction[];
};

export type HistoricalCardState = {
  exists: boolean;
  assignedToJoyce: boolean;
  closed: boolean;
  listName: string;
};

export type ComplianceFactCheckDay = {
  snapshot: ComplianceSnapshotInput;
  evidence: ComplianceCardEvidenceInput[];
  compliancePct: number;
};

type FactCheckOptions = {
  startDate?: string;
  endDate?: string;
  dateKeys?: string[];
  source?: string;
  now?: Date;
};

function cardCreatedAt(cardId: string): Date | null {
  if (!/^[0-9a-f]{24}$/i.test(cardId)) return null;
  const seconds = Number.parseInt(cardId.slice(0, 8), 16);
  if (!Number.isFinite(seconds)) return null;
  return new Date(seconds * 1_000);
}

function actionMemberId(action: HistoricalTrelloAction) {
  return action.data.idMember ?? action.data.member?.id ?? null;
}

function isAfter(action: HistoricalTrelloAction, cutoff: Date) {
  return new Date(action.date).getTime() > cutoff.getTime();
}

/** Replay current Trello state backwards to the requested historical cutoff. */
export function reconstructCardAtCutoff(
  card: HistoricalTrelloCard,
  cutoff: Date,
  joyceMemberId: string,
): HistoricalCardState {
  let assignedToJoyce = card.idMembers.includes(joyceMemberId);
  let listName = card.listName;
  let closed = card.closed;
  const descending = [...card.actions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  for (const action of descending) {
    if (!isAfter(action, cutoff)) continue;
    if (action.type === "addMemberToCard" && actionMemberId(action) === joyceMemberId) {
      assignedToJoyce = false;
    } else if (action.type === "removeMemberFromCard" && actionMemberId(action) === joyceMemberId) {
      assignedToJoyce = true;
    }
    if (action.type === "updateCard" && action.data.listBefore?.name && action.data.listAfter?.name) {
      listName = action.data.listBefore.name;
    }
    if (action.type === "updateCard" && typeof action.data.old?.closed === "boolean") {
      closed = action.data.old.closed;
    }
  }

  const createdAt = cardCreatedAt(card.id);
  return {
    exists: !createdAt || createdAt.getTime() <= cutoff.getTime(),
    assignedToJoyce,
    closed,
    listName,
  };
}

function isJoyceProxyComment(action: HistoricalTrelloAction, ownerMemberId: string) {
  const text = action.data.text?.trim() ?? "";
  return action.memberCreator?.id === ownerMemberId
    && text.toLowerCase().includes(`@${JOYCE_USERNAME}`)
    && /~\s*joyce\s*$/i.test(text)
    && !text.startsWith("[APTLSS System]");
}

function findCardUpdate(
  actions: HistoricalTrelloAction[],
  start: Date,
  cutoff: Date,
) {
  return [...actions]
    .filter((action) => {
      const at = new Date(action.date).getTime();
      if (action.type !== "commentCard" || at < start.getTime() || at > cutoff.getTime()) return false;
      const text = action.data.text?.trim() ?? "";
      return Boolean(text) && !text.startsWith("[APTLSS System]");
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ?? null;
}

function isSunday(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay() === 0;
}

export function buildHistoricalComplianceDay({
  dateKey,
  cards,
  joyce,
  owner,
  reviewedOnHoldIds,
  verifiedAt,
  source,
  cutoffOverride,
}: {
  dateKey: string;
  cards: HistoricalTrelloCard[];
  joyce: TrelloMember;
  owner: TrelloMember;
  reviewedOnHoldIds: Set<string>;
  verifiedAt: Date;
  source: string;
  cutoffOverride?: Date;
}): ComplianceFactCheckDay {
  const { startUtc } = eatDateRangeUtc(dateKey);
  const scheduledCutoff = new Date(`${dateKey}T23:00:00+03:00`);
  const cutoff = cutoffOverride && cutoffOverride.getTime() < scheduledCutoff.getTime()
    ? cutoffOverride
    : scheduledCutoff;
  const required = !isSunday(dateKey);

  if (!required) {
    return {
      snapshot: {
        snapshotDate: dateKey,
        onHoldTotal: 0,
        onHoldReviewed: 0,
        onHoldMissedCards: [],
        doingTotal: 0,
        doingUpdated: 0,
        doingMissedCards: [],
        d1Instances: 0,
        estimatedPenalty: 0,
        source,
        weeklyPayLogId: null,
        required: false,
        verificationStatus: "verified_protected",
        verificationMethod: METHOD_VERSION,
        verificationCutoffAt: cutoff,
        verifiedAt,
        evidenceCount: 0,
      },
      evidence: [],
      compliancePct: 100,
    };
  }

  const evidence: ComplianceCardEvidenceInput[] = [];
  for (const card of cards) {
    const state = reconstructCardAtCutoff(card, cutoff, joyce.id);
    const category = getListCategory(state.listName);
    if (!state.exists || state.closed || !state.assignedToJoyce || (category !== "doing" && category !== "on-hold")) continue;

    const update = findCardUpdate(card.actions, startUtc, cutoff);
    const manualOnHoldReview = category === "on-hold" && reviewedOnHoldIds.has(card.id);
    const compliant = Boolean(update) || manualOnHoldReview;
    const evidenceType = update
      ? (isJoyceProxyComment(update, owner.id)
        ? "joyce_proxy_comment"
        : update.memberCreator?.id === joyce.id || update.memberCreator?.username === joyce.username
          ? "joyce_comment"
          : "human_card_update")
      : manualOnHoldReview
        ? "manual_on_hold_check"
        : "none";
    evidence.push({
      snapshotDate: dateKey,
      cardId: card.id,
      cardName: card.name,
      cardUrl: card.url,
      boardName: card.boardName,
      listName: state.listName,
      category,
      assignedToJoyce: true,
      compliant,
      evidenceType,
      evidenceActionId: update?.id ?? null,
      evidenceAt: update ? new Date(update.date) : null,
      evidenceJson: JSON.stringify({
        version: METHOD_VERSION,
        cutoffAt: cutoff.toISOString(),
        stateAtCutoff: state,
        currentState: {
          assignedToJoyce: card.idMembers.includes(joyce.id),
          listName: card.listName,
          closed: card.closed,
        },
        examinedActionCount: card.actions.length,
        updateEvidence: update ? {
          actionId: update.id,
          actionType: update.type,
          actionAt: update.date,
          actorId: update.memberCreator?.id ?? null,
          actorUsername: update.memberCreator?.username ?? null,
          attribution: evidenceType,
        } : null,
        manualOnHoldReview,
      }),
      verifiedAt,
    });
  }

  const doing = evidence.filter((row) => row.category === "doing");
  const onHold = evidence.filter((row) => row.category === "on-hold");
  const doingMissed = doing.filter((row) => !row.compliant);
  const onHoldMissed = onHold.filter((row) => !row.compliant);
  const doingUpdated = doing.length - doingMissed.length;
  const onHoldReviewed = onHold.length - onHoldMissed.length;
  const total = evidence.length;
  const compliancePct = total === 0 ? 100 : Math.round(((doingUpdated + onHoldReviewed) / total) * 100);
  const missedCard = (row: ComplianceCardEvidenceInput) => ({ id: row.cardId, name: row.cardName, url: row.cardUrl });

  return {
    snapshot: {
      snapshotDate: dateKey,
      onHoldTotal: onHold.length,
      onHoldReviewed,
      onHoldMissedCards: onHoldMissed.map(missedCard),
      doingTotal: doing.length,
      doingUpdated,
      doingMissedCards: doingMissed.map(missedCard),
      d1Instances: doingMissed.length,
      estimatedPenalty: doingMissed.length * 5,
      source,
      weeklyPayLogId: null,
      required: true,
      verificationStatus: "verified",
      verificationMethod: METHOD_VERSION,
      verificationCutoffAt: cutoff,
      verifiedAt,
      evidenceCount: evidence.length,
    },
    evidence,
    compliancePct,
  };
}

async function batchedMap<T, R>(items: T[], worker: (item: T) => Promise<R>, batchSize = 6): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    results.push(...await Promise.all(batch.map(worker)));
    if (index + batchSize < items.length) await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return results;
}

async function fetchActions(
  path: string,
  auth: { key: string; token: string },
  since: string,
  filter: string,
): Promise<HistoricalTrelloAction[]> {
  const actions: HistoricalTrelloAction[] = [];
  let before: string | undefined;
  for (let page = 0; page < 5; page++) {
    const response = await axios.get<HistoricalTrelloAction[]>(`${TRELLO_API_BASE}${path}`, {
      params: { ...auth, filter, limit: 1000, since, before, memberCreator_fields: "id,username,fullName" },
    });
    actions.push(...response.data);
    if (response.data.length < 1000) break;
    before = response.data.at(-1)?.id;
    if (!before) break;
  }
  return actions;
}

async function loadHistoricalCards({
  apiKey,
  apiToken,
  startDate,
  knownCardIds,
}: {
  apiKey: string;
  apiToken: string;
  startDate: string;
  knownCardIds: string[];
}) {
  const auth = { key: apiKey, token: apiToken };
  const since = eatDateRangeUtc(startDate).startUtc.toISOString();
  const [joyceResponse, ownerResponse, cardsResponse, boardsResponse] = await Promise.all([
    axios.get<TrelloMember>(`${TRELLO_API_BASE}/members/${JOYCE_USERNAME}`, { params: { ...auth, fields: "id,username,fullName" } }),
    axios.get<TrelloMember>(`${TRELLO_API_BASE}/members/${OWNER_USERNAME}`, { params: { ...auth, fields: "id,username,fullName" } }),
    axios.get<Array<Omit<HistoricalTrelloCard, "listName" | "boardName" | "actions">>>(`${TRELLO_API_BASE}/members/${JOYCE_USERNAME}/cards`, {
      params: { ...auth, filter: "all", fields: "id,name,url,idMembers,idList,idBoard,closed" },
    }),
    axios.get<TrelloBoard[]>(`${TRELLO_API_BASE}/members/${JOYCE_USERNAME}/boards`, {
      params: { ...auth, filter: "all", fields: "id,name,closed" },
    }),
  ]);
  const joyce = joyceResponse.data;
  const owner = ownerResponse.data;
  const boards = boardsResponse.data;

  const [boardLists, membershipActionArrays] = await Promise.all([
    batchedMap(boards, async (board) => {
      const response = await axios.get<TrelloList[]>(`${TRELLO_API_BASE}/boards/${board.id}/lists`, {
        params: { ...auth, filter: "all", fields: "id,name" },
      });
      return response.data;
    }),
    batchedMap(boards, (board) => fetchActions(
      `/boards/${board.id}/actions`,
      auth,
      since,
      "addMemberToCard,removeMemberFromCard",
    )),
  ]);

  const boardNames = new Map(boards.map((board) => [board.id, board.name]));
  const listNames = new Map<string, string>();
  boardLists.flat().forEach((list) => listNames.set(list.id, list.name));
  const currentCards = new Map(cardsResponse.data.map((card) => [card.id, card]));
  const candidateIds = new Set([...Array.from(currentCards.keys()), ...knownCardIds]);
  for (const action of membershipActionArrays.flat()) {
    if (actionMemberId(action) === joyce.id && action.data.card?.id) candidateIds.add(action.data.card.id);
  }

  const missingIds = Array.from(candidateIds).filter((id) => !currentCards.has(id));
  const missingCards = await batchedMap(missingIds, async (cardId) => {
    try {
      const response = await axios.get<any>(`${TRELLO_API_BASE}/cards/${cardId}`, {
        params: {
          ...auth,
          fields: "id,name,url,idMembers,idList,idBoard,closed",
          board: true,
          board_fields: "id,name",
          list: true,
          list_fields: "id,name",
        },
      });
      const card = response.data;
      boardNames.set(card.idBoard, card.board?.name ?? boardNames.get(card.idBoard) ?? "Unknown board");
      listNames.set(card.idList, card.list?.name ?? listNames.get(card.idList) ?? "Unknown list");
      return card as Omit<HistoricalTrelloCard, "listName" | "boardName" | "actions">;
    } catch (error) {
      if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 404)) {
        console.warn(`[Compliance] Skipping inaccessible historical Trello card ${cardId}`);
        return null;
      }
      throw error;
    }
  });
  missingCards.forEach((card) => {
    if (card) currentCards.set(card.id, card);
  });

  const candidates = Array.from(candidateIds).map((id) => currentCards.get(id)).filter(Boolean) as Array<Omit<HistoricalTrelloCard, "listName" | "boardName" | "actions">>;
  const actionArrays = await batchedMap(candidates, (card) => fetchActions(
    `/cards/${card.id}/actions`,
    auth,
    since,
    "commentCard,updateCard:idList,updateCard:closed,addMemberToCard,removeMemberFromCard,createCard",
  ));
  const cards = candidates.map((card, index): HistoricalTrelloCard => ({
    ...card,
    idMembers: card.idMembers ?? [],
    closed: Boolean(card.closed),
    listName: listNames.get(card.idList) ?? "Unknown list",
    boardName: boardNames.get(card.idBoard) ?? "Unknown board",
    actions: actionArrays[index],
  }));
  return { cards, joyce, owner };
}

function rangeDateKeys(startDate: string, endDate: string) {
  const count = differenceInDateKeys(endDate, startDate) + 1;
  if (count < 1) throw new Error("Compliance fact-check end date cannot be before start date");
  if (count > MAX_BACKFILL_DAYS) throw new Error(`Compliance fact-check is limited to ${MAX_BACKFILL_DAYS} days per run`);
  return Array.from({ length: count }, (_, index) => addDaysToDateKey(startDate, index));
}

function latestCompletedDateKey(now: Date) {
  const today = dateKeyInEat(now);
  return timeKeyInEat(now) >= "23:00" ? today : addDaysToDateKey(today, -1);
}

export async function factCheckComplianceHistory(options: FactCheckOptions = {}) {
  const apiKey = process.env.TrelloAPIKey?.trim();
  const apiToken = process.env.TrelloAPIToken?.trim();
  if (!apiKey || !apiToken) throw new Error("Trello credentials are required for compliance fact-checking");

  const now = options.now ?? new Date();
  const history = await getComplianceHistory(500);
  const explicitDates = options.dateKeys?.map(assertDateKey);
  const endDate = options.endDate ? assertDateKey(options.endDate) : latestCompletedDateKey(now);
  const oldestRecorded = history.at(-1)?.snapshotDate;
  const startDate = options.startDate
    ? assertDateKey(options.startDate)
    : oldestRecorded ?? addDaysToDateKey(endDate, -29);
  const dateKeys = explicitDates?.length ? Array.from(new Set(explicitDates)).sort() : rangeDateKeys(startDate, endDate);
  if (dateKeys.length > MAX_BACKFILL_DAYS) throw new Error(`Compliance fact-check is limited to ${MAX_BACKFILL_DAYS} days per run`);

  const knownCardIds = new Set<string>();
  for (const row of history) {
    row.doingMissedCards.forEach((card) => knownCardIds.add(card.id));
    row.onHoldMissedCards.forEach((card) => knownCardIds.add(card.id));
  }
  const loaded = await loadHistoricalCards({ apiKey, apiToken, startDate: dateKeys[0], knownCardIds: Array.from(knownCardIds) });
  const allCheckRows = await getOnHoldChecksBetween(dateKeys[0], dateKeys.at(-1)!);
  const checksByDate = new Map<string, typeof allCheckRows>();
  for (const row of allCheckRows) {
    const dateKey = row.date instanceof Date
      ? row.date.toISOString().slice(0, 10)
      : String(row.date).slice(0, 10);
    const rows = checksByDate.get(dateKey) ?? [];
    rows.push(row);
    checksByDate.set(dateKey, rows);
  }
  const verifiedAt = new Date();
  const source = options.source ?? "fact_check";
  const previous = new Map(history.map((row) => [row.snapshotDate, row]));
  const results: ComplianceFactCheckDay[] = [];

  for (const dateKey of dateKeys) {
    const reviewedOnHoldIds = new Set((checksByDate.get(dateKey) ?? []).filter((row) => row.checked).map((row) => row.cardId));
    const cutoffOverride = dateKey === dateKeyInEat(now) ? now : undefined;
    const result = buildHistoricalComplianceDay({
      dateKey,
      cards: loaded.cards,
      joyce: loaded.joyce,
      owner: loaded.owner,
      reviewedOnHoldIds,
      verifiedAt,
      source,
      cutoffOverride,
    });
    await upsertVerifiedComplianceSnapshot(result.snapshot, result.evidence);
    results.push(result);
  }

  const changedDays = results.filter((result) => {
    const old = previous.get(result.snapshot.snapshotDate);
    return !old
      || old.onHoldTotal !== result.snapshot.onHoldTotal
      || old.onHoldReviewed !== result.snapshot.onHoldReviewed
      || old.doingTotal !== result.snapshot.doingTotal
      || old.doingUpdated !== result.snapshot.doingUpdated
      || old.required !== result.snapshot.required;
  }).length;
  return {
    startDate: dateKeys[0],
    endDate: dateKeys.at(-1)!,
    daysChecked: results.length,
    changedDays,
    protectedDays: results.filter((result) => !result.snapshot.required).length,
    cardsExamined: loaded.cards.length,
    evidenceRows: results.reduce((sum, result) => sum + result.evidence.length, 0),
    results: results.map((result) => ({
      dateKey: result.snapshot.snapshotDate,
      required: result.snapshot.required ?? true,
      compliancePct: result.compliancePct,
      doingTotal: result.snapshot.doingTotal,
      doingUpdated: result.snapshot.doingUpdated,
      onHoldTotal: result.snapshot.onHoldTotal,
      onHoldReviewed: result.snapshot.onHoldReviewed,
      evidenceCount: result.evidence.length,
      doingMissedCards: result.snapshot.doingMissedCards,
      onHoldMissedCards: result.snapshot.onHoldMissedCards,
    })),
  };
}
