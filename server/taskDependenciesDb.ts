import { and, eq, inArray } from "drizzle-orm";
import { taskDependencies } from "../drizzle/schema";
import type { PortfolioCard } from "./aptlssPortfolio";
import { getDb } from "./db";

export type TaskDependencyEdge = {
  cardId: string;
  dependsOnCardId: string;
  dependencyType?: "finish_to_start" | "start_to_start" | "finish_to_finish";
  source?: "manual" | "aptlss" | "trello";
  evidence?: Record<string, unknown> | null;
};

export function mergeDependencyEdges(cards: PortfolioCard[], edges: TaskDependencyEdge[]): PortfolioCard[] {
  const byCard = new Map<string, string[]>();
  for (const edge of edges) {
    byCard.set(edge.cardId, [...(byCard.get(edge.cardId) ?? []), edge.dependsOnCardId]);
  }
  return cards.map((card) => {
    const durable = Array.from(new Set(byCard.get(card.id) ?? []));
    if (!durable.length) return card;
    return {
      ...card,
      steps: [
        ...card.steps,
        { status: "open", dependsOnCards: durable, blockedBy: null },
      ],
    };
  });
}

export async function getActiveTaskDependencies(cardIds?: string[]): Promise<TaskDependencyEdge[]> {
  const db = await getDb();
  if (!db) return [];
  const statusClause = eq(taskDependencies.status, "active");
  const where = cardIds?.length
    ? and(statusClause, inArray(taskDependencies.cardId, cardIds))
    : statusClause;
  const rows = await db.select().from(taskDependencies).where(where);
  return rows.map((row) => ({
    cardId: row.cardId,
    dependsOnCardId: row.dependsOnCardId,
    dependencyType: row.dependencyType,
    source: row.source,
    evidence: row.evidenceJson ? JSON.parse(row.evidenceJson) as Record<string, unknown> : null,
  }));
}

export async function upsertTaskDependency(edge: TaskDependencyEdge) {
  if (edge.cardId === edge.dependsOnCardId) throw new Error("A card cannot depend on itself");
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(taskDependencies).values({
    cardId: edge.cardId,
    dependsOnCardId: edge.dependsOnCardId,
    dependencyType: edge.dependencyType ?? "finish_to_start",
    source: edge.source ?? "aptlss",
    status: "active",
    evidenceJson: edge.evidence ? JSON.stringify(edge.evidence) : null,
  }).onDuplicateKeyUpdate({
    set: {
      dependencyType: edge.dependencyType ?? "finish_to_start",
      source: edge.source ?? "aptlss",
      status: "active",
      evidenceJson: edge.evidence ? JSON.stringify(edge.evidence) : null,
      resolvedAt: null,
    },
  });
}

export async function resolveTaskDependency(cardId: string, dependsOnCardId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(taskDependencies).set({ status: "resolved", resolvedAt: new Date() }).where(and(
    eq(taskDependencies.cardId, cardId),
    eq(taskDependencies.dependsOnCardId, dependsOnCardId),
  ));
}
