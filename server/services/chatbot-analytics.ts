/**
 * Chatbot Analytics Service
 * 
 * Aggregates and calculates analytics for the Trello chatbot.
 * Tracks command usage, response rates, and worker engagement.
 */

import { getDb } from '../db';
import { sql } from 'drizzle-orm';

export interface DailyAnalytics {
  date: string;
  totalCommands: number;
  commandBreakdown: Record<string, number>;
  successfulResponses: number;
  failedResponses: number;
  avgResponseTimeMs: number;
  checkinsSent: number;
  checkinsResponded: number;
  responseRate: number;
  avgCheckinResponseMinutes: number;
  uniqueWorkers: number;
  uniqueCards: number;
}

export interface WorkerEngagement {
  workerId: number;
  workerName: string;
  totalCheckins: number;
  responded: number;
  responseRate: number;
  avgResponseMinutes: number;
  lastActivity: Date | null;
}

export interface OverallStats {
  totalConversations: number;
  totalCommands: Record<string, number>;
  avgResponseTimeMs: number;
  totalCheckins: number;
  totalResponses: number;
  overallResponseRate: number;
  avgCheckinResponseMinutes: number;
  activeWorkers: number;
  activeCards: number;
  topCommands: Array<{ command: string; count: number }>;
}

/**
 * Get analytics for a specific date
 */
export async function getDailyAnalytics(date: Date): Promise<DailyAnalytics | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const dateStr = date.toISOString().split('T')[0];
    const startOfDay = new Date(dateStr);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Get command stats
    const commandResult = await db.execute(sql`
      SELECT 
        command,
        COUNT(*) as count,
        SUM(CASE WHEN responseStatus = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN responseStatus = 'failed' THEN 1 ELSE 0 END) as failed,
        AVG(responseTimeMs) as avgResponseTime
      FROM chatbot_conversations
      WHERE receivedAt >= ${startOfDay} AND receivedAt < ${endOfDay}
      GROUP BY command
    `);
    const commandRows = (commandResult as any)[0] || [];

    // Get unique workers and cards
    const uniqueResult = await db.execute(sql`
      SELECT 
        COUNT(DISTINCT authorTrelloId) as uniqueWorkers,
        COUNT(DISTINCT cardTrelloId) as uniqueCards
      FROM chatbot_conversations
      WHERE receivedAt >= ${startOfDay} AND receivedAt < ${endOfDay}
    `);
    const uniqueRows = (uniqueResult as any)[0] || [];
    const uniqueData = uniqueRows[0] || {};

    // Get checkin stats
    const checkinResult = await db.execute(sql`
      SELECT 
        COUNT(*) as totalCheckins,
        SUM(CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END) as responded,
        AVG(r.responseTimeMinutes) as avgResponseMinutes
      FROM chatbot_conversations c
      LEFT JOIN chatbot_checkin_responses r ON c.id = r.conversationId
      WHERE c.command IN ('checkin', 'check', 'update')
        AND c.receivedAt >= ${startOfDay} AND c.receivedAt < ${endOfDay}
    `);
    const checkinRows = (checkinResult as any)[0] || [];
    const checkinData = checkinRows[0] || {};

    // Build command breakdown
    const commandBreakdown: Record<string, number> = {};
    let totalCommands = 0;
    let successfulResponses = 0;
    let failedResponses = 0;
    let totalResponseTime = 0;
    let responseCount = 0;

    for (const row of commandRows) {
      commandBreakdown[row.command] = Number(row.count);
      totalCommands += Number(row.count);
      successfulResponses += Number(row.successful);
      failedResponses += Number(row.failed);
      if (row.avgResponseTime) {
        totalResponseTime += Number(row.avgResponseTime) * Number(row.count);
        responseCount += Number(row.count);
      }
    }

    const totalCheckins = Number(checkinData.totalCheckins) || 0;
    const checkinsResponded = Number(checkinData.responded) || 0;

    return {
      date: dateStr,
      totalCommands,
      commandBreakdown,
      successfulResponses,
      failedResponses,
      avgResponseTimeMs: responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0,
      checkinsSent: totalCheckins,
      checkinsResponded,
      responseRate: totalCheckins > 0 ? Math.round((checkinsResponded / totalCheckins) * 100) : 0,
      avgCheckinResponseMinutes: Math.round(Number(checkinData.avgResponseMinutes) || 0),
      uniqueWorkers: Number(uniqueData.uniqueWorkers) || 0,
      uniqueCards: Number(uniqueData.uniqueCards) || 0,
    };
  } catch (error) {
    console.error('[ChatbotAnalytics] Error getting daily analytics:', error);
    return null;
  }
}

/**
 * Get analytics for a date range
 */
export async function getAnalyticsRange(
  startDate: Date,
  endDate: Date
): Promise<DailyAnalytics[]> {
  const analytics: DailyAnalytics[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const daily = await getDailyAnalytics(current);
    if (daily) {
      analytics.push(daily);
    }
    current.setDate(current.getDate() + 1);
  }

  return analytics;
}

/**
 * Get worker engagement metrics
 */
export async function getWorkerEngagement(
  days: number = 30
): Promise<WorkerEngagement[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await db.execute(sql`
      SELECT 
        r.workerId,
        r.workerName,
        COUNT(*) as totalCheckins,
        SUM(CASE WHEN r.responseReceivedAt IS NOT NULL THEN 1 ELSE 0 END) as responded,
        AVG(r.responseTimeMinutes) as avgResponseMinutes,
        MAX(r.responseReceivedAt) as lastActivity
      FROM chatbot_checkin_responses r
      WHERE r.checkinSentAt > ${cutoff}
        AND r.workerId IS NOT NULL
      GROUP BY r.workerId, r.workerName
      ORDER BY totalCheckins DESC
    `);

    const rows = (result as any)[0] || [];
    
    return rows.map((row: any) => ({
      workerId: row.workerId,
      workerName: row.workerName || 'Unknown',
      totalCheckins: Number(row.totalCheckins) || 0,
      responded: Number(row.responded) || 0,
      responseRate: row.totalCheckins > 0 
        ? Math.round((Number(row.responded) / Number(row.totalCheckins)) * 100) 
        : 0,
      avgResponseMinutes: Math.round(Number(row.avgResponseMinutes) || 0),
      lastActivity: row.lastActivity ? new Date(row.lastActivity) : null,
    }));
  } catch (error) {
    console.error('[ChatbotAnalytics] Error getting worker engagement:', error);
    return [];
  }
}

/**
 * Get overall statistics
 */
export async function getOverallStats(days: number = 30): Promise<OverallStats> {
  const db = await getDb();
  const defaultStats: OverallStats = {
    totalConversations: 0,
    totalCommands: {},
    avgResponseTimeMs: 0,
    totalCheckins: 0,
    totalResponses: 0,
    overallResponseRate: 0,
    avgCheckinResponseMinutes: 0,
    activeWorkers: 0,
    activeCards: 0,
    topCommands: [],
  };

  if (!db) return defaultStats;

  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get conversation stats
    const convResult = await db.execute(sql`
      SELECT 
        COUNT(*) as totalConversations,
        AVG(responseTimeMs) as avgResponseTime,
        COUNT(DISTINCT authorTrelloId) as activeWorkers,
        COUNT(DISTINCT cardTrelloId) as activeCards
      FROM chatbot_conversations
      WHERE receivedAt > ${cutoff}
    `);
    const convRows = (convResult as any)[0] || [];
    const convData = convRows[0] || {};

    // Get command breakdown
    const cmdResult = await db.execute(sql`
      SELECT command, COUNT(*) as count
      FROM chatbot_conversations
      WHERE receivedAt > ${cutoff}
      GROUP BY command
      ORDER BY count DESC
    `);
    const cmdRows = (cmdResult as any)[0] || [];

    const totalCommands: Record<string, number> = {};
    const topCommands: Array<{ command: string; count: number }> = [];
    
    for (const row of cmdRows) {
      totalCommands[row.command] = Number(row.count);
      topCommands.push({ command: row.command, count: Number(row.count) });
    }

    // Get checkin stats
    const checkinResult = await db.execute(sql`
      SELECT 
        COUNT(*) as totalCheckins,
        SUM(CASE WHEN responseReceivedAt IS NOT NULL THEN 1 ELSE 0 END) as totalResponses,
        AVG(responseTimeMinutes) as avgResponseMinutes
      FROM chatbot_checkin_responses
      WHERE checkinSentAt > ${cutoff}
    `);
    const checkinRows = (checkinResult as any)[0] || [];
    const checkinData = checkinRows[0] || {};

    const totalCheckins = Number(checkinData.totalCheckins) || 0;
    const totalResponses = Number(checkinData.totalResponses) || 0;

    return {
      totalConversations: Number(convData.totalConversations) || 0,
      totalCommands,
      avgResponseTimeMs: Math.round(Number(convData.avgResponseTime) || 0),
      totalCheckins,
      totalResponses,
      overallResponseRate: totalCheckins > 0 
        ? Math.round((totalResponses / totalCheckins) * 100) 
        : 0,
      avgCheckinResponseMinutes: Math.round(Number(checkinData.avgResponseMinutes) || 0),
      activeWorkers: Number(convData.activeWorkers) || 0,
      activeCards: Number(convData.activeCards) || 0,
      topCommands: topCommands.slice(0, 5),
    };
  } catch (error) {
    console.error('[ChatbotAnalytics] Error getting overall stats:', error);
    return defaultStats;
  }
}

/**
 * Update daily analytics rollup (called at end of day)
 */
export async function updateDailyRollup(date: Date): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const analytics = await getDailyAnalytics(date);
    if (!analytics) return;

    // Upsert into chatbot_analytics table
    await db.execute(sql`
      INSERT INTO chatbot_analytics (
        date, totalCommands, statusCommands, checkinCommands, remindCommands,
        timeCommands, progressCommands, helpCommands, unknownCommands,
        successfulResponses, failedResponses, avgResponseTimeMs,
        checkinsSent, checkinsResponded, avgCheckinResponseMinutes,
        uniqueWorkers, uniqueCards
      ) VALUES (
        ${date},
        ${analytics.totalCommands},
        ${analytics.commandBreakdown['status'] || 0},
        ${(analytics.commandBreakdown['checkin'] || 0) + (analytics.commandBreakdown['check'] || 0) + (analytics.commandBreakdown['update'] || 0)},
        ${(analytics.commandBreakdown['remind'] || 0) + (analytics.commandBreakdown['reminder'] || 0) + (analytics.commandBreakdown['ping'] || 0)},
        ${(analytics.commandBreakdown['time'] || 0) + (analytics.commandBreakdown['timer'] || 0) + (analytics.commandBreakdown['hours'] || 0)},
        ${(analytics.commandBreakdown['progress'] || 0) + (analytics.commandBreakdown['report'] || 0)},
        ${(analytics.commandBreakdown['help'] || 0) + (analytics.commandBreakdown['?'] || 0)},
        ${Object.entries(analytics.commandBreakdown)
          .filter(([cmd]) => !['status', 'checkin', 'check', 'update', 'remind', 'reminder', 'ping', 'time', 'timer', 'hours', 'progress', 'report', 'help', '?'].includes(cmd))
          .reduce((sum, [, count]) => sum + count, 0)},
        ${analytics.successfulResponses},
        ${analytics.failedResponses},
        ${analytics.avgResponseTimeMs},
        ${analytics.checkinsSent},
        ${analytics.checkinsResponded},
        ${analytics.avgCheckinResponseMinutes},
        ${analytics.uniqueWorkers},
        ${analytics.uniqueCards}
      )
      ON DUPLICATE KEY UPDATE
        totalCommands = VALUES(totalCommands),
        statusCommands = VALUES(statusCommands),
        checkinCommands = VALUES(checkinCommands),
        remindCommands = VALUES(remindCommands),
        timeCommands = VALUES(timeCommands),
        progressCommands = VALUES(progressCommands),
        helpCommands = VALUES(helpCommands),
        unknownCommands = VALUES(unknownCommands),
        successfulResponses = VALUES(successfulResponses),
        failedResponses = VALUES(failedResponses),
        avgResponseTimeMs = VALUES(avgResponseTimeMs),
        checkinsSent = VALUES(checkinsSent),
        checkinsResponded = VALUES(checkinsResponded),
        avgCheckinResponseMinutes = VALUES(avgCheckinResponseMinutes),
        uniqueWorkers = VALUES(uniqueWorkers),
        uniqueCards = VALUES(uniqueCards),
        updatedAt = NOW()
    `);

    console.log(`[ChatbotAnalytics] Updated daily rollup for ${analytics.date}`);
  } catch (error) {
    console.error('[ChatbotAnalytics] Error updating daily rollup:', error);
  }
}

export default {
  getDailyAnalytics,
  getAnalyticsRange,
  getWorkerEngagement,
  getOverallStats,
  updateDailyRollup,
};
