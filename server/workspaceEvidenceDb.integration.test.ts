import { afterAll, describe, expect, it } from "vitest";
import { and, eq, inArray, like } from "drizzle-orm";

import { workspaceEvidenceItems, workspaceEvidenceLinks } from "../drizzle/schema";
import { getDb } from "./db";
import {
  getWorkspaceEvidenceReviewQueue,
  classifyWorkspaceEvidenceAsNotWorkRelated,
  reopenWorkspaceEvidenceReview,
  linkWorkspaceEvidenceManually,
  replaceWorkspaceEvidenceLinks,
  upsertWorkspaceEvidence,
} from "./workspaceEvidenceDb";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb("workspace evidence review queue", () => {
  const suffix = `${Date.now()}`;
  const cardId = `test-card-${suffix}`;
  const messageId = `test-message-${suffix}`;

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    const evidence = await db.select({ id: workspaceEvidenceItems.id })
      .from(workspaceEvidenceItems)
      .where(like(workspaceEvidenceItems.sourceId, `test-%-${suffix}`));
    if (evidence.length) {
      await db.delete(workspaceEvidenceLinks).where(inArray(workspaceEvidenceLinks.evidenceId, evidence.map((item) => item.id)));
    }
    await db.delete(workspaceEvidenceItems).where(like(workspaceEvidenceItems.sourceId, `test-%-${suffix}`));
  }, 120_000);

  it("preserves an operator-confirmed link during automatic relinking", async () => {
    const observedAt = new Date();
    await upsertWorkspaceEvidence({
      source: "trello",
      sourceId: cardId,
      kind: "card",
      title: "Test client handoff",
      content: "Board: Test / List: Doing",
      observedAt,
      active: true,
    });
    const evidenceId = await upsertWorkspaceEvidence({
      source: "gmail",
      sourceId: messageId,
      kind: "message",
      title: "Unclear client message",
      content: "Operator review is required.",
      observedAt,
      active: true,
    });

    expect((await getWorkspaceEvidenceReviewQueue(100)).some((item) => item.id === evidenceId)).toBe(true);
    await linkWorkspaceEvidenceManually(evidenceId, cardId);
    await replaceWorkspaceEvidenceLinks(evidenceId, []);

    const db = await getDb();
    const [link] = await db!.select().from(workspaceEvidenceLinks).where(and(
      eq(workspaceEvidenceLinks.evidenceId, evidenceId),
      eq(workspaceEvidenceLinks.cardId, cardId),
    )).limit(1);
    expect(link).toMatchObject({
      relevanceScore: 100,
      matchReason: "Confirmed by operator",
      linkMethod: "manual",
    });
    expect((await getWorkspaceEvidenceReviewQueue(100)).some((item) => item.id === evidenceId)).toBe(false);
  }, 120_000);

  it("preserves extracted content on metadata-only refreshes and reports only changed links", async () => {
    const sourceId = `test-preserve-${suffix}`;
    const observedAt = new Date();
    const evidenceId = await upsertWorkspaceEvidence({
      source: "google_drive",
      sourceId,
      kind: "document",
      title: "Persistent source text",
      content: "Previously extracted source-backed content",
      observedAt,
      active: true,
    });
    await upsertWorkspaceEvidence({
      source: "google_drive",
      sourceId,
      kind: "document",
      title: "Persistent source text renamed",
      observedAt: new Date(observedAt.getTime() + 1_000),
      active: true,
    });

    const db = await getDb();
    const [persisted] = await db!.select({ content: workspaceEvidenceItems.content })
      .from(workspaceEvidenceItems)
      .where(eq(workspaceEvidenceItems.id, evidenceId))
      .limit(1);
    expect(persisted.content).toBe("Previously extracted source-backed content");

    const match = { cardId, relevanceScore: 92, matchReason: "Distinctive source match" };
    expect(await replaceWorkspaceEvidenceLinks(evidenceId, [match])).toEqual({ changedCardIds: [cardId] });
    let [reviewState] = await db!.select({ reviewStatus: workspaceEvidenceItems.reviewStatus })
      .from(workspaceEvidenceItems).where(eq(workspaceEvidenceItems.id, evidenceId)).limit(1);
    expect(reviewState.reviewStatus).toBe("linked");
    expect(await replaceWorkspaceEvidenceLinks(evidenceId, [match])).toEqual({ changedCardIds: [] });
    expect(await replaceWorkspaceEvidenceLinks(evidenceId, [])).toEqual({ changedCardIds: [cardId] });
    [reviewState] = await db!.select({ reviewStatus: workspaceEvidenceItems.reviewStatus })
      .from(workspaceEvidenceItems).where(eq(workspaceEvidenceItems.id, evidenceId)).limit(1);
    expect(reviewState.reviewStatus).toBe("unreviewed");
  }, 120_000);

  it("durably removes operator-confirmed unrelated evidence from the review queue", async () => {
    const sourceId = `test-unrelated-${suffix}`;
    const evidenceId = await upsertWorkspaceEvidence({
      source: "gmail",
      sourceId,
      kind: "message",
      title: "Personal notification outside tracked work",
      content: "No Trello work is connected to this message.",
      modifiedAt: new Date(),
      observedAt: new Date(),
      active: true,
    });
    expect((await getWorkspaceEvidenceReviewQueue(100)).some((item) => item.id === evidenceId)).toBe(true);
    await classifyWorkspaceEvidenceAsNotWorkRelated(evidenceId);
    expect((await getWorkspaceEvidenceReviewQueue(100)).some((item) => item.id === evidenceId)).toBe(false);

    const db = await getDb();
    const [persisted] = await db!.select({
      reviewStatus: workspaceEvidenceItems.reviewStatus,
      reviewedAt: workspaceEvidenceItems.reviewedAt,
      reviewedBy: workspaceEvidenceItems.reviewedBy,
    }).from(workspaceEvidenceItems).where(eq(workspaceEvidenceItems.id, evidenceId)).limit(1);
    expect(persisted).toMatchObject({ reviewStatus: "not_work_related", reviewedBy: "joyce-single-user" });
    expect(persisted.reviewedAt).toBeInstanceOf(Date);
    await reopenWorkspaceEvidenceReview(evidenceId);
    expect((await getWorkspaceEvidenceReviewQueue(100)).some((item) => item.id === evidenceId)).toBe(true);
  }, 120_000);
});
