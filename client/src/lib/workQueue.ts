export type WorkQueueLaneId = "overdue" | "doing" | "onhold";

export type WorkQueueCard = {
  id: string;
  title: string;
  url: string;
  boardName: string;
  listName: string;
  due: string | null;
  lastActivity?: string | null;
  updatedToday?: boolean;
  lane: WorkQueueLaneId;
  laneLabel: string;
  risk: "High" | "Medium" | "Low";
  nextAction: string;
  detail: string;
  tone: "red" | "amber" | "violet" | "green";
  actionable: boolean;
  hasWaitingEvidence: boolean;
  waitingOn: string | null;
  waitingFollowUpAt: string | null;
};

export type WorkQueueLane = {
  id: WorkQueueLaneId;
  label: string;
  count: number;
  summary: string;
  helper: string;
  tone: "red" | "amber" | "violet";
};

type WorkQueueSourceCard = {
  id: string;
  name: string;
  url: string;
  boardName: string;
  listName: string;
  due: string | null;
  dateLastActivity?: string | null;
  updatedToday?: boolean;
};

export type WorkQueueSourceData = {
  freshness?: { fetchedAt: string | null; stale: boolean; source: "live" | "cache" | "none" };
  overdueCards?: WorkQueueSourceCard[];
  doingCards?: WorkQueueSourceCard[];
  onHoldCards?: WorkQueueSourceCard[];
};

export type WorkQueueWaitingReason = {
  cardId: string;
  waitingOn: string;
  waitingOnName: string | null;
  nextAction: string;
  followUpAt: string | Date | null;
  urgency: string;
  interpretationValue?: { summary?: string } | null;
};

export type SavedPlanQueueBlock = {
  cardId?: string | null;
  cardName: string;
  cardUrl?: string | null;
  boardName: string;
  listName: string;
  flags?: string[];
};

export function workQueueSourceFromPlan(blocks: SavedPlanQueueBlock[]): WorkQueueSourceData {
  const seen = new Set<string>();
  const cards = blocks.flatMap((block) => {
    if (!block.cardId || seen.has(block.cardId)) return [];
    seen.add(block.cardId);
    return [{
      id: block.cardId,
      name: block.cardName,
      url: block.cardUrl ?? `https://trello.com/c/${block.cardId}`,
      boardName: block.boardName,
      listName: block.listName,
      due: null,
      flags: block.flags ?? [],
    }];
  });
  return {
    overdueCards: cards.filter((card) => card.flags.includes("Overdue")),
    doingCards: cards.filter((card) => !card.flags.includes("Overdue") && !card.flags.includes("Blocked")).map((card) => ({ ...card, updatedToday: false })),
    onHoldCards: cards.filter((card) => card.flags.includes("Blocked")),
  };
}

function dateValue(value?: string | null, missing = Number.POSITIVE_INFINITY) {
  if (!value) return missing;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? missing : time;
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function compareByDueThenTitle(a: WorkQueueCard, b: WorkQueueCard) {
  const dueDiff = dateValue(a.due) - dateValue(b.due);
  if (dueDiff !== 0) return dueDiff;
  return compareText(a.title, b.title);
}

function compareByDueActivityThenTitle(a: WorkQueueCard, b: WorkQueueCard) {
  const dueDiff = dateValue(a.due) - dateValue(b.due);
  if (dueDiff !== 0) return dueDiff;
  const activityDiff = dateValue(a.lastActivity) - dateValue(b.lastActivity);
  if (activityDiff !== 0) return activityDiff;
  return compareText(a.title, b.title);
}

function compareByActivityThenTitle(a: WorkQueueCard, b: WorkQueueCard) {
  const activityDiff = dateValue(a.lastActivity) - dateValue(b.lastActivity);
  if (activityDiff !== 0) return activityDiff;
  return compareText(a.title, b.title);
}

function riskRank(risk: WorkQueueCard["risk"]) {
  return risk === "High" ? 3 : risk === "Medium" ? 2 : 1;
}

function highestRisk(left: WorkQueueCard["risk"], right: WorkQueueCard["risk"]) {
  return riskRank(left) >= riskRank(right) ? left : right;
}

function evidenceRisk(urgency: string): WorkQueueCard["risk"] {
  if (urgency === "critical" || urgency === "high") return "High";
  if (urgency === "normal") return "Medium";
  return "Low";
}

function formatWaitingCheckpoint(value: string | Date | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString("en-GB", {
    timeZone: "Africa/Nairobi",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }) + " EAT";
}

function applyWaitingEvidence(card: WorkQueueCard, evidence: WorkQueueWaitingReason | undefined, nowMs: number): WorkQueueCard {
  if (!evidence) return card;
  const followUpAt = evidence.followUpAt ? new Date(evidence.followUpAt) : null;
  const validFollowUp = followUpAt && !Number.isNaN(followUpAt.getTime()) ? followUpAt : null;
  const waitsForExternalChange = evidence.waitingOn === "external_party" || evidence.waitingOn === "dependency";
  const checkpointDue = Boolean(validFollowUp && validFollowUp.getTime() <= nowMs);
  const actionable = !waitsForExternalChange || !validFollowUp || checkpointDue;
  const checkpoint = formatWaitingCheckpoint(validFollowUp);
  const actor = evidence.waitingOnName ?? evidence.waitingOn.replace(/_/g, " ");
  const summary = evidence.interpretationValue?.summary?.trim() || `Waiting on ${actor}.`;
  return {
    ...card,
    risk: highestRisk(card.risk, evidenceRisk(evidence.urgency)),
    nextAction: evidence.nextAction,
    detail: !actionable
      ? `${summary} Hold execution until ${checkpoint ?? "the saved checkpoint"}; do not chase early.`
      : validFollowUp && !checkpointDue
        ? `${summary} The preparation step is actionable now; the follow-up checkpoint is ${checkpoint}.`
        : `${summary} The APTLSS checkpoint is due.`,
    actionable,
    hasWaitingEvidence: true,
    waitingOn: actor,
    waitingFollowUpAt: validFollowUp?.toISOString() ?? null,
  };
}

export function normalizeWorkQueue(
  data?: WorkQueueSourceData,
  preferredCardId?: string | null,
  waitingReasons: WorkQueueWaitingReason[] = [],
  nowMs = Date.now(),
) {
  const waitingByCard = new Map(waitingReasons.map((reason) => [reason.cardId, reason]));
  const overdue = (data?.overdueCards ?? []).map((card): WorkQueueCard => ({
    id: card.id,
    title: card.name,
    url: card.url,
    boardName: card.boardName,
    listName: card.listName,
    due: card.due,
    lane: "overdue",
    laneLabel: "Overdue",
    risk: "High",
    nextAction: "Resolve the overdue blocker or update Trello with the exact waiting reason.",
    detail: "Past-due card. Start here unless Robert decision work is blocking delivery.",
    tone: "red",
    actionable: true,
    hasWaitingEvidence: false,
    waitingOn: null,
    waitingFollowUpAt: null,
  })).map((card) => applyWaitingEvidence(card, waitingByCard.get(card.id), nowMs)).sort(compareByDueThenTitle);
  const doing = (data?.doingCards ?? [])
    .filter((card) => !card.updatedToday)
    .map((card): WorkQueueCard => ({
      id: card.id,
      title: card.name,
      url: card.url,
      boardName: card.boardName,
      listName: card.listName,
      due: card.due,
      lastActivity: card.dateLastActivity,
      updatedToday: card.updatedToday,
      lane: "doing",
      laneLabel: "Doing needs update",
      risk: card.due ? "Medium" : "Low",
      nextAction: "Post a concise daily update with progress, next step, and blocker status.",
      detail: "This card is in a DOING lane and still needs Joyce's signed daily update today.",
      tone: "amber",
      actionable: true,
      hasWaitingEvidence: false,
      waitingOn: null,
      waitingFollowUpAt: null,
    }))
    .map((card) => applyWaitingEvidence(card, waitingByCard.get(card.id), nowMs))
    .sort(compareByDueActivityThenTitle);
  const onHold = (data?.onHoldCards ?? []).map((card): WorkQueueCard => ({
    id: card.id,
    title: card.name,
    url: card.url,
    boardName: card.boardName,
    listName: card.listName,
    due: card.due,
    lastActivity: card.dateLastActivity,
    lane: "onhold",
    laneLabel: "On hold review",
    risk: "Low",
    nextAction: "Review whether this is still blocked, ready to move, or needs a follow-up.",
    detail: "On-hold cards are reviewed without forcing inline action overload on the dashboard.",
    tone: "violet",
    actionable: true,
    hasWaitingEvidence: false,
    waitingOn: null,
    waitingFollowUpAt: null,
  })).map((card) => applyWaitingEvidence(card, waitingByCard.get(card.id), nowMs)).sort(compareByActivityThenTitle);

  const seenCardIds = new Set<string>();
  const deduplicated = [...overdue, ...doing, ...onHold].filter((card) => {
    if (seenCardIds.has(card.id)) return false;
    seenCardIds.add(card.id);
    return true;
  });
  const cards = [
    ...deduplicated.filter((card) => card.actionable),
    ...deduplicated.filter((card) => !card.actionable),
  ];
  if (preferredCardId) {
    const preferredIndex = cards.findIndex((card) => card.id === preferredCardId);
    if (preferredIndex > 0 && cards[preferredIndex].actionable) {
      const [preferred] = cards.splice(preferredIndex, 1);
      cards.unshift(preferred);
    }
  }
  const laneCounts = {
    overdue: cards.filter((card) => card.lane === "overdue").length,
    doing: cards.filter((card) => card.lane === "doing").length,
    onhold: cards.filter((card) => card.lane === "onhold").length,
  };
  const lanes: WorkQueueLane[] = [
    {
      id: "overdue",
      label: "Overdue",
      count: laneCounts.overdue,
      summary: laneCounts.overdue === 1 ? "1 card needs attention" : `${laneCounts.overdue} cards need attention`,
      helper: "Due dates in the past",
      tone: "red",
    },
    {
      id: "doing",
      label: "Doing needs update",
      count: laneCounts.doing,
      summary: laneCounts.doing === 1 ? "1 card needs a comment" : `${laneCounts.doing} cards need a comment`,
      helper: "Update in Trello today",
      tone: "amber",
    },
    {
      id: "onhold",
      label: "On hold review",
      count: laneCounts.onhold,
      summary: laneCounts.onhold === 1 ? "1 card to review" : `${laneCounts.onhold} cards to review`,
      helper: "Review and decide next step",
      tone: "violet",
    },
  ];

  return {
    cards,
    nowItem: cards[0],
    nextItems: cards.slice(1, 4),
    lanes,
  };
}
