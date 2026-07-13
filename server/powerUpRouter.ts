import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getLatestAssessment } from "./aptlssAssessmentDb";
import { getAptlssPlan } from "./aptlssDb";
import { getDoneGateStatus } from "./aptlssDoneGate";
import { generateAptlssPlanForCard } from "./aptlssPlanService";
import {
  getCardState,
  getCardStepProgress,
  getOpenStepsForCard,
  getPriorityScore,
  setStepCompletionByCardAndNumber,
} from "./aptlssStepsDb";
import { queueCardReassessment } from "./aptlssReassessment";
import { getActiveTimer, getDailyTimeSummary } from "./db";
import { startManagedTimer, stopManagedTimer } from "./timerService";
import { verifyPowerUpToken } from "./trelloPowerUpAuth";
import { dateKeySchema, timerStartInputSchema, trelloCardIdSchema } from "./validation";

const token = z.string().min(8).max(2_048);

export const powerUpRouter = router({
  getPlan: publicProcedure
    .input(z.object({ token, cardId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await verifyPowerUpToken(input.token);
      const [cached, steps, progress, state, score, assessment] = await Promise.all([
        getAptlssPlan(input.cardId),
        getOpenStepsForCard(input.cardId),
        getCardStepProgress(input.cardId),
        getCardState(input.cardId),
        getPriorityScore(input.cardId),
        getLatestAssessment(input.cardId),
      ]);
      if (!cached) return null;
      return {
        plan: JSON.parse(cached.planJson) as Record<string, unknown>,
        steps,
        progress,
        cardState: assessment?.primaryState ?? state?.state ?? null,
        cardStateReason: assessment?.stateReason ?? state?.stateReason ?? null,
        priorityScore: assessment?.priorityScore ?? score?.score ?? null,
        priorityTier: assessment?.priorityTier ?? score?.tier ?? null,
        generatedAt: cached.generatedAt,
      };
    }),

  generatePlan: publicProcedure
    .input(z.object({
      token,
      cardId: z.string().min(1),
      cardName: z.string().default(""),
      cardUrl: z.string().default(""),
      boardName: z.string().default(""),
      listName: z.string().default(""),
      forceRefresh: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      await verifyPowerUpToken(input.token);
      const { token: _token, ...planInput } = input;
      return generateAptlssPlanForCard({ ...planInput, syncChecklist: false });
    }),

  syncStep: publicProcedure
    .input(z.object({
      token,
      cardId: z.string().min(1),
      stepNumber: z.number().int().positive(),
      complete: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      await verifyPowerUpToken(input.token);
      const updated = await setStepCompletionByCardAndNumber(input.cardId, input.stepNumber, input.complete);
      if (!updated) throw new Error("The selected APTLSS step is no longer current");
      queueCardReassessment(input.cardId, "manual");
      return { success: true, progress: await getCardStepProgress(input.cardId) };
    }),

  doneGate: publicProcedure
    .input(z.object({ token, cardId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await verifyPowerUpToken(input.token);
      return getDoneGateStatus(input.cardId);
    }),

  timerState: publicProcedure
    .input(z.object({ token, cardId: trelloCardIdSchema, date: dateKeySchema }))
    .mutation(async ({ input }) => {
      await verifyPowerUpToken(input.token);
      const [active, summary] = await Promise.all([getActiveTimer(), getDailyTimeSummary(input.date)]);
      return {
        active,
        cardSummary: summary.find((entry) => entry.cardId === input.cardId) ?? null,
      };
    }),

  startTimer: publicProcedure
    .input(timerStartInputSchema.extend({ token }))
    .mutation(async ({ input }) => {
      await verifyPowerUpToken(input.token);
      return startManagedTimer(input);
    }),

  stopTimer: publicProcedure
    .input(z.object({ token, cardId: trelloCardIdSchema }))
    .mutation(async ({ input }) => {
      await verifyPowerUpToken(input.token);
      return stopManagedTimer(input.cardId);
    }),
});
