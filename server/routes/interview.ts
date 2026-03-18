import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { analyzeCardBeforeInterview } from '../services/pre-interview-analysis';
import { startInterview, processResponse } from '../services/conversational-interview';
import {
  createInterviewSession,
  getCardInterviewSessions,
  getInterviewSession,
  updateInterviewSessionState,
  recordInterviewResponse,
  completeInterview,
} from '../services/interview-persistence';
const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;

// In-memory cache is kept only as a short-lived convenience layer.
const interviewStates = new Map<string, { sessionId: string; state: any; preAnalysis: any }>();

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
    .mutation(async ({ input, ctx }) => {
      const { cardId } = input;
      const user = ctx.user;
      if (!user) {
        throw new Error('Unauthorized');
      }

      // Get card data from Trello
      const card = await getTrelloCard(cardId);
      if (!card) {
        throw new Error('Card not found');
      }

      // Perform pre-interview analysis
      const preAnalysis = await analyzeCardBeforeInterview(card);

      // Create persistent interview session
      const sessionId = await createInterviewSession(cardId, user.id, user.openId, preAnalysis.summary);

      // Start interview
      const { state, firstMessage } = await startInterview(card.name, preAnalysis);

      await updateInterviewSessionState(sessionId, {
        currentPhase: 1,
        currentQuestion: 0,
        questionsAsked: 0,
        responsesProvided: 0,
        overallConfidence: state.overallConfidence,
        preAnalysisSummary: preAnalysis.summary,
        sessionData: state,
        status: 'active',
      });

      // Store state
      interviewStates.set(cardId, { sessionId, state, preAnalysis });

      return {
        sessionId,
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
      sessionId: z.string().optional(),
      response: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { cardId, response, sessionId: providedSessionId } = input;
      const user = ctx.user;
      if (!user) {
        throw new Error('Unauthorized');
      }

      // Get stored state
      let stored = providedSessionId
        ? Array.from(interviewStates.values()).find(entry => entry.sessionId === providedSessionId)
        : interviewStates.get(cardId);

      let session = null as any;
      if (!stored) {
        const sessions = await getCardInterviewSessions(cardId);
        session = sessions
          .filter((s: any) => s.userOpenId === user.openId && s.status === 'active')
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;

        if (!session) {
          throw new Error('Interview not found. Please start a new interview.');
        }

        const sessionState = session.sessionData ? JSON.parse(session.sessionData) : null;
        if (!sessionState) {
          throw new Error('Interview state not found. Please restart the interview.');
        }

        stored = { sessionId: session.id, state: sessionState, preAnalysis: null };
        interviewStates.set(cardId, stored);
      } else {
        session = await getInterviewSession(stored.sessionId);
      }

      if (!session) {
        session = await getInterviewSession(stored.sessionId);
      }

      if (!session) {
        throw new Error('Interview session not found.');
      }

      const { state } = stored;

      const card = await getTrelloCard(cardId);
      const preAnalysis = await analyzeCardBeforeInterview(card);

      // Process response
      const result = await processResponse(state, response, preAnalysis);

      // Update stored state
      interviewStates.set(cardId, { sessionId: stored.sessionId, state, preAnalysis });

      const latestQuestion = state.messages[state.messages.length - 2]?.content || '';
      const questionNumber = Math.max(0, state.validations.length - 1);

      await recordInterviewResponse(
        stored.sessionId,
        session.currentPhase || 1,
        questionNumber,
        latestQuestion,
        response,
        true,
        75,
        undefined,
        state.overallConfidence,
        false,
        state
      );

      await updateInterviewSessionState(stored.sessionId, {
        currentPhase: session.currentPhase || 1,
        currentQuestion: state.messages.length,
        questionsAsked: state.validations.length,
        responsesProvided: state.validations.length,
        overallConfidence: state.overallConfidence,
        preAnalysisSummary: preAnalysis.summary,
        sessionData: state,
        status: 'active',
      });

      // If complete, clean up state after returning result
      if (result.isComplete) {
        if (result.finalGoal) {
          await completeInterview(
            stored.sessionId,
            result.finalGoal.goal || '',
            result.finalGoal.successCriteria?.join('; ') || '',
            [],
            result.finalGoal.confidence || 0,
            0,
            0,
            result.finalGoal,
            0
          );
        }

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
        const sessions = await getCardInterviewSessions(cardId);
        const session = sessions.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        if (!session) {
          return null;
        }

        const state = session.sessionData ? JSON.parse(session.sessionData) : null;
        if (!state) return null;

        return {
          messages: state.messages || [],
          confidence: state.overallConfidence || 0,
          isComplete: state.isComplete || session.status === 'completed',
        };
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
