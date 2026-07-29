import { desc, eq } from "drizzle-orm";
import { projectContexts } from "../drizzle/schema";
import { getDb } from "./db";

export type ProjectContextValue = {
  projectKey: string;
  name: string;
  clientName?: string | null;
  priority: "standard" | "priority" | "vip";
  boardIds: string[];
  contactEmail?: string | null;
  notes?: string | null;
  active: boolean;
};

function fromRow(row: typeof projectContexts.$inferSelect): ProjectContextValue {
  let boardIds: string[] = [];
  try {
    const parsed = JSON.parse(row.boardIdsJson) as unknown;
    if (Array.isArray(parsed)) boardIds = parsed.filter((item): item is string => typeof item === "string");
  } catch {
    boardIds = [];
  }
  return {
    projectKey: row.projectKey,
    name: row.name,
    clientName: row.clientName,
    priority: row.priority,
    boardIds,
    contactEmail: row.contactEmail,
    notes: row.notes,
    active: row.active,
  };
}

export async function listProjectContexts() {
  const db = await getDb();
  if (!db) return [];
  return (await db.select().from(projectContexts).orderBy(desc(projectContexts.updatedAt))).map(fromRow);
}

export async function getProjectContextForBoard(boardId: string) {
  const rows = await listProjectContexts();
  return rows.find((row) => row.active && row.boardIds.includes(boardId)) ?? null;
}

export async function upsertProjectContext(value: ProjectContextValue) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const boardIdsJson = JSON.stringify(Array.from(new Set(value.boardIds.filter(Boolean))));
  await db.insert(projectContexts).values({
    projectKey: value.projectKey,
    name: value.name,
    clientName: value.clientName ?? null,
    priority: value.priority,
    boardIdsJson,
    contactEmail: value.contactEmail ?? null,
    notes: value.notes ?? null,
    active: value.active,
  }).onDuplicateKeyUpdate({ set: {
    name: value.name,
    clientName: value.clientName ?? null,
    priority: value.priority,
    boardIdsJson,
    contactEmail: value.contactEmail ?? null,
    notes: value.notes ?? null,
    active: value.active,
  } });
  return value;
}

export async function deleteProjectContext(projectKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(projectContexts).where(eq(projectContexts.projectKey, projectKey));
}
