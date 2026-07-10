import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { like } from "drizzle-orm";
import { aptlssAssessments } from "../drizzle/schema";
import { assessAptlssCard } from "./aptlssAssessment";
import { getAssessmentHistory, getLatestAssessment, getLatestAssessments, saveAssessmentSnapshot } from "./aptlssAssessmentDb";
import { getDb } from "./db";
import type { TrelloCardContext } from "./aptlssEngine";

const itWithDb = process.env.DATABASE_URL ? it : it.skip;

describe("APTLSS assessment ledger integration", () => {
  afterAll(async () => {
    const db = await getDb();
    if (db) await db.delete(aptlssAssessments).where(like(aptlssAssessments.cardId, "assessment-audit-%"));
  });

  itWithDb("stores material changes and heartbeats unchanged evaluations", async () => {
    const cardId = `assessment-audit-${Date.now()}`;
    const now = Date.parse("2026-07-10T12:00:00.000Z");
    const context: TrelloCardContext = {
      id: cardId,
      name: "Assessment audit card",
      desc: "Prepare and verify a client update.",
      url: `https://trello.example/${cardId}`,
      shortUrl: `https://trello.example/${cardId}`,
      due: "2026-07-11T12:00:00.000Z",
      dueComplete: false,
      labels: [{ name: "Client", color: "red" }],
      listName: "Doing",
      boardName: "Audit",
      checklists: [],
      comments: [],
      attachments: [],
      members: [{ username: "joyce", fullName: "Joyce" }],
      lastActivityMs: now - 60_000,
      activity: [{ type: "updateCard:list", date: "2026-07-10T11:59:00.000Z", memberName: "Joyce", detail: "To Do -> Doing" }],
    };
    const steps = [{ status: "open", category: "internal_work", requiresRobert: false, estimatedMinutes: 30, completionCriteria: "Update exists", riskIfSkipped: "Client deadline" }];
    const first = assessAptlssCard({ ctx: context, steps, nowMs: now, trigger: "manual" });
    await saveAssessmentSnapshot(context.name, first);
    await saveAssessmentSnapshot(context.name, { ...first, assessedAt: new Date(now + 60_000).toISOString(), nextAssessmentAt: new Date(now + 3_660_000).toISOString() });

    const heartbeat = await getLatestAssessment(cardId);
    expect(heartbeat?.evaluationCount).toBe(2);
    expect(await getAssessmentHistory(cardId)).toHaveLength(1);

    const changed = assessAptlssCard({ ctx: { ...context, due: "2026-07-09T12:00:00.000Z" }, steps, nowMs: now + 120_000, trigger: "webhook" });
    await saveAssessmentSnapshot(context.name, changed);
    const history = await getAssessmentHistory(cardId);
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ primaryState: "OVERDUE", trigger: "webhook" });
    expect(history[0].changeValue).toHaveProperty("contextHash");
    expect((await getLatestAssessments()).some((assessment) => assessment.cardId === cardId)).toBe(true);
  });
});
