import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { analyzeCardBeforeInterview } from '../services/pre-interview-analysis';
import { startInterview, processResponse } from '../services/conversational-interview';
const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;

// Store interview states in memory (in production, use Redis or database)
const interviewStates = new Map<string, any>();

// Helper to get Trello card with all details
async function getTrelloCard(cardId: string) {
  const cardResponse = await fetch(
    `https://api.trello.com/1/cards/${cardId}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&attachments=true&checklists=all`
  );
  
  if (!cardResponse.ok) {
    throw new Error(`Failed to fetch card: ${cardResponse.statusText}`);
  }
  
  const card = await cardResponse.json();
  
  // Get comments
  const actionsResponse = await fetch(
    `https://api.trello.com/1/cards/${cardId}/actions?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&filter=commentCard`
  );
  
  const comments = actionsResponse.ok ? await actionsResponse.json() : [];
  
  return {
    ...card,
    comments,
  };
}

export const interviewRouter = router({
  /**
   * Start a new interview for a card
   */
  start: publicProcedure
    .input(z.object({
      cardId: z.string(),
    }))
    .mutation(async ({ input }: { input: { cardId: string } }) => {
      const { cardId } = input;

      // Get card data from Trello
      const card = await getTrelloCard(cardId);
      if (!card) {
        throw new Error('Card not found');
      }

      // Perform pre-interview analysis
      const preAnalysis = await analyzeCardBeforeInterview(card);

      // Start interview
      const { state, firstMessage } = await startInterview(card.name, preAnalysis);

      // Store state
      interviewStates.set(cardId, { state, preAnalysis });

      return {
        firstMessage,
        confidence: state.overallConfidence,
        preAnalysisSummary: preAnalysis.summary,
      };
    }),

  /**
   * Process user response and get next question
   */
  respond: publicProcedure
    .input(z.object({
      cardId: z.string(),
      response: z.string(),
    }))
    .mutation(async ({ input }: { input: { cardId: string; response: string } }) => {
      const { cardId, response } = input;

      // Get stored state
      const stored = interviewStates.get(cardId);
      if (!stored) {
        throw new Error('Interview not found. Please start a new interview.');
      }

      const { state, preAnalysis } = stored;

      // Process response
      const result = await processResponse(state, response, preAnalysis);

      // Update stored state
      interviewStates.set(cardId, { state, preAnalysis });

      // If complete, clean up state after returning result
      if (result.isComplete) {
        setTimeout(() => {
          interviewStates.delete(cardId);
        }, 5000);
      }

      return {
        nextMessage: result.nextMessage,
        isComplete: result.isComplete,
        finalGoal: result.finalGoal,
        confidence: state.overallConfidence,
      };
    }),

  /**
   * Get current interview state
   */
  getState: publicProcedure
    .input(z.object({
      cardId: z.string(),
    }))
    .query(async ({ input }: { input: { cardId: string } }) => {
      const { cardId } = input;

      const stored = interviewStates.get(cardId);
      if (!stored) {
        return null;
      }

      const { state } = stored;

      return {
        messages: state.messages,
        confidence: state.overallConfidence,
        isComplete: state.isComplete,
      };
    }),

  /**
   * Cancel interview
   */
  cancel: publicProcedure
    .input(z.object({
      cardId: z.string(),
    }))
    .mutation(async ({ input }: { input: { cardId: string } }) => {
      const { cardId } = input;
      interviewStates.delete(cardId);
      return { success: true };
    }),
});
