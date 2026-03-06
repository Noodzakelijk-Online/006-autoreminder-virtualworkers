/**
 * Interview Persistence Service
 * 
 * Manages interview sessions with database persistence instead of in-memory storage.
 * Supports all ATIS phases (1-10) with comprehensive state tracking.
 */

import { getDb } from '../db';
import { 
  interviewSessions, 
  interviewHistory, 
  interviewResults,
  type InsertInterviewSession,
  type InsertInterviewHistory,
  type InsertInterviewResult,
} from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

interface InterviewState {
  phase: number;
  currentQuestion: number;
  questionsAsked: number;
  responsesProvided: number;
  overallConfidence: number;
  preAnalysisSummary?: string;
  responses: Map<string, string>;
  validationScores: Map<string, number>;
}

interface InterviewQuestion {
  phase: number;
  questionNumber: number;
  question: string;
  validationType: 'specificity' | 'measurable' | 'actionable' | 'complete';
}

/**
 * Create a new interview session
 */
export async function createInterviewSession(
  cardId: string,
  userId: number,
  userOpenId: string,
  preAnalysisSummary?: string
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  const sessionId = uuidv4();
  const initialState: InterviewState = {
    phase: 1,
    currentQuestion: 0,
    questionsAsked: 0,
    responsesProvided: 0,
    overallConfidence: 0,
    preAnalysisSummary,
    responses: new Map(),
    validationScores: new Map(),
  };

  const session: InsertInterviewSession = {
    id: sessionId,
    cardId,
    userId,
    userOpenId,
    status: 'active',
    currentPhase: 1,
    currentQuestion: 0,
    preAnalysisSummary,
    questionsAsked: 0,
    responsesProvided: 0,
    overallConfidence: 0,
    sessionData: JSON.stringify(initialState),
  };

  await db.insert(interviewSessions).values(session);
  return sessionId;
}

/**
 * Get interview session
 */
export async function getInterviewSession(sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  const [session] = await db.select()
    .from(interviewSessions)
    .where(eq(interviewSessions.id, sessionId))
    .limit(1);

  return session;
}

/**
 * Update interview session with new response
 */
export async function recordInterviewResponse(
  sessionId: string,
  phase: number,
  questionNumber: number,
  question: string,
  response: string,
  isValid: boolean,
  validationScore: number,
  validationNotes?: string,
  confidenceScore?: number,
  requiresEscalation?: boolean
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  // Record in history
  const historyId = uuidv4();
  
  // Get session to populate missing fields
  const session = await getInterviewSession(sessionId);
  if (!session) throw new Error('Session not found');

  const history: InsertInterviewHistory = {
    id: historyId,
    sessionId,
    cardId: session.cardId,
    userId: session.userId,
    userOpenId: session.userOpenId,
    phase,
    questionNumber,
    question,
    response,
    isValid: isValid ? 1 : 0,
    validationScore,
    validationNotes,
    confidenceScore: confidenceScore || 0,
    requiresEscalation: requiresEscalation ? 1 : 0,
  };

  await db.insert(interviewHistory).values(history);

  // Update session
  const currentState = session.sessionData ? JSON.parse(session.sessionData) : {};
  const updatedState = {
    ...currentState,
    currentPhase: phase,
    currentQuestion: questionNumber + 1,
    questionsAsked: (currentState.questionsAsked || 0) + 1,
    responsesProvided: (currentState.responsesProvided || 0) + 1,
    overallConfidence: confidenceScore || currentState.overallConfidence,
  };

  await db.update(interviewSessions)
    .set({
      currentPhase: phase,
      currentQuestion: questionNumber + 1,
      questionsAsked: (session.questionsAsked || 0) + 1,
      responsesProvided: (session.responsesProvided || 0) + 1,
      overallConfidence: confidenceScore || session.overallConfidence,
      sessionData: JSON.stringify(updatedState),
      updatedAt: new Date(),
    })
    .where(eq(interviewSessions.id, sessionId));
}

/**
 * Complete interview and save results
 */
export async function completeInterview(
  sessionId: string,
  finalGoal: string,
  finalDeliverable: string,
  finalAPTLSSChecklist: any[],
  finalConfidence: number,
  clarityScore: number,
  completenessScore: number,
  executionPlan?: any,
  estimatedDuration?: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  const session = await getInterviewSession(sessionId);
  if (!session) throw new Error('Session not found');

  // Get all history for this session to calculate metrics
  const history = await db.select()
    .from(interviewHistory)
    .where(eq(interviewHistory.sessionId, sessionId));

  const resultId = uuidv4();
  const result: InsertInterviewResult = {
    id: resultId,
    sessionId,
    cardId: session.cardId,
    userId: session.userId,
    userOpenId: session.userOpenId,
    finalGoal,
    finalDeliverable,
    finalAPTLSSChecklist: JSON.stringify(finalAPTLSSChecklist),
    finalConfidence,
    clarityScore,
    completenessScore,
    executionPlan: executionPlan ? JSON.stringify(executionPlan) : null,
    estimatedDuration,
    totalQuestionsAsked: history.length,
    totalResponsesProvided: history.filter(h => h.response).length,
    escalationsRequired: history.filter(h => h.requiresEscalation).length,
    completedAt: new Date(),
  };

  await db.insert(interviewResults).values(result);

  // Update session status
  await db.update(interviewSessions)
    .set({
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(interviewSessions.id, sessionId));
}

/**
 * Get interview history for a session
 */
export async function getInterviewHistory(sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  return db.select()
    .from(interviewHistory)
    .where(eq(interviewHistory.sessionId, sessionId));
}

/**
 * Get interview results
 */
export async function getInterviewResults(sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  const [result] = await db.select()
    .from(interviewResults)
    .where(eq(interviewResults.sessionId, sessionId))
    .limit(1);

  return result;
}

/**
 * Get all interview sessions for a user
 */
export async function getUserInterviewSessions(userOpenId: string) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  return db.select()
    .from(interviewSessions)
    .where(eq(interviewSessions.userOpenId, userOpenId));
}

/**
 * Get all interview sessions for a card
 */
export async function getCardInterviewSessions(cardId: string) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  return db.select()
    .from(interviewSessions)
    .where(eq(interviewSessions.cardId, cardId));
}

/**
 * Abandon interview session
 */
export async function abandonInterviewSession(sessionId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  await db.update(interviewSessions)
    .set({
      status: 'abandoned',
      updatedAt: new Date(),
    })
    .where(eq(interviewSessions.id, sessionId));
}

/**
 * Get interview statistics for a user
 */
export async function getUserInterviewStats(userOpenId: string) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  const sessions = await db.select()
    .from(interviewSessions)
    .where(eq(interviewSessions.userOpenId, userOpenId));

  const completedSessions = sessions.filter(s => s.status === 'completed');
  const totalConfidence = completedSessions.reduce((sum, s) => sum + (s.overallConfidence || 0), 0);
  const avgConfidence = completedSessions.length > 0 ? totalConfidence / completedSessions.length : 0;

  return {
    totalSessions: sessions.length,
    completedSessions: completedSessions.length,
    activeSessions: sessions.filter(s => s.status === 'active').length,
    abandonedSessions: sessions.filter(s => s.status === 'abandoned').length,
    averageConfidence: Math.round(avgConfidence),
    totalQuestionsAsked: sessions.reduce((sum, s) => sum + (s.questionsAsked || 0), 0),
  };
}
