import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  aptlssAssessments,
  aptlssPlans,
  aptlssSteps,
  cardStates,
  priorityScores,
} from "../drizzle/schema";
import { getActiveWaitingReason, getActiveWaitingReasons, getWaitingReasonHistory, recordAptlssWaitingReason, resolveAptlssWaitingReason } from "./aptlssWaitingReasonDb";
import { interpretWaitingReason } from "./aptlssWaitingReason";
import { selectWorkQueueNextAction } from "./aptlssWorkQueue";
import {
  ensureBrowserTabCollectorToken,
  getBrowserTabEvidenceHistory,
  getBrowserTabPolicy,
  getBrowserTabStatus,
  setBrowserTabPolicy,
} from "./browserTabHygiene";
import { getDb } from "./db";
import { DecisionOutcomeError, getDecisionHistory, recordDecisionOutcome } from "./decisionOutcomesDb";
import { generateOperatorDailyPlan, getOperatorDailyPlan, updateOperatorDailyPlan, type OperatorDailyPlanPayload } from "./operatorDailyPlan";
import { protectedProcedure, router } from "./_core/trpc";

const operatorProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "worker" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Operator access requires a worker or admin role" });
  }
  return next({ ctx });
});

const workerMutation = operatorProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "worker") {
    throw new TRPCError({ code: "FORBIDDEN", message: "This action must be completed by the worker" });
  }
  return next({ ctx });
});

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const dailyPlanPayloadSchema = z.object({
  version: z.literal(2),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generatedAt: z.string(),
  blocks: z.array(z.object({
    id: z.string(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    cardId: z.string().nullable(),
    cardName: z.string(),
    cardUrl: z.string().nullable(),
    boardName: z.string(),
    listName: z.string(),
    action: z.string(),
    stepIds: z.array(z.number().int()),
    priority: z.string(),
    score: z.number(),
    state: z.string(),
    status: z.enum(["planned", "active", "done", "skipped"]),
    notes: z.string(),
    flags: z.array(z.string()),
  })),
  robertItems: z.array(z.object({
    stepId: z.number().int(),
    cardId: z.string(),
    cardName: z.string(),
    decision: z.string(),
  })),
  unscheduledCards: z.array(z.object({
    cardId: z.string(),
    cardName: z.string(),
    reason: z.string(),
  })),
  planHealth: z.object({
    confidence: z.number(),
    scheduledMinutes: z.number(),
    availableMinutes: z.number(),
    overlaps: z.number(),
    gaps: z.number(),
  }),
  constraints: z.object({
    startTime: z.string(),
    endTime: z.string(),
    breaks: z.array(z.object({
      name: z.string(),
      startTime: z.string(),
      durationMinutes: z.number(),
    })),
  }),
  auditTrail: z.array(z.object({
    at: z.string(),
    action: z.string(),
    detail: z.string(),
  })),
});

export const operatorRouter = router({
  getWorkQueueContext: operatorProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database unavailable" });
    const vaId = Number(ctx.user.id);
    const [plans, states, scores, steps, waitingReasons] = await Promise.all([
      db.select().from(aptlssPlans).where(eq(aptlssPlans.vaId, vaId)),
      db.select().from(cardStates).where(eq(cardStates.vaId, vaId)),
      db.select().from(priorityScores).where(eq(priorityScores.vaId, vaId)),
      db.select().from(aptlssSteps).where(eq(aptlssSteps.vaId, vaId)),
      getActiveWaitingReasons(),
    ]);
    const cardIds = plans.map((plan) => plan.cardId);
    const assessments = cardIds.length
      ? await db.select().from(aptlssAssessments)
          .where(inArray(aptlssAssessments.cardId, cardIds))
          .orderBy(desc(aptlssAssessments.assessedAt))
      : [];
    const latestAssessment = new Map<string, typeof assessments[number]>();
    assessments.forEach((assessment) => {
      if (!latestAssessment.has(assessment.cardId)) latestAssessment.set(assessment.cardId, assessment);
    });
    const stateMap = new Map(states.map((item) => [item.cardId, item]));
    const scoreMap = new Map(scores.map((item) => [item.cardId, item]));
    const waitingMap = new Map(waitingReasons.map((item) => [item.cardId, item]));

    return {
      cards: plans.map((plan) => {
        const planValue = parseJson<Record<string, unknown>>(plan.planJson, {});
        const state = stateMap.get(plan.cardId);
        const score = scoreMap.get(plan.cardId);
        const assessment = latestAssessment.get(plan.cardId);
        const cardSteps = steps.filter((step) => step.cardId === plan.cardId);
        const openRobertStep = cardSteps.find((step) => step.requiresRobert && step.status !== "complete") ?? null;
        const recommendations = assessment
          ? parseJson<string[]>(assessment.recommendationsJson, [])
          : Array.isArray(planValue.recommendations) ? planValue.recommendations.filter((item): item is string => typeof item === "string") : [];
        const nextBestAction = waitingMap.get(plan.cardId)?.nextAction ?? selectWorkQueueNextAction({
          planAction: typeof planValue.nextBestAction === "string" ? planValue.nextBestAction : typeof planValue.action === "string" ? planValue.action : null,
          primaryState: assessment?.primaryState ?? state?.state ?? null,
          actionability: assessment?.actionability ?? null,
          recommendations,
          openRobertStep,
        });
        return {
          cardId: plan.cardId,
          cardName: plan.cardName,
          cardUrl: plan.cardUrl,
          boardName: plan.boardName,
          listName: plan.listName,
          nextBestAction,
          planSummary: typeof planValue.summary === "string" ? planValue.summary : null,
          primaryState: assessment?.primaryState ?? state?.state ?? null,
          stateReason: assessment?.stateReason ?? state?.stateReason ?? null,
          actionability: assessment?.actionability ?? null,
          priorityScore: assessment?.priorityScore ?? score?.score ?? 0,
          priorityTier: assessment?.priorityTier ?? score?.tier ?? "MEDIUM",
          confidenceScore: assessment?.confidenceScore ?? (typeof planValue.confidenceScore === "number" ? planValue.confidenceScore : null),
          confidenceReason: assessment?.confidenceReason ?? (typeof planValue.confidenceReason === "string" ? planValue.confidenceReason : null),
          recommendations,
          uncertainties: assessment ? parseJson<string[]>(assessment.uncertaintiesJson, []) : [],
          waitingReason: waitingMap.get(plan.cardId) ?? null,
          steps: cardSteps.map((step) => ({
            id: step.id,
            stepNumber: step.stepNumber,
            title: step.title,
            status: step.status,
            category: step.category,
            requiresRobert: step.requiresRobert,
            completionCriteria: step.completionCriteria,
            riskIfSkipped: step.riskIfSkipped,
          })),
        };
      }),
    };
  }),

  interpretWaitingReason: workerMutation
    .input(z.object({
      reason: z.string().trim().min(3).max(4_000),
      cardId: z.string().optional(),
      cardName: z.string().optional(),
      boardName: z.string().optional(),
      listName: z.string().optional(),
      due: z.string().nullable().optional(),
    }))
    .mutation(({ input }) => interpretWaitingReason(input.reason, input)),

  recordWaitingReason: workerMutation
    .input(z.object({
      reason: z.string().trim().min(3).max(4_000),
      cardId: z.string().min(1),
      cardName: z.string().min(1),
      cardUrl: z.string(),
      boardName: z.string(),
      listName: z.string(),
      due: z.string().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const interpretation = interpretWaitingReason(input.reason, input);
      return recordAptlssWaitingReason({
        ...input,
        interpretation,
        recordedBy: String(ctx.user.openId),
      });
    }),

  getWaitingReasons: operatorProcedure.query(() => getActiveWaitingReasons()),
  getWaitingReason: operatorProcedure
    .input(z.object({ cardId: z.string() }))
    .query(({ input }) => getActiveWaitingReason(input.cardId)),
  getWaitingReasonHistory: operatorProcedure
    .input(z.object({ cardId: z.string(), limit: z.number().int().min(1).max(100).default(20) }))
    .query(({ input }) => getWaitingReasonHistory(input.cardId, input.limit)),
  resolveWaitingReason: workerMutation
    .input(z.object({ cardId: z.string() }))
    .mutation(({ input }) => resolveAptlssWaitingReason(input.cardId)),

  recordDecisionOutcome: workerMutation
    .input(z.object({ stepId: z.number().int().positive(), outcome: z.string().trim().min(3).max(5_000) }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await recordDecisionOutcome({ ...input, resolvedBy: String(ctx.user.openId) });
      } catch (error) {
        if (error instanceof DecisionOutcomeError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }
    }),
  getDecisionHistory: operatorProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(30) }).optional())
    .query(({ input }) => getDecisionHistory(input?.limit ?? 30)),

  getDailyPlan: operatorProcedure
    .input(z.object({ dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional())
    .query(({ input, ctx }) => getOperatorDailyPlan(Number(ctx.user.id), input?.dateKey)),
  generateDailyPlan: workerMutation
    .input(z.object({
      dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      force: z.boolean().default(false),
    }).optional())
    .mutation(({ input, ctx }) => generateOperatorDailyPlan(Number(ctx.user.id), input?.dateKey, input?.force ?? false)),
  updateDailyPlan: workerMutation
    .input(dailyPlanPayloadSchema)
    .mutation(({ input, ctx }) => updateOperatorDailyPlan(Number(ctx.user.id), input as OperatorDailyPlanPayload)),

  getBrowserTabStatus: operatorProcedure.query(() => getBrowserTabStatus()),
  getBrowserTabPolicy: operatorProcedure.query(() => getBrowserTabPolicy()),
  setBrowserTabPolicy: workerMutation
    .input(z.object({
      enabled: z.boolean().optional(),
      maxOpenTabs: z.number().int().min(0).max(50).optional(),
      warningMinutesBeforeEnd: z.number().int().min(0).max(240).optional(),
      staleAfterMinutes: z.number().int().min(2).max(120).optional(),
      includePinnedTabs: z.boolean().optional(),
    }))
    .mutation(({ input }) => setBrowserTabPolicy(input)),
  getBrowserCollectorToken: workerMutation.mutation(async () => ({
    token: await ensureBrowserTabCollectorToken(),
  })),
  getBrowserTabEvidenceHistory: operatorProcedure
    .input(z.object({ limit: z.number().int().min(1).max(366).default(30) }).optional())
    .query(({ input }) => getBrowserTabEvidenceHistory(input?.limit ?? 30)),
});
