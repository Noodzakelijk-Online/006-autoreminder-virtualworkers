import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import {
  fetchExecutionPlanFromTrello,
  storeExecutionPlan,
  getExecutionPlan,
  getExecutionPlanByCardId,
  updateStepStatus,
  calculateBlockedSteps,
  validateExecutionPlanSchema
} from '../services/executionPlanService';
import { generateExecutionPlanFromCard } from '../services/executionPlanGenerator';
import { ENV } from '../_core/env';

// Zod schemas for validation
const TimeEstimateSchema = z.object({
  min: z.number().positive(),
  max: z.number().positive(),
});

const StepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  dependencies: z.array(z.string()),
  parallelizable: z.boolean(),
  timeEstimate: TimeEstimateSchema,
  risks: z.array(z.string()),
});

const IterationFlowSchema = z.object({
  loopName: z.string(),
  steps: z.array(z.string()),
});

const ExecutionPlanSchema = z.object({
  overview: z.object({
    objective: z.string(),
    inputs: z.array(z.string()),
    outputs: z.array(z.string()),
  }),
  steps: z.array(StepSchema),
  iterationFlows: z.array(IterationFlowSchema),
  totalEstimate: TimeEstimateSchema,
});

export const executionPlanRouter = router({
  // Fetch ExecutionPlan from Trello card
  fetchFromTrello: protectedProcedure
    .input(z.object({ cardId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Get Trello API credentials from context or environment
        const trelloApiKey = process.env.TRELLO_API_KEY || '';
        const trelloToken = process.env.TRELLO_TOKEN || '';
        
        if (!trelloApiKey || !trelloToken) {
          return { success: false, error: 'Trello API credentials not configured' };
        }
        
        const plan = await fetchExecutionPlanFromTrello(
          input.cardId,
          trelloApiKey,
          trelloToken
        );

        if (!plan) {
          return { success: false, error: 'No ExecutionPlan found in card description' };
        }

        // Store in database
        const planId = await storeExecutionPlan(input.cardId, ctx.user.id, plan, 'manual');

        return { success: true, planId, plan };
      } catch (error) {
        console.error('Error fetching ExecutionPlan from Trello:', error);
        return { success: false, error: (error as Error).message };
      }
    }),

  // Generate ExecutionPlan using AI
  generateFromCard: protectedProcedure
    .input(z.object({
      cardId: z.string(),
      cardTitle: z.string(),
      cardDescription: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await generateExecutionPlanFromCard(input.cardTitle, input.cardDescription);

        if (!result.success) {
          return { success: false, error: result.error };
        }

        // Store in database
        const planId = await storeExecutionPlan(input.cardId, ctx.user.id, result.plan, 'ai');

        return { success: true, planId, plan: result.plan };
      } catch (error) {
        console.error('Error generating ExecutionPlan:', error);
        return { success: false, error: (error as Error).message };
      }
    }),

  // Get ExecutionPlan by ID
  getById: protectedProcedure
    .input(z.object({ planId: z.string() }))
    .query(async ({ input }) => {
      try {
        const plan = await getExecutionPlan(input.planId);
        if (!plan) {
          return { success: false, error: 'ExecutionPlan not found' };
        }
        return { success: true, plan };
      } catch (error) {
        console.error('Error fetching ExecutionPlan:', error);
        return { success: false, error: (error as Error).message };
      }
    }),

  // Get ExecutionPlan by Card ID
  getByCardId: protectedProcedure
    .input(z.object({ cardId: z.string() }))
    .query(async ({ input }) => {
      try {
        const plan = await getExecutionPlanByCardId(input.cardId);
        if (!plan) {
          return { success: false, error: 'ExecutionPlan not found for this card' };
        }
        return { success: true, plan };
      } catch (error) {
        console.error('Error fetching ExecutionPlan by cardId:', error);
        return { success: false, error: (error as Error).message };
      }
    }),

  // Update step status
  updateStepStatus: protectedProcedure
    .input(z.object({
      stepId: z.string(),
      executionPlanId: z.string(),
      newStatus: z.enum(['completed', 'in-progress', 'ready', 'blocked']),
      reason: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await updateStepStatus(
          input.stepId,
          input.executionPlanId,
          input.newStatus,
          ctx.user.id,
          input.reason
        );

        // Calculate blocked steps after status update
        const blockedSteps = await calculateBlockedSteps(input.executionPlanId);

        return { success: true, result, blockedSteps };
      } catch (error) {
        console.error('Error updating step status:', error);
        return { success: false, error: (error as Error).message };
      }
    }),

  // Get blocked steps
  getBlockedSteps: protectedProcedure
    .input(z.object({ executionPlanId: z.string() }))
    .query(async ({ input }) => {
      try {
        const blockedSteps = await calculateBlockedSteps(input.executionPlanId);
        return { success: true, blockedSteps };
      } catch (error) {
        console.error('Error calculating blocked steps:', error);
        return { success: false, error: (error as Error).message };
      }
    }),

  // Validate ExecutionPlan JSON
  validateSchema: publicProcedure
    .input(z.object({ plan: z.any() }))
    .query(({ input }) => {
      try {
        const validation = validateExecutionPlanSchema(input.plan);
        return { success: validation.valid, errors: validation.errors };
      } catch (error) {
        console.error('Error validating ExecutionPlan:', error);
        return { success: false, errors: [(error as Error).message] };
      }
    })
});
