import { desc, eq } from "drizzle-orm";
import { aptlssAssessmentFeedback, aptlssAssessments } from "../drizzle/schema";
import { getDb } from "./db";
import { getLatestAssessments } from "./aptlssAssessmentDb";
import { APTLSS_CARD_STATES } from "./aptlssStateValues";

export type AssessmentFeedbackVerdict = "accurate" | "partial" | "inaccurate";

export class AssessmentFeedbackError extends Error {}

type CalibrationRow = {
  id?: number;
  assessmentId?: number;
  cardId: string;
  cardName?: string;
  engineVersion: string;
  predictedState: string;
  predictedConfidence: number;
  verdict: AssessmentFeedbackVerdict;
  correctedState?: string | null;
  note?: string | null;
  createdAt?: Date;
};

const VERDICT_WEIGHT: Record<AssessmentFeedbackVerdict, number> = {
  accurate: 1,
  partial: 0.5,
  inaccurate: 0,
};
const CARD_STATE_SET = new Set<string>(APTLSS_CARD_STATES);

export function summarizeAssessmentCalibration(rows: CalibrationRow[]) {
  const verdictCounts = { accurate: 0, partial: 0, inaccurate: 0 };
  const stateAccumulator = new Map<string, { total: number; weighted: number; corrections: Record<string, number> }>();
  let weightedTotal = 0;
  let calibrationErrorTotal = 0;
  let highConfidenceMisses = 0;

  for (const row of rows) {
    const weight = VERDICT_WEIGHT[row.verdict];
    verdictCounts[row.verdict]++;
    weightedTotal += weight;
    calibrationErrorTotal += Math.abs(row.predictedConfidence / 100 - weight);
    if (row.verdict === "inaccurate" && row.predictedConfidence >= 80) highConfidenceMisses++;
    const state = stateAccumulator.get(row.predictedState) ?? { total: 0, weighted: 0, corrections: {} };
    state.total++;
    state.weighted += weight;
    if (row.correctedState) state.corrections[row.correctedState] = (state.corrections[row.correctedState] ?? 0) + 1;
    stateAccumulator.set(row.predictedState, state);
  }

  const byState = Object.fromEntries(Array.from(stateAccumulator.entries())
    .map(([state, value]) => {
      const corrections = Object.entries(value.corrections) as Array<[string, number]>;
      return [state, {
        samples: value.total,
        accuracyScore: Math.round((value.weighted / value.total) * 100),
        commonCorrection: corrections.sort((left, right) => right[1] - left[1])[0]?.[0] ?? null,
      }] as const;
    })
    .sort((left, right) => String(left[0]).localeCompare(String(right[0]))));

  return {
    sampleSize: rows.length,
    sampleStatus: rows.length >= 30 ? "established" as const : rows.length >= 10 ? "developing" as const : "insufficient" as const,
    accuracyScore: rows.length ? Math.round((weightedTotal / rows.length) * 100) : null,
    confidenceCalibrationError: rows.length ? Math.round((calibrationErrorTotal / rows.length) * 100) : null,
    highConfidenceMisses,
    verdictCounts,
    byState,
    recentReviews: rows.slice(0, 10),
  };
}

export async function recordAssessmentFeedback({
  assessmentId,
  verdict,
  correctedState,
  note,
  createdBy,
}: {
  assessmentId: number;
  verdict: AssessmentFeedbackVerdict;
  correctedState?: string | null;
  note?: string | null;
  createdBy: string;
}) {
  const db = await getDb();
  if (!db) throw new AssessmentFeedbackError("Database unavailable");
  if (verdict === "inaccurate" && !correctedState?.trim()) {
    throw new AssessmentFeedbackError("A corrected state is required when an assessment is inaccurate.");
  }
  if (correctedState && !CARD_STATE_SET.has(correctedState.trim())) {
    throw new AssessmentFeedbackError("Corrected state is not a valid APTLSS state.");
  }

  return db.transaction(async (tx) => {
    const [assessment] = await tx
      .select()
      .from(aptlssAssessments)
      .where(eq(aptlssAssessments.id, assessmentId))
      .limit(1);
    if (!assessment) throw new AssessmentFeedbackError("Assessment snapshot not found.");

    const [existing] = await tx
      .select({ id: aptlssAssessmentFeedback.id })
      .from(aptlssAssessmentFeedback)
      .where(eq(aptlssAssessmentFeedback.assessmentId, assessmentId))
      .limit(1);
    if (existing) throw new AssessmentFeedbackError("This assessment has already been reviewed.");

    const [created] = await tx.insert(aptlssAssessmentFeedback).values({
      assessmentId,
      cardId: assessment.cardId,
      cardName: assessment.cardName,
      engineVersion: assessment.engineVersion,
      predictedState: assessment.primaryState,
      predictedConfidence: assessment.confidenceScore,
      verdict,
      correctedState: correctedState?.trim() || null,
      note: note?.trim() || null,
      createdBy,
    }).$returningId();
    return { id: created.id, assessmentId };
  });
}

export async function getAssessmentCalibration(limit = 5_000, engineVersion?: string) {
  const db = await getDb();
  if (!db) return summarizeAssessmentCalibration([]);
  const rows = await db
    .select()
    .from(aptlssAssessmentFeedback)
    .orderBy(desc(aptlssAssessmentFeedback.createdAt))
    .limit(Math.max(1, Math.min(limit, 10_000)));
  const scopedRows = engineVersion ? rows.filter((row) => row.engineVersion === engineVersion) : rows;
  return summarizeAssessmentCalibration(scopedRows as CalibrationRow[]);
}

export async function getAssessmentReviewQueue(limit = 8, engineVersion?: string) {
  const db = await getDb();
  if (!db) return [];
  const [assessments, feedbackRows] = await Promise.all([
    getLatestAssessments(),
    db.select({ assessmentId: aptlssAssessmentFeedback.assessmentId }).from(aptlssAssessmentFeedback),
  ]);
  const reviewed = new Set(feedbackRows.map((row) => row.assessmentId));
  return assessments
    .filter((assessment) => !reviewed.has(assessment.id) && (!engineVersion || assessment.engineVersion === engineVersion))
    .sort((left, right) => {
      const confidenceReview = right.confidenceScore - left.confidenceScore;
      if (confidenceReview !== 0) return confidenceReview;
      return right.priorityScore - left.priorityScore;
    })
    .slice(0, Math.max(1, Math.min(limit, 25)))
    .map((assessment) => ({
      id: assessment.id,
      cardId: assessment.cardId,
      cardName: assessment.cardName,
      primaryState: assessment.primaryState,
      stateReason: assessment.stateReason,
      confidenceScore: assessment.confidenceScore,
      priorityTier: assessment.priorityTier,
      engineVersion: assessment.engineVersion,
      forecastP50Minutes: assessment.intelligenceValue.forecast?.calibratedP50Minutes ?? null,
      bottleneckScore: assessment.intelligenceValue.portfolio?.bottleneckScore ?? 0,
      assessedAt: assessment.assessedAt,
    }));
}
