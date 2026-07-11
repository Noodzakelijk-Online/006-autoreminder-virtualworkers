import { describe, expect, it } from "vitest";
import { assessAptlssCard } from "./aptlssAssessment";
import type { TrelloCardContext } from "./aptlssEngine";
import { interpretWaitingReason } from "./aptlssWaitingReason";

const NOW = Date.parse("2026-07-10T12:00:00.000Z");

function context(overrides: Partial<TrelloCardContext> = {}): TrelloCardContext {
  return {
    id: "card-1",
    name: "Prepare client launch",
    desc: "Prepare the final launch package and confirm approval.",
    url: "https://trello.com/c/card-1",
    shortUrl: "https://trello.com/c/card-1",
    due: "2026-07-11T12:00:00.000Z",
    dueComplete: false,
    labels: [{ name: "Client", color: "red" }],
    listName: "Doing",
    boardName: "Operations",
    checklists: [{ id: "cl-1", name: "APTLSS Execution Checklist", checkItems: [{ id: "i-1", name: "Draft", state: "incomplete" }] }],
    comments: [],
    attachments: [{ name: "Brief", url: "https://example.com/brief" }],
    members: [{ username: "joyce", fullName: "Joyce" }],
    lastActivityMs: NOW - 60 * 60_000,
    activity: [{ type: "updateCheckItemStateOnCard", date: "2026-07-10T11:00:00.000Z", memberName: "Joyce", detail: "Completed prior step" }],
    ...overrides,
  };
}

const steps = [{ status: "open", category: "internal_work", requiresRobert: false, estimatedMinutes: 45, completionCriteria: "Launch package exists", riskIfSkipped: "Client deadline is missed" }];

describe("APTLSS evidence assessment", () => {
  it("classifies an inbound question as waiting for Joyce", () => {
    const result = assessAptlssCard({ ctx: context({ comments: [{ text: "Can you confirm the launch date?", date: "2026-07-10T10:00:00.000Z", memberName: "Client" }] }), steps, nowMs: NOW });
    expect(result.primaryState).toBe("WAITING_FOR_JOYCE");
    expect(result.secondarySignals).toContain("inbound_question_unanswered");
  });

  it("classifies Joyce's unresolved question as waiting externally", () => {
    const result = assessAptlssCard({ ctx: context({ comments: [{ text: "Can the client approve the final copy?", date: "2026-07-10T10:00:00.000Z", memberName: "Joyce" }] }), steps, nowMs: NOW });
    expect(result.primaryState).toBe("WAITING_FOR_EXTERNAL_PARTY");
  });

  it("keeps overdue visible as a secondary signal when a card is blocked", () => {
    const result = assessAptlssCard({
      ctx: context({ due: "2026-07-08T12:00:00.000Z" }),
      steps: [{ ...steps[0], blockedBy: "blocker-card" }],
      dependentCardCount: 3,
      nowMs: NOW,
    });
    expect(result.primaryState).toBe("BLOCKED_BY_OTHER_CARD");
    expect(result.secondarySignals).toContain("overdue");
    expect(result.priorityTier).toBe("BLOCKED");
    expect(result.priorityScore).toBeGreaterThanOrEqual(60);
  });

  it("derives confidence from evidence coverage and contradictions", () => {
    const strong = assessAptlssCard({ ctx: context(), steps, nowMs: NOW });
    const weak = assessAptlssCard({
      ctx: context({ desc: "", due: null, labels: [], members: [], comments: [], activity: [], attachments: [], checklists: [] }),
      steps: [],
      nowMs: NOW,
    });
    expect(strong.confidenceScore).toBeGreaterThan(weak.confidenceScore);
    expect(strong.confidenceBand).not.toBe("low");
    expect(weak.confidenceBand).toBe("low");
    expect(weak.uncertainties.length).toBeGreaterThan(3);
  });

  it("uses meaningful activity to detect a stalled card", () => {
    const result = assessAptlssCard({
      ctx: context({
        lastActivityMs: NOW - 8 * 86_400_000,
        activity: [{ type: "commentCard", date: "2026-07-02T12:00:00.000Z", memberName: "Joyce", detail: "Started" }],
        checklists: [{ id: "cl-1", name: "APTLSS", checkItems: [{ id: "1", name: "First", state: "complete" }, { id: "2", name: "Second", state: "incomplete" }] }],
      }),
      steps: [{ ...steps[0], status: "complete" }, steps[0]],
      nowMs: NOW,
    });
    expect(result.primaryState).toBe("STALLED");
    expect(result.daysSinceMeaningfulProgress).toBeGreaterThanOrEqual(7);
  });

  it("produces a stable hash that changes with material context", () => {
    const first = assessAptlssCard({ ctx: context(), steps, nowMs: NOW });
    const same = assessAptlssCard({ ctx: context(), steps, nowMs: NOW + 1000 });
    const changed = assessAptlssCard({ ctx: context({ due: "2026-07-12T12:00:00.000Z" }), steps, nowMs: NOW });
    expect(first.contextHash).toBe(same.contextHash);
    expect(changed.contextHash).not.toBe(first.contextHash);
  });

  it("recalibrates confidence from a credible human-review sample", () => {
    const baseline = assessAptlssCard({ ctx: context(), steps, nowMs: NOW });
    const calibrated = assessAptlssCard({
      ctx: context(),
      steps,
      nowMs: NOW,
      calibration: { sampleSize: 30, accuracyScore: 35, byState: {} },
    });
    expect(calibrated.calibration).toMatchObject({ applied: true, scope: "global", sampleSize: 30, validatedAccuracy: 35 });
    expect(calibrated.confidenceScore).toBeLessThan(baseline.confidenceScore);
  });

  it("does not claim near-certainty without completed-work timing evidence", () => {
    const result = assessAptlssCard({ ctx: context(), steps, nowMs: NOW });
    expect(result.forecast.calibrationSampleSize).toBe(0);
    expect(result.confidenceScore).toBeLessThanOrEqual(88);
    expect(result.confidenceReason).toContain("not yet applied");
  });

  it("uses exact VA waiting evidence as the authoritative state and next action", () => {
    const interpreted = interpretWaitingReason(
      "Client Sarah still needs to send the final logo files; I emailed her yesterday.",
      { nowMs: NOW, due: "2026-07-11T12:00:00.000Z" },
    );
    const waiting = { ...interpreted, reasonId: 8, recordedAt: new Date(NOW - 60_000).toISOString() };
    const result = assessAptlssCard({ ctx: context(), steps, waiting, nowMs: NOW });

    expect(result.primaryState).toBe("WAITING_FOR_EXTERNAL_PARTY");
    expect(result.actionability).toBe("actionable");
    expect(result.secondarySignals).toEqual(expect.arrayContaining(["waiting_reason_recorded", "waiting_follow_up_due"]));
    expect(result.recommendations[0]).toBe(waiting.nextAction);
    expect(result.evidenceCoverage.waitingReason).toBe(true);
    expect(result.priorityBreakdown.waitingFollowUp).toBe(12);
  });

  it("routes ambiguous waiting evidence back to Joyce instead of inventing an external party", () => {
    const interpreted = interpretWaitingReason("Still waiting, not sure what is happening.", { nowMs: NOW });
    const waiting = { ...interpreted, reasonId: 9, recordedAt: new Date(NOW).toISOString() };
    const result = assessAptlssCard({ ctx: context(), steps, waiting, nowMs: NOW });

    expect(result.primaryState).toBe("WAITING_FOR_JOYCE");
    expect(result.actionability).toBe("repair");
    expect(result.confidenceScore).toBeLessThanOrEqual(interpreted.confidenceScore + 10);
    expect(result.recommendations[0]).toContain("Clarify the waiting reason");
  });
});
