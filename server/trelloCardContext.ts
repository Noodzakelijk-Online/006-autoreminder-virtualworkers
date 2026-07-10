/**
 * Trello card context fetcher — gathers all available context for a card
 * so the LLM can generate a rich, accurate APTLSS plan.
 *
 * Fetches:
 *   - Card details (name, description, due date, labels, members, shortUrl)
 *   - Board and list name
 *   - Checklists (all items with completion state)
 *   - Recent comments (last 10) — normalised to { text, date, memberName }
 *   - Attachments (names/URLs)
 *   - lastActivityMs (Unix ms)
 *
 * NOTE: The TrelloCardContext interface here is the canonical one used by
 * both trelloWebhook.ts and aptlssEngine.ts. aptlssEngine.ts re-exports a
 * compatible interface so callers can use either import path.
 */
import axios from "axios";

const TRELLO_API_BASE = "https://api.trello.com/1";
const customFieldCache = new Map<string, { expiresAt: number; fields: Array<{ id: string; name: string; type: string }> }>();
const CUSTOM_FIELD_CACHE_MS = 10 * 60_000;

async function getBoardCustomFields(boardId: string, apiKey: string, apiToken: string) {
  const cached = customFieldCache.get(boardId);
  if (cached && cached.expiresAt > Date.now()) return cached.fields;
  try {
    const response = await axios.get(`${TRELLO_API_BASE}/boards/${boardId}/customFields`, {
      params: { key: apiKey, token: apiToken },
    });
    const fields = response.data ?? [];
    customFieldCache.set(boardId, { expiresAt: Date.now() + CUSTOM_FIELD_CACHE_MS, fields });
    return fields;
  } catch {
    customFieldCache.set(boardId, { expiresAt: Date.now() + CUSTOM_FIELD_CACHE_MS, fields: [] });
    return [];
  }
}

// ─── Sub-types (kept for backward compat with formatContextForLLM) ───────────
export interface TrelloChecklist {
  id: string;
  name: string;
  checkItems: Array<{
    id: string;
    name: string;
    state: "complete" | "incomplete";
  }>;
}

export interface TrelloComment {
  id: string;
  date: string;
  memberCreator: { username: string; fullName: string };
  data: { text: string };
}

export interface TrelloAttachment {
  id: string;
  name: string;
  url: string;
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: string;
}

/**
 * Canonical TrelloCardContext — compatible with aptlssEngine.ts expectations.
 * Fields marked with * are the additions over the old interface.
 */
export interface TrelloCardContext {
  id: string;
  name: string;
  desc: string;
  start?: string | null;
  due: string | null;
  dueComplete: boolean;
  closed?: boolean;
  position?: number | null;
  url: string;
  shortUrl: string;       // * required by aptlssEngine
  boardName: string;
  listName: string;
  labels: { name: string; color: string }[];
  checklists: TrelloChecklist[];
  /** Normalised comment list — required by aptlssEngine */
  comments: { text: string; date: string; memberName: string }[];
  /** Raw comment list — kept for formatContextForLLM */
  recentComments: TrelloComment[];
  attachments: { name: string; url: string }[];
  members: Array<{ username: string; fullName: string }>;
  dateLastActivity: string;
  /** Unix ms of last activity — required by aptlssEngine */
  lastActivityMs: number;
  activity?: Array<{ type: string; date: string; memberName: string; detail: string }>;
  customFields?: Array<{ id: string; name: string; value: string }>;
}

/**
 * Fetch full context for a Trello card by ID.
 * Throws if the card cannot be fetched.
 */
export async function fetchCardContext(
  cardId: string,
  apiKey: string,
  apiToken: string,
  knownNames: { boardName?: string; listName?: string } = {},
): Promise<TrelloCardContext> {
  const [cardRes, checklistsRes, actionsRes] = await Promise.all([
    axios.get(`${TRELLO_API_BASE}/cards/${cardId}`, {
      params: {
        key: apiKey,
        token: apiToken,
        fields: "name,desc,start,due,dueComplete,closed,pos,url,shortUrl,idList,idBoard,dateLastActivity",
        members: "true",
        labels: "true",
        attachments: "true",
        attachment_fields: "name,url",
        customFieldItems: "true",
      },
    }),
    axios.get(`${TRELLO_API_BASE}/cards/${cardId}/checklists`, {
      params: { key: apiKey, token: apiToken },
    }),
    axios.get(`${TRELLO_API_BASE}/cards/${cardId}/actions`, {
      params: {
        key: apiKey,
        token: apiToken,
        filter: "all",
        limit: 50,
      },
    }),
  ]);

  const card = cardRes.data;
  const checklists: TrelloChecklist[] = checklistsRes.data ?? [];
  const actions = actionsRes.data ?? [];

  // Fetch board and list names
  let boardName = knownNames.boardName || "Unknown Board";
  let listName = knownNames.listName || "Unknown List";
  let customFieldDefinitions: Array<{ id: string; name: string; type: string }> = [];
  try {
    const [boardRes, listRes, customFieldsRes] = await Promise.all([
      knownNames.boardName ? Promise.resolve({ data: { name: knownNames.boardName } }) : axios.get(`${TRELLO_API_BASE}/boards/${card.idBoard}`, {
        params: { key: apiKey, token: apiToken, fields: "name" },
      }),
      knownNames.listName ? Promise.resolve({ data: { name: knownNames.listName } }) : axios.get(`${TRELLO_API_BASE}/lists/${card.idList}`, {
        params: { key: apiKey, token: apiToken, fields: "name" },
      }),
      getBoardCustomFields(card.idBoard, apiKey, apiToken).then((fields) => ({ data: fields })),
    ]);
    boardName = boardRes.data?.name ?? boardName;
    listName = listRes.data?.name ?? listName;
    customFieldDefinitions = customFieldsRes.data ?? [];
  } catch {
    // Non-fatal — use defaults
  }

  const recentComments: TrelloComment[] = actions
    .filter((a: any) => a.type === "commentCard")
    .map((a: any) => ({
      id: a.id,
      date: a.date,
      memberCreator: {
        username: a.memberCreator?.username ?? "",
        fullName: a.memberCreator?.fullName ?? "",
      },
      data: { text: a.data?.text ?? "" },
    }));

  // Normalised comment list for aptlssEngine
  const comments = recentComments.map((c) => ({
    text: c.data.text,
    date: c.date,
    memberName: c.memberCreator.fullName || c.memberCreator.username,
  }));

  const attachments = (card.attachments ?? []).map((att: any) => ({
    id: att.id,
    name: att.name,
    url: att.url,
  }));

  const members = (card.members ?? []).map((m: any) => ({
    username: m.username ?? "",
    fullName: m.fullName ?? "",
  }));

  const labels = (card.labels ?? []).map((l: any) => ({
    id: l.id,
    name: l.name ?? "",
    color: l.color ?? "",
  }));

  const dateLastActivity: string = card.dateLastActivity ?? "";
  const lastActivityMs = dateLastActivity ? new Date(dateLastActivity).getTime() : Date.now();
  const activity = actions.map((action: any) => {
    const memberName = action.memberCreator?.fullName || action.memberCreator?.username || "";
    let type = action.type ?? "unknown";
    let detail = "";
    if (type === "commentCard") detail = action.data?.text ?? "";
    else if (type === "updateCheckItemStateOnCard") detail = `${action.data?.checkItem?.name ?? "Checklist item"}: ${action.data?.checkItem?.state ?? "updated"}`;
    else if (type === "updateCard" && action.data?.listAfter) {
      type = "updateCard:list";
      detail = `${action.data?.listBefore?.name ?? "Unknown"} -> ${action.data?.listAfter?.name ?? "Unknown"}`;
    } else if (type === "updateCard" && action.data?.old?.due !== undefined) detail = `Due date changed from ${action.data.old.due ?? "none"} to ${action.data.card?.due ?? "none"}`;
    else detail = action.data?.checklist?.name || action.data?.attachment?.name || action.data?.card?.name || type;
    return { type, date: action.date ?? "", memberName, detail };
  });
  const customFields = (card.customFieldItems ?? []).map((item: any) => {
    const definition = customFieldDefinitions.find((field) => field.id === item.idCustomField);
    const rawValue = item.value?.text ?? item.value?.number ?? item.value?.date ?? item.value?.checked ?? item.idValue ?? "";
    return { id: item.idCustomField, name: definition?.name ?? item.idCustomField, value: String(rawValue) };
  });

  return {
    id: card.id,
    name: card.name,
    desc: card.desc ?? "",
    start: card.start ?? null,
    due: card.due ?? null,
    dueComplete: card.dueComplete ?? false,
    closed: card.closed ?? false,
    position: typeof card.pos === "number" ? card.pos : null,
    url: card.url ?? card.shortUrl ?? "",
    shortUrl: card.shortUrl ?? card.url ?? "",
    boardName,
    listName,
    labels,
    checklists,
    recentComments,
    comments,
    attachments,
    members,
    dateLastActivity,
    lastActivityMs,
    activity,
    customFields,
  };
}

/**
 * Render a TrelloCardContext into a compact text block for the LLM prompt.
 */
export function formatContextForLLM(ctx: TrelloCardContext): string {
  const lines: string[] = [];

  lines.push(`CARD: ${ctx.name}`);
  lines.push(`BOARD: ${ctx.boardName}  |  LIST: ${ctx.listName}`);
  lines.push(`URL: ${ctx.shortUrl || ctx.url}`);

  if (ctx.due) {
    const dueDate = new Date(ctx.due);
    const now = new Date();
    const diffMs = dueDate.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const overdue = diffMs < 0;
    lines.push(
      `DUE: ${dueDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })} (${overdue ? `OVERDUE by ${Math.abs(diffDays)} day(s)` : `in ${diffDays} day(s)`})${ctx.dueComplete ? " ✓ COMPLETE" : ""}`
    );
  } else {
    lines.push("DUE: Not set");
  }
  if (ctx.start) lines.push(`START: ${new Date(ctx.start).toISOString()}`);

  if (ctx.labels.length > 0) {
    lines.push(`LABELS: ${ctx.labels.map((l) => l.name || l.color).join(", ")}`);
  }

  if (ctx.members.length > 0) {
    lines.push(`MEMBERS: ${ctx.members.map((m) => m.fullName || m.username).join(", ")}`);
  }

  if (ctx.customFields?.length) {
    lines.push(`CUSTOM FIELDS: ${ctx.customFields.map((field) => `${field.name}=${field.value}`).join("; ")}`);
  }

  if (ctx.desc.trim()) {
    lines.push("");
    lines.push("DESCRIPTION:");
    lines.push(ctx.desc.trim().slice(0, 2000));
  }

  if (ctx.checklists.length > 0) {
    lines.push("");
    lines.push("CHECKLISTS:");
    for (const cl of ctx.checklists) {
      lines.push(`  [${cl.name}]`);
      for (const item of cl.checkItems) {
        lines.push(`    ${item.state === "complete" ? "✓" : "○"} ${item.name}`);
      }
    }
  }

  if (ctx.recentComments.length > 0) {
    lines.push("");
    lines.push("RECENT COMMENTS (newest first):");
    for (const c of ctx.recentComments.slice(0, 5)) {
      const dateStr = new Date(c.date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      lines.push(`  [${c.memberCreator.fullName || c.memberCreator.username} @ ${dateStr}]`);
      lines.push(`  "${c.data.text.slice(0, 300)}"`);
    }
  }

  if (ctx.attachments.length > 0) {
    lines.push("");
    lines.push("ATTACHMENTS:");
    for (const att of ctx.attachments.slice(0, 5)) {
      lines.push(`  - ${att.name}: ${att.url}`);
    }
  }

  const nonCommentActivity = (ctx.activity ?? []).filter((event) => event.type !== "commentCard").slice(0, 15);
  if (nonCommentActivity.length > 0) {
    lines.push("");
    lines.push("RECENT WORK EVIDENCE (newest first):");
    for (const event of nonCommentActivity) {
      lines.push(`  - ${event.date} | ${event.memberName || "Unknown"} | ${event.type}: ${event.detail.slice(0, 240)}`);
    }
  }

  return lines.join("\n");
}
