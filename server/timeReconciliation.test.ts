import { describe, expect, it } from "vitest";
import type { DailyPlanBlock } from "./dailyPlan";
import type { DailyTimeEvidence } from "./timeEvidence";
import { buildTimeReconciliationCandidates } from "./timeReconciliation";

const baseEvidence: DailyTimeEvidence = {
  dateKey: "2026-07-14",
  calculatedAt: new Date("2026-07-14T18:00:00Z"),
  isWorkday: true,
  protectedReason: null,
  targetSeconds: 32_400,
  trackedSeconds: 0,
  overtimeSeconds: 0,
  entryCount: 0,
  entries: [],
  cards: [],
};

const block: DailyPlanBlock = {
  id: "block-1",
  startTime: "09:00",
  endTime: "10:00",
  cardId: "card-1",
  cardName: "Prepare client update",
  cardUrl: "https://trello.com/c/card-1",
  boardName: "Client",
  listName: "Doing",
  action: "Draft update",
  stepIds: [7],
  priority: "high",
  score: 90,
  state: "doing",
  status: "done",
  notes: "",
  flags: [],
};

describe("time reconciliation", () => {
  it("requires clarification when completed planned work has no time evidence", () => {
    const rows = buildTimeReconciliationCandidates(
      "2026-07-14",
      baseEvidence,
      [block],
      [],
      []
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "completed_plan_without_time",
          severity: "high",
          planBlockId: "block-1",
        }),
      ])
    );
  });

  it("flags verified Trello work without a matching session", () => {
    const rows = buildTimeReconciliationCandidates(
      "2026-07-14",
      baseEvidence,
      [],
      [
        {
          cardId: "card-2",
          cardName: "Updated card",
          cardUrl: "https://trello.com/c/card-2",
          boardName: "Client",
          listName: "Doing",
          category: "doing",
          assignedToJoyce: true,
          compliant: true,
          evidenceType: "comment",
          evidenceActionId: "action-1",
          evidenceAt: new Date(),
          verifiedAt: new Date(),
        },
      ],
      []
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "source_activity_without_time",
          cardId: "card-2",
        }),
      ])
    );
  });

  it("recognizes long and unplanned timer evidence", () => {
    const entry = {
      id: 10,
      cardId: "card-3",
      cardName: "Emergency repair",
      cardUrl: "https://trello.com/c/card-3",
      boardName: "Operations",
      listName: "Doing",
      startedAt: new Date("2026-07-14T06:00:00Z"),
      stoppedAt: new Date("2026-07-14T11:00:00Z"),
      durationSeconds: 18_000,
      notes: null,
      source: "work_queue",
      category: "client_work",
      planDateKey: null,
      planBlockId: null,
      aptlssStepId: null,
      isVoided: false,
      allocatedSeconds: 18_000,
      active: false,
    };
    const rows = buildTimeReconciliationCandidates(
      "2026-07-14",
      {
        ...baseEvidence,
        trackedSeconds: 18_000,
        entryCount: 1,
        entries: [entry],
      },
      [],
      [],
      []
    );
    expect(rows.map(row => row.type)).toEqual(
      expect.arrayContaining(["long_session", "unplanned_time"])
    );
  });

  it("requires time evidence for verified communication work", () => {
    const rows = buildTimeReconciliationCandidates(
      "2026-07-14",
      baseEvidence,
      [],
      [],
      [
        {
          id: 1,
          snapshotDate: "2026-07-14",
          evidenceKey: "email:gmail:1",
          kind: "email_processing",
          channel: "gmail",
          externalId: "1",
          title: "Client email",
          sourceUrl: null,
          occurredAt: new Date(),
          dueAt: new Date(),
          outcome: "verified",
          evidenceType: "gmail_sent_reply",
          evidenceAt: new Date(),
          evidenceJson: "{}",
          verifiedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "communication_without_time",
          severity: "high",
        }),
      ])
    );
  });
});
