import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { like } from "drizzle-orm";
import { aptlssAssessmentFeedback, aptlssAssessments } from "../drizzle/schema";
import { assessAptlssCard } from "./aptlssAssessment";
import { getLatestAssessment, saveAssessmentSnapshot } from "./aptlssAssessmentDb";
import { AssessmentFeedbackError, getAssessmentCalibration, recordAssessmentFeedback } from "./aptlssFeedbackDb";
import { getDb } from "./db";
import type { TrelloCardContext } from "./aptlssEngine";

const itWithDb = process.env.DATABASE_URL ? it : it.skip;
const prefix = "feedback-audit-";

describe("APTLSS feedback ledger integration", () => {
  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    await db.delete(aptlssAssessmentFeedback).where(like(aptlssAssessmentFeedback.cardId, `${prefix}%`));
    await db.delete(aptlssAssessments).where(like(aptlssAssessments.cardId, `${prefix}%`));
  });

  itWithDb("persists one review per immutable assessment and includes it in calibration", async () => {
    const cardId = `${prefix}${Date.now()}`;
    const now = Date.parse("2026-07-11T12:00:00.000Z");
    const context: TrelloCardContext = {
      id: cardId,
      name: "Feedback audit card",
      desc: "Verify assessment feedback persistence.",
      url: `https://trello.example/${cardId}`,
      shortUrl: `https://trello.example/${cardId}`,
      due: "2026-07-12T12:00:00.000Z",
      dueComplete: false,
      labels: [{ name: "Audit", color: "blue" }],
      listName: "Doing",
      boardName: "Audit",
      checklists: [],
      comments: [],
      attachments: [],
      members: [{ username: "joyce", fullName: "Joyce" }],
      lastActivityMs: now - 60_000,
      activity: [{ type: "updateCard:list", date: "2026-07-11T11:59:00.000Z", memberName: "Joyce", detail: "Started" }],
    };
    const assessment = assessAptlssCard({
      ctx: context,
      steps: [{ status: "open", category: "internal_work", requiresRobert: false, estimatedMinutes: 30, completionCriteria: "Review is persisted", riskIfSkipped: "Calibration is unverified" }],
      nowMs: now,
    });
    await saveAssessmentSnapshot(context.name, assessment);
    const snapshot = await getLatestAssessment(cardId);
    expect(snapshot).not.toBeNull();

    const result = await recordAssessmentFeedback({ assessmentId: snapshot!.id, verdict: "accurate", createdBy: "integration-test" });
    expect(result).toMatchObject({ assessmentId: snapshot!.id });
    const calibration = await getAssessmentCalibration();
    expect(calibration.recentReviews.some((review) => review.assessmentId === snapshot!.id)).toBe(true);
    await expect(recordAssessmentFeedback({ assessmentId: snapshot!.id, verdict: "accurate", createdBy: "integration-test" }))
      .rejects.toBeInstanceOf(AssessmentFeedbackError);
  }, 20_000);
});
