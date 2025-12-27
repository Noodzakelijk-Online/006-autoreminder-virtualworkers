/**
 * Chatbot Conversation History Service
 * 
 * Stores and retrieves conversation history for the Trello chatbot.
 * Tracks commands, responses, and worker engagement.
 */

import { getDb } from '../db';
import { sql } from 'drizzle-orm';
import { BotCommand, BotResponse } from './trello-chatbot';

export interface ConversationRecord {
  id?: number;
  cardTrelloId: string;
  cardName?: string;
  boardTrelloId?: string;
  command: string;
  commandArgs?: string[];
  authorTrelloId?: string;
  authorName?: string;
  incomingCommentId?: string;
  responseCommentId?: string;
  responseText?: string;
  responseStatus: 'success' | 'failed' | 'pending';
  responseError?: string;
  receivedAt: Date;
  respondedAt?: Date;
  responseTimeMs?: number;
}

export interface CheckinResponseRecord {
  conversationId: number;
  cardTrelloId: string;
  workerTrelloId?: string;
  workerName?: string;
  workerId?: number;
  responseCommentId?: string;
  responseText?: string;
  reportedProgress?: string;
  reportedBlockers?: string;
  estimatedCompletion?: string;
  checkinSentAt: Date;
  responseReceivedAt: Date;
  responseTimeMinutes?: number;
}

/**
 * Store a conversation record
 */
export async function storeConversation(record: ConversationRecord): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.execute(sql`
      INSERT INTO chatbot_conversations (
        cardTrelloId, cardName, boardTrelloId, command, commandArgs,
        authorTrelloId, authorName, incomingCommentId, responseCommentId,
        responseText, responseStatus, responseError, receivedAt, respondedAt, responseTimeMs
      ) VALUES (
        ${record.cardTrelloId},
        ${record.cardName || null},
        ${record.boardTrelloId || null},
        ${record.command},
        ${record.commandArgs ? JSON.stringify(record.commandArgs) : null},
        ${record.authorTrelloId || null},
        ${record.authorName || null},
        ${record.incomingCommentId || null},
        ${record.responseCommentId || null},
        ${record.responseText || null},
        ${record.responseStatus},
        ${record.responseError || null},
        ${record.receivedAt},
        ${record.respondedAt || null},
        ${record.responseTimeMs || null}
      )
    `);

    // Get the inserted ID
    const idResult = await db.execute(sql`SELECT LAST_INSERT_ID() as id`);
    const rows = (idResult as any)[0] || [];
    return rows[0]?.id || null;
  } catch (error) {
    console.error('[ChatbotHistory] Error storing conversation:', error);
    return null;
  }
}

/**
 * Update a conversation with response details
 */
export async function updateConversationResponse(
  conversationId: number,
  responseCommentId: string,
  responseText: string,
  status: 'success' | 'failed',
  error?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const respondedAt = new Date();
    
    // Get the received time to calculate response time
    const convResult = await db.execute(sql`
      SELECT receivedAt FROM chatbot_conversations WHERE id = ${conversationId}
    `);
    const rows = (convResult as any)[0] || [];
    const receivedAt = rows[0]?.receivedAt;
    
    const responseTimeMs = receivedAt 
      ? respondedAt.getTime() - new Date(receivedAt).getTime()
      : null;

    await db.execute(sql`
      UPDATE chatbot_conversations SET
        responseCommentId = ${responseCommentId},
        responseText = ${responseText},
        responseStatus = ${status},
        responseError = ${error || null},
        respondedAt = ${respondedAt},
        responseTimeMs = ${responseTimeMs}
      WHERE id = ${conversationId}
    `);
  } catch (error) {
    console.error('[ChatbotHistory] Error updating conversation response:', error);
  }
}

/**
 * Store a check-in response from a worker
 */
export async function storeCheckinResponse(record: CheckinResponseRecord): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const responseTimeMinutes = record.responseTimeMinutes || 
      Math.round((record.responseReceivedAt.getTime() - record.checkinSentAt.getTime()) / 60000);

    const result = await db.execute(sql`
      INSERT INTO chatbot_checkin_responses (
        conversationId, cardTrelloId, workerTrelloId, workerName, workerId,
        responseCommentId, responseText, reportedProgress, reportedBlockers,
        estimatedCompletion, checkinSentAt, responseReceivedAt, responseTimeMinutes
      ) VALUES (
        ${record.conversationId},
        ${record.cardTrelloId},
        ${record.workerTrelloId || null},
        ${record.workerName || null},
        ${record.workerId || null},
        ${record.responseCommentId || null},
        ${record.responseText || null},
        ${record.reportedProgress || null},
        ${record.reportedBlockers || null},
        ${record.estimatedCompletion || null},
        ${record.checkinSentAt},
        ${record.responseReceivedAt},
        ${responseTimeMinutes}
      )
    `);

    const idResult = await db.execute(sql`SELECT LAST_INSERT_ID() as id`);
    const rows = (idResult as any)[0] || [];
    return rows[0]?.id || null;
  } catch (error) {
    console.error('[ChatbotHistory] Error storing checkin response:', error);
    return null;
  }
}

/**
 * Get recent conversations for a card
 */
export async function getCardConversations(
  cardTrelloId: string,
  limit: number = 10
): Promise<ConversationRecord[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db.execute(sql`
      SELECT * FROM chatbot_conversations
      WHERE cardTrelloId = ${cardTrelloId}
      ORDER BY receivedAt DESC
      LIMIT ${limit}
    `);
    return (result as any)[0] || [];
  } catch (error) {
    console.error('[ChatbotHistory] Error getting card conversations:', error);
    return [];
  }
}

/**
 * Get conversations by author
 */
export async function getAuthorConversations(
  authorTrelloId: string,
  limit: number = 50
): Promise<ConversationRecord[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db.execute(sql`
      SELECT * FROM chatbot_conversations
      WHERE authorTrelloId = ${authorTrelloId}
      ORDER BY receivedAt DESC
      LIMIT ${limit}
    `);
    return (result as any)[0] || [];
  } catch (error) {
    console.error('[ChatbotHistory] Error getting author conversations:', error);
    return [];
  }
}

/**
 * Get check-in responses for a worker
 */
export async function getWorkerCheckinResponses(
  workerId: number,
  limit: number = 50
): Promise<CheckinResponseRecord[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db.execute(sql`
      SELECT * FROM chatbot_checkin_responses
      WHERE workerId = ${workerId}
      ORDER BY responseReceivedAt DESC
      LIMIT ${limit}
    `);
    return (result as any)[0] || [];
  } catch (error) {
    console.error('[ChatbotHistory] Error getting worker checkin responses:', error);
    return [];
  }
}

/**
 * Get pending check-ins (sent but not yet responded to)
 */
export async function getPendingCheckins(
  maxAgeHours: number = 24
): Promise<Array<{
  conversationId: number;
  cardTrelloId: string;
  authorName: string;
  receivedAt: Date;
}>> {
  const db = await getDb();
  if (!db) return [];

  try {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    const result = await db.execute(sql`
      SELECT c.id as conversationId, c.cardTrelloId, c.authorName, c.receivedAt
      FROM chatbot_conversations c
      LEFT JOIN chatbot_checkin_responses r ON c.id = r.conversationId
      WHERE c.command IN ('checkin', 'check', 'update')
        AND c.responseStatus = 'success'
        AND c.receivedAt > ${cutoff}
        AND r.id IS NULL
      ORDER BY c.receivedAt ASC
    `);
    return (result as any)[0] || [];
  } catch (error) {
    console.error('[ChatbotHistory] Error getting pending checkins:', error);
    return [];
  }
}

/**
 * Calculate response rate for a worker
 */
export async function getWorkerResponseRate(
  workerId: number,
  days: number = 30
): Promise<{
  totalCheckins: number;
  responded: number;
  responseRate: number;
  avgResponseMinutes: number;
}> {
  const db = await getDb();
  if (!db) {
    return { totalCheckins: 0, responded: 0, responseRate: 0, avgResponseMinutes: 0 };
  }

  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as totalCheckins,
        SUM(CASE WHEN responseReceivedAt IS NOT NULL THEN 1 ELSE 0 END) as responded,
        AVG(responseTimeMinutes) as avgResponseMinutes
      FROM chatbot_checkin_responses
      WHERE workerId = ${workerId}
        AND checkinSentAt > ${cutoff}
    `);
    
    const rows = (result as any)[0] || [];
    const data = rows[0] || {};
    
    const totalCheckins = Number(data.totalCheckins) || 0;
    const responded = Number(data.responded) || 0;
    const avgResponseMinutes = Number(data.avgResponseMinutes) || 0;
    
    return {
      totalCheckins,
      responded,
      responseRate: totalCheckins > 0 ? (responded / totalCheckins) * 100 : 0,
      avgResponseMinutes: Math.round(avgResponseMinutes),
    };
  } catch (error) {
    console.error('[ChatbotHistory] Error calculating worker response rate:', error);
    return { totalCheckins: 0, responded: 0, responseRate: 0, avgResponseMinutes: 0 };
  }
}

/**
 * Get command usage statistics
 */
export async function getCommandStats(
  days: number = 30
): Promise<Record<string, number>> {
  const db = await getDb();
  if (!db) return {};

  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const result = await db.execute(sql`
      SELECT command, COUNT(*) as count
      FROM chatbot_conversations
      WHERE receivedAt > ${cutoff}
      GROUP BY command
      ORDER BY count DESC
    `);
    
    const rows = (result as any)[0] || [];
    const stats: Record<string, number> = {};
    
    for (const row of rows) {
      stats[row.command] = Number(row.count);
    }
    
    return stats;
  } catch (error) {
    console.error('[ChatbotHistory] Error getting command stats:', error);
    return {};
  }
}

/**
 * Helper to create conversation record from bot command
 */
export function createConversationFromCommand(cmd: BotCommand): ConversationRecord {
  return {
    cardTrelloId: cmd.cardId,
    command: cmd.command,
    commandArgs: cmd.args,
    authorTrelloId: cmd.authorId,
    authorName: cmd.authorName,
    incomingCommentId: cmd.commentId,
    responseStatus: 'pending',
    receivedAt: new Date(),
  };
}

export default {
  storeConversation,
  updateConversationResponse,
  storeCheckinResponse,
  getCardConversations,
  getAuthorConversations,
  getWorkerCheckinResponses,
  getPendingCheckins,
  getWorkerResponseRate,
  getCommandStats,
  createConversationFromCommand,
};
