import { desc, eq, sql } from "drizzle-orm";
import { aptlssAssessments, type AptlssAssessmentSnapshot } from "../drizzle/schema";
import { getDb } from "./db";
import type { AptlssAssessment } from "./aptlssAssessment";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export type HydratedAssessment = AptlssAssessmentSnapshot & {
  secondarySignalsValue: string[];
  priorityBreakdownValue: Record<string, number>;
  evidenceCoverageValue: Record<string, boolean>;
  evidenceValue: AptlssAssessment["evidence"];
  intelligenceValue: Partial<Pick<AptlssAssessment, "portfolio" | "runtime" | "forecast" | "calibration">>;
  uncertaintiesValue: string[];
  recommendationsValue: string[];
  changeValue: Record<string, { before: unknown; after: unknown }>;
};

export function hydrateAssessment(row: AptlssAssessmentSnapshot): HydratedAssessment {
  return {
    ...row,
    secondarySignalsValue: parseJson(row.secondarySignals, []),
    priorityBreakdownValue: parseJson(row.priorityBreakdown, {}),
    evidenceCoverageValue: parseJson(row.evidenceCoverage, {}),
    evidenceValue: parseJson(row.evidenceJson, []),
    intelligenceValue: parseJson(row.intelligenceJson ?? "{}", {}),
    uncertaintiesValue: parseJson(row.uncertaintiesJson, []),
    recommendationsValue: parseJson(row.recommendationsJson, []),
    changeValue: parseJson(row.changeJson, {}),
  };
}

export async function getLatestAssessment(cardId: string) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(aptlssAssessments)
    .where(eq(aptlssAssessments.cardId, cardId))
    .orderBy(desc(aptlssAssessments.assessedAt), desc(aptlssAssessments.id))
    .limit(1);
  return row ? hydrateAssessment(row) : null;
}

export async function getAssessmentHistory(cardId: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(aptlssAssessments)
    .where(eq(aptlssAssessments.cardId, cardId))
    .orderBy(desc(aptlssAssessments.assessedAt), desc(aptlssAssessments.id))
    .limit(Math.max(1, Math.min(100, limit)));
  return rows.map(hydrateAssessment);
}

export async function getLatestAssessments() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(aptlssAssessments)
    .orderBy(desc(aptlssAssessments.id))
    .limit(5_000);
  const latestByCard = new Map<string, AptlssAssessmentSnapshot>();
  for (const row of rows) {
    if (!latestByCard.has(row.cardId)) latestByCard.set(row.cardId, row);
  }
  return Array.from(latestByCard.values())
    .sort((left, right) => right.priorityScore - left.priorityScore)
    .map(hydrateAssessment);
}

export async function getAssessmentsDue(now = new Date()) {
  const latest = await getLatestAssessments();
  return latest.filter((assessment) => assessment.nextAssessmentAt <= now);
}

function materialChanges(previous: HydratedAssessment | null, current: AptlssAssessment) {
  if (!previous) return { created: { before: null, after: current.primaryState } };
  const candidates: Array<[string, unknown, unknown]> = [
    ["contextHash", previous.contextHash, current.contextHash],
    ["engineVersion", previous.engineVersion, current.engineVersion],
    ["primaryState", previous.primaryState, current.primaryState],
    ["secondarySignals", previous.secondarySignalsValue, current.secondarySignals],
    ["actionability", previous.actionability, current.actionability],
    ["priorityScore", previous.priorityScore, current.priorityScore],
    ["priorityTier", previous.priorityTier, current.priorityTier],
    ["confidenceScore", previous.confidenceScore, current.confidenceScore],
    ["intelligence", previous.intelligenceValue, {
      portfolio: current.portfolio,
      runtime: current.runtime,
      forecast: current.forecast,
      calibration: current.calibration,
    }],
    ["recommendations", previous.recommendationsValue, current.recommendations],
  ];
  return Object.fromEntries(
    candidates
      .filter(([, before, after]) => JSON.stringify(before) !== JSON.stringify(after))
      .map(([key, before, after]) => [key, { before, after }]),
  );
}

export async function saveAssessmentSnapshot(cardName: string, assessment: AptlssAssessment) {
  const db = await getDb();
  if (!db) return null;
  const previous = await getLatestAssessment(assessment.cardId);
  const changes = materialChanges(previous, assessment);
  const evaluatedAt = new Date(assessment.assessedAt);

  if (previous && Object.keys(changes).length === 0) {
    await db
      .update(aptlssAssessments)
      .set({
        lastEvaluatedAt: evaluatedAt,
        nextAssessmentAt: new Date(assessment.nextAssessmentAt),
        evaluationCount: sql`${aptlssAssessments.evaluationCount} + 1`,
        trigger: assessment.trigger,
      })
      .where(eq(aptlssAssessments.id, previous.id));
    return getLatestAssessment(previous.cardId);
  }

  await db.insert(aptlssAssessments).values({
    cardId: assessment.cardId,
    cardName,
    engineVersion: assessment.engineVersion,
    contextHash: assessment.contextHash,
    trigger: assessment.trigger,
    primaryState: assessment.primaryState,
    stateReason: assessment.stateReason,
    secondarySignals: JSON.stringify(assessment.secondarySignals),
    actionability: assessment.actionability,
    priorityScore: assessment.priorityScore,
    priorityTier: assessment.priorityTier,
    priorityBreakdown: JSON.stringify(assessment.priorityBreakdown),
    confidenceScore: assessment.confidenceScore,
    confidenceBand: assessment.confidenceBand,
    confidenceReason: assessment.confidenceReason,
    evidenceCoverage: JSON.stringify(assessment.evidenceCoverage),
    evidenceJson: JSON.stringify(assessment.evidence),
    intelligenceJson: JSON.stringify({
      portfolio: assessment.portfolio,
      runtime: assessment.runtime,
      forecast: assessment.forecast,
      calibration: assessment.calibration,
    }),
    uncertaintiesJson: JSON.stringify(assessment.uncertainties),
    recommendationsJson: JSON.stringify(assessment.recommendations),
    lastMeaningfulProgressAt: assessment.lastMeaningfulProgressAt ? new Date(assessment.lastMeaningfulProgressAt) : null,
    daysSinceMeaningfulProgress: assessment.daysSinceMeaningfulProgress,
    nextAssessmentAt: new Date(assessment.nextAssessmentAt),
    changeJson: JSON.stringify(changes),
    evaluationCount: 1,
    assessedAt: evaluatedAt,
    lastEvaluatedAt: evaluatedAt,
  });
  return getLatestAssessment(assessment.cardId);
}
