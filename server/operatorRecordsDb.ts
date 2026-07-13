import { and, desc, eq, sql } from "drizzle-orm";
import { handoffRecords, operatorNotifications } from "../drizzle/schema";
import { getDb } from "./db";

export async function createOperatorNotification(input: { title: string; content: string; category?: string; provider?: string }) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(operatorNotifications).values({
    title: input.title,
    content: input.content,
    category: input.category ?? "operational",
    provider: input.provider ?? "local",
    deliveryStatus: "pending",
  });
  return Number((result as { insertId?: number }).insertId ?? 0) || null;
}

export async function updateOperatorNotificationDelivery(
  id: number | null,
  status: "delivered" | "skipped" | "failed",
  detail?: { provider?: string; providerReference?: string | null; errorMessage?: string | null },
) {
  if (!id) return;
  const db = await getDb();
  if (!db) return;
  await db.update(operatorNotifications).set({
    deliveryStatus: status,
    provider: detail?.provider ?? "local",
    providerReference: detail?.providerReference ?? null,
    errorMessage: detail?.errorMessage ?? null,
    deliveredAt: status === "delivered" ? new Date() : null,
  }).where(eq(operatorNotifications.id, id));
}

export async function getRecentOperatorNotifications(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(operatorNotifications).orderBy(desc(operatorNotifications.createdAt)).limit(Math.max(1, Math.min(limit, 250)));
}

export async function persistHandoffDraft(input: {
  dateKey: string;
  content: string;
  checklist: unknown[];
  sourcePlan?: unknown;
  handoffType?: "end_of_day" | "shift" | "manual";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const handoffType = input.handoffType ?? "end_of_day";
  return db.transaction(async (tx) => {
    await tx.update(handoffRecords).set({ status: "superseded" }).where(and(
      eq(handoffRecords.dateKey, input.dateKey as unknown as Date),
      eq(handoffRecords.handoffType, handoffType),
      eq(handoffRecords.status, "draft"),
    ));
    const [versionRow] = await tx.select({ value: sql<number>`coalesce(max(${handoffRecords.version}), 0)` })
      .from(handoffRecords)
      .where(and(eq(handoffRecords.dateKey, input.dateKey as unknown as Date), eq(handoffRecords.handoffType, handoffType)));
    const version = Number(versionRow?.value ?? 0) + 1;
    const [result] = await tx.insert(handoffRecords).values({
      dateKey: input.dateKey as unknown as Date,
      handoffType,
      status: "draft",
      version,
      content: input.content,
      checklistJson: JSON.stringify(input.checklist),
      sourcePlanJson: input.sourcePlan ? JSON.stringify(input.sourcePlan) : null,
    });
    return { id: Number((result as { insertId?: number }).insertId ?? 0), version };
  });
}

export async function getRecentHandoffs(limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(handoffRecords).orderBy(desc(handoffRecords.createdAt)).limit(Math.max(1, Math.min(limit, 100)));
}
