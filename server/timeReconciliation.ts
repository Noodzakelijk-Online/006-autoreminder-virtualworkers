import { and, eq, inArray, notInArray } from "drizzle-orm";
import { timeReconciliationItems } from "../drizzle/schema";
import { weekBoundsFromDateKey } from "../shared/eatTime";
import { getSavedDailyPlan, type DailyPlanBlock } from "./dailyPlan";
import { getComplianceEvidenceByDate, getDb } from "./db";
import { getComplianceCommunicationEvidenceByDate } from "./complianceCommunicationDb";
import {
  getTimeDayReview,
  getTimeEntryEventsForDate,
  lockTimeDay,
} from "./timeAccountability";
import {
  getDailyTimeEvidence,
  getWeeklyTimeEvidence,
  type DailyTimeEvidence,
} from "./timeEvidence";

type Candidate = {
  fingerprint: string;
  type: string;
  severity: "low" | "medium" | "high";
  cardId?: string | null;
  cardName?: string | null;
  cardUrl?: string | null;
  boardName?: string | null;
  listName?: string | null;
  timeEntryId?: number | null;
  planBlockId?: string | null;
  title: string;
  detail: string;
  source: unknown;
};

function blockMinutes(block: DailyPlanBlock) {
  const toMinutes = (value: string) => {
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + minute;
  };
  return Math.max(0, toMinutes(block.endTime) - toMinutes(block.startTime));
}

export function buildTimeReconciliationCandidates(
  dateKey: string,
  evidence: DailyTimeEvidence,
  blocks: DailyPlanBlock[],
  compliance: Awaited<ReturnType<typeof getComplianceEvidenceByDate>>,
  communication: Awaited<
    ReturnType<typeof getComplianceCommunicationEvidenceByDate>
  >
) {
  const candidates: Candidate[] = [];
  const entriesByCard = new Map<string, typeof evidence.entries>();
  for (const entry of evidence.entries)
    entriesByCard.set(entry.cardId, [
      ...(entriesByCard.get(entry.cardId) ?? []),
      entry,
    ]);
  const plannedCardIds = new Set(
    blocks
      .map(block => block.cardId)
      .filter((value): value is string => Boolean(value))
  );

  for (const block of blocks.filter(
    item => item.cardId && ["active", "done"].includes(item.status)
  )) {
    const tracked = (entriesByCard.get(block.cardId!) ?? []).reduce(
      (sum, entry) => sum + entry.allocatedSeconds,
      0
    );
    if (tracked === 0) {
      candidates.push({
        fingerprint: `${dateKey}:plan:${block.id}:missing`,
        type: "completed_plan_without_time",
        severity: "high",
        cardId: block.cardId,
        cardName: block.cardName,
        cardUrl: block.cardUrl,
        boardName: block.boardName,
        listName: block.listName,
        planBlockId: block.id,
        title: "Planned work has no timer evidence",
        detail: `${block.cardName} is ${block.status}, but no time was recorded. Add the missing session or explain why no time was required.`,
        source: { block, trackedSeconds: tracked },
      });
    } else {
      const plannedSeconds = blockMinutes(block) * 60;
      const ratio = plannedSeconds > 0 ? tracked / plannedSeconds : 1;
      if (ratio < 0.5 || ratio > 1.75)
        candidates.push({
          fingerprint: `${dateKey}:plan:${block.id}:variance`,
          type: "plan_variance",
          severity: ratio > 2.5 ? "high" : "medium",
          cardId: block.cardId,
          cardName: block.cardName,
          cardUrl: block.cardUrl,
          boardName: block.boardName,
          listName: block.listName,
          planBlockId: block.id,
          title: "Actual time differs from the plan",
          detail: `${Math.round(tracked / 60)} minutes recorded against ${Math.round(plannedSeconds / 60)} planned minutes. Confirm the variance before locking the day.`,
          source: { block, trackedSeconds: tracked, plannedSeconds },
        });
    }
  }

  for (const fact of compliance.filter(
    row => row.compliant && !entriesByCard.has(row.cardId)
  )) {
    candidates.push({
      fingerprint: `${dateKey}:activity:${fact.cardId}`,
      type: "source_activity_without_time",
      severity: "high",
      cardId: fact.cardId,
      cardName: fact.cardName,
      cardUrl: fact.cardUrl,
      boardName: fact.boardName,
      listName: fact.listName,
      title: "Verified Trello work has no timer evidence",
      detail: `${fact.cardName} received a verified Joyce update, but no time session is linked to the card.`,
      source: fact,
    });
  }

  const verifiedCommunication = communication.filter(
    row => row.outcome === "verified"
  );
  const communicationSeconds = evidence.entries
    .filter(entry => entry.category === "communication")
    .reduce((sum, entry) => sum + entry.allocatedSeconds, 0);
  if (verifiedCommunication.length > 0 && communicationSeconds === 0)
    candidates.push({
      fingerprint: `${dateKey}:communication:missing-time`,
      type: "communication_without_time",
      severity: "high",
      title: "Processed communication has no tracked time",
      detail: `${verifiedCommunication.length} verified message or email outcome${verifiedCommunication.length === 1 ? "" : "s"} were recorded without a communication session. Add the missing session or explain how the work was accounted for.`,
      source: {
        evidenceKeys: verifiedCommunication.map(row => row.evidenceKey),
        communicationSeconds,
      },
    });

  for (const entry of evidence.entries) {
    if (entry.allocatedSeconds > 4 * 3_600)
      candidates.push({
        fingerprint: `${dateKey}:entry:${entry.id}:long`,
        type: "long_session",
        severity: entry.allocatedSeconds > 8 * 3_600 ? "high" : "medium",
        cardId: entry.cardId,
        cardName: entry.cardName,
        cardUrl: entry.cardUrl,
        boardName: entry.boardName,
        listName: entry.listName,
        timeEntryId: entry.id,
        planBlockId: entry.planBlockId,
        title: "Long uninterrupted session",
        detail: `${Math.round(entry.allocatedSeconds / 60)} minutes were recorded in one session. Confirm that breaks and interruptions were excluded.`,
        source: entry,
      });
    if (!entry.planBlockId && !plannedCardIds.has(entry.cardId))
      candidates.push({
        fingerprint: `${dateKey}:entry:${entry.id}:unplanned`,
        type: "unplanned_time",
        severity: "low",
        cardId: entry.cardId,
        cardName: entry.cardName,
        cardUrl: entry.cardUrl,
        boardName: entry.boardName,
        listName: entry.listName,
        timeEntryId: entry.id,
        title: "Time is not linked to the daily plan",
        detail:
          "The session is valid timer evidence, but it is not linked to a Plan My Day block. Confirm it was legitimate unplanned work.",
        source: entry,
      });
  }
  return candidates;
}

async function persistCandidates(dateKey: string, candidates: Candidate[]) {
  const db = await getDb();
  if (!db) return [];
  for (const candidate of candidates) {
    await db
      .insert(timeReconciliationItems)
      .values({
        dateKey,
        fingerprint: candidate.fingerprint.slice(0, 256),
        type: candidate.type,
        severity: candidate.severity,
        status: "open",
        cardId: candidate.cardId ?? null,
        cardName: candidate.cardName ?? null,
        cardUrl: candidate.cardUrl ?? null,
        boardName: candidate.boardName ?? null,
        listName: candidate.listName ?? null,
        timeEntryId: candidate.timeEntryId ?? null,
        planBlockId: candidate.planBlockId ?? null,
        title: candidate.title,
        detail: candidate.detail,
        sourceJson: JSON.stringify(candidate.source),
      })
      .onDuplicateKeyUpdate({
        set: {
          severity: candidate.severity,
          title: candidate.title,
          detail: candidate.detail,
          sourceJson: JSON.stringify(candidate.source),
        },
      });
  }
  const fingerprints = candidates.map(candidate =>
    candidate.fingerprint.slice(0, 256)
  );
  const staleWhere =
    fingerprints.length > 0
      ? and(
          eq(timeReconciliationItems.dateKey, dateKey),
          eq(timeReconciliationItems.status, "open"),
          notInArray(timeReconciliationItems.fingerprint, fingerprints)
        )
      : and(
          eq(timeReconciliationItems.dateKey, dateKey),
          eq(timeReconciliationItems.status, "open")
        );
  await db
    .update(timeReconciliationItems)
    .set({ status: "superseded" })
    .where(staleWhere);
  return db
    .select()
    .from(timeReconciliationItems)
    .where(
      and(
        eq(timeReconciliationItems.dateKey, dateKey),
        inArray(timeReconciliationItems.status, [
          "open",
          "resolved",
          "dismissed",
        ])
      )
    )
    .orderBy(
      timeReconciliationItems.status,
      timeReconciliationItems.severity,
      timeReconciliationItems.createdAt
    );
}

export async function getTimeWorkspace(dateKey: string) {
  const { startDate, endDate } = weekBoundsFromDateKey(dateKey);
  const [evidence, plan, compliance, communication, review, events, week] =
    await Promise.all([
      getDailyTimeEvidence(dateKey),
      getSavedDailyPlan(dateKey),
      getComplianceEvidenceByDate(dateKey),
      getComplianceCommunicationEvidenceByDate(dateKey),
      getTimeDayReview(dateKey),
      getTimeEntryEventsForDate(dateKey),
      getWeeklyTimeEvidence(startDate, endDate),
    ]);
  const blocks = plan?.blocks ?? [];
  const candidates = buildTimeReconciliationCandidates(
    dateKey,
    evidence,
    blocks,
    compliance,
    communication
  );
  const anomalies = await persistCandidates(dateKey, candidates);
  return {
    dateKey,
    evidence,
    week,
    review,
    anomalies,
    events,
    planBlocks: blocks,
  };
}

export async function resolveTimeReconciliationItem(
  id: number,
  resolutionInput: string,
  dismiss = false
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const resolution = resolutionInput.trim();
  if (resolution.length < 5)
    throw new Error("Explain the outcome in at least 5 characters");
  const [item] = await db
    .select()
    .from(timeReconciliationItems)
    .where(eq(timeReconciliationItems.id, id))
    .limit(1);
  if (!item || item.status !== "open")
    throw new Error("This time clarification is no longer open");
  await db
    .update(timeReconciliationItems)
    .set({
      status: dismiss ? "dismissed" : "resolved",
      resolution,
      resolvedAt: new Date(),
    })
    .where(eq(timeReconciliationItems.id, id));
  return { success: true, dateKey: item.dateKey };
}

export async function reviewAndLockTimeDay(
  dateKey: string,
  overtimeReason?: string | null
) {
  const workspace = await getTimeWorkspace(dateKey);
  const highOpen = workspace.anomalies.filter(
    item => item.status === "open" && item.severity === "high"
  );
  if (highOpen.length > 0)
    throw new Error(
      `Resolve ${highOpen.length} high-confidence time exception${highOpen.length === 1 ? "" : "s"} before locking the day`
    );
  if (
    workspace.evidence.overtimeSeconds > 0 &&
    (overtimeReason?.trim().length ?? 0) < 5
  ) {
    throw new Error("Explain the overtime before locking the day");
  }
  return lockTimeDay({
    dateKey,
    overtimeReason,
    summary: {
      version: 1,
      trackedSeconds: workspace.evidence.trackedSeconds,
      targetSeconds: workspace.evidence.targetSeconds,
      overtimeSeconds: workspace.evidence.overtimeSeconds,
      entryCount: workspace.evidence.entryCount,
      unresolvedExceptions: workspace.anomalies.filter(
        item => item.status === "open"
      ).length,
      lockedAt: new Date().toISOString(),
    },
  });
}
