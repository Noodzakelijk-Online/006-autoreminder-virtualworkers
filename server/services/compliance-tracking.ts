/**
 * Compliance Tracking Service
 * 
 * Tracks worker response compliance without escalating to founder:
 * - Logs missed responses per worker
 * - Tracks response times
 * - Calculates response rate percentage
 * - Stores compliance history in database
 */

import { getDb } from '../db';
import { sql, eq, and, gte, desc, count } from 'drizzle-orm';

// Compliance event types
export type ComplianceEventType = 
  | 'checkin_requested'
  | 'checkin_responded'
  | 'checkin_missed'
  | 'followup_sent'
  | 'followup_responded'
  | 'followup_missed';

// Compliance event record
export interface ComplianceEvent {
  id?: number;
  vaId: number;
  vaName: string;
  cardId: string;
  cardName: string;
  eventType: ComplianceEventType;
  requestedAt: Date;
  respondedAt: Date | null;
  responseTimeMinutes: number | null;
  wasOnTime: boolean;
  gracePeriodMinutes: number;
  notes: string | null;
  createdAt: Date;
}

// Worker compliance summary
export interface WorkerComplianceSummary {
  vaId: number;
  vaName: string;
  totalCheckins: number;
  respondedCheckins: number;
  missedCheckins: number;
  responseRate: number; // Percentage
  averageResponseTimeMinutes: number;
  onTimeResponseRate: number; // Percentage
  lastCheckinDate: Date | null;
  complianceTrend: 'improving' | 'stable' | 'declining';
}

// In-memory compliance store (would be DB table in production)
const complianceEvents: ComplianceEvent[] = [];

/**
 * Record a compliance event
 */
export async function recordComplianceEvent(event: Omit<ComplianceEvent, 'id' | 'createdAt'>): Promise<number> {
  const newEvent: ComplianceEvent = {
    ...event,
    id: complianceEvents.length + 1,
    createdAt: new Date(),
  };
  
  complianceEvents.push(newEvent);
  
  console.log(`[ComplianceTracking] Recorded event: ${event.eventType} for VA ${event.vaId} on card ${event.cardId}`);
  
  // Also store in database
  await storeComplianceEventInDb(newEvent);
  
  return newEvent.id!;
}

/**
 * Store compliance event in database
 */
async function storeComplianceEventInDb(event: ComplianceEvent): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    // Insert into chatbot_analytics table (reusing existing table)
    await db.execute(sql`
      INSERT INTO chatbot_analytics (
        vaId, vaName, eventType, cardId, cardName,
        requestedAt, respondedAt, responseTimeMinutes,
        wasOnTime, gracePeriodMinutes, notes, createdAt
      ) VALUES (
        ${event.vaId}, ${event.vaName}, ${event.eventType}, ${event.cardId}, ${event.cardName},
        ${event.requestedAt}, ${event.respondedAt}, ${event.responseTimeMinutes},
        ${event.wasOnTime ? 1 : 0}, ${event.gracePeriodMinutes}, ${event.notes}, ${event.createdAt}
      )
    `);
  } catch (error) {
    console.error('[ComplianceTracking] Error storing event in DB:', error);
  }
}

/**
 * Record that a check-in was requested
 */
export async function recordCheckinRequested(
  vaId: number,
  vaName: string,
  cardId: string,
  cardName: string,
  gracePeriodMinutes: number = 15
): Promise<number> {
  return recordComplianceEvent({
    vaId,
    vaName,
    cardId,
    cardName,
    eventType: 'checkin_requested',
    requestedAt: new Date(),
    respondedAt: null,
    responseTimeMinutes: null,
    wasOnTime: false, // Will be updated when response received
    gracePeriodMinutes,
    notes: null,
  });
}

/**
 * Record that a worker responded to a check-in
 */
export async function recordCheckinResponse(
  vaId: number,
  vaName: string,
  cardId: string,
  cardName: string,
  requestedAt: Date,
  gracePeriodMinutes: number = 15
): Promise<number> {
  const respondedAt = new Date();
  const responseTimeMinutes = Math.round((respondedAt.getTime() - requestedAt.getTime()) / 60000);
  const wasOnTime = responseTimeMinutes <= gracePeriodMinutes;
  
  return recordComplianceEvent({
    vaId,
    vaName,
    cardId,
    cardName,
    eventType: 'checkin_responded',
    requestedAt,
    respondedAt,
    responseTimeMinutes,
    wasOnTime,
    gracePeriodMinutes,
    notes: wasOnTime ? 'Responded within grace period' : `Responded ${responseTimeMinutes - gracePeriodMinutes} minutes late`,
  });
}

/**
 * Record that a check-in was missed
 */
export async function recordCheckinMissed(
  vaId: number,
  vaName: string,
  cardId: string,
  cardName: string,
  requestedAt: Date,
  gracePeriodMinutes: number = 15
): Promise<number> {
  return recordComplianceEvent({
    vaId,
    vaName,
    cardId,
    cardName,
    eventType: 'checkin_missed',
    requestedAt,
    respondedAt: null,
    responseTimeMinutes: null,
    wasOnTime: false,
    gracePeriodMinutes,
    notes: 'No response received within grace period',
  });
}

/**
 * Get compliance summary for a worker
 */
export async function getWorkerComplianceSummary(vaId: number): Promise<WorkerComplianceSummary | null> {
  // Filter events for this worker
  const workerEvents = complianceEvents.filter(e => e.vaId === vaId);
  
  if (workerEvents.length === 0) {
    return null;
  }
  
  // Get worker name from first event
  const vaName = workerEvents[0].vaName;
  
  // Calculate metrics
  const checkinEvents = workerEvents.filter(e => 
    e.eventType === 'checkin_requested' || 
    e.eventType === 'checkin_responded' || 
    e.eventType === 'checkin_missed'
  );
  
  const respondedEvents = workerEvents.filter(e => 
    e.eventType === 'checkin_responded' || 
    e.eventType === 'followup_responded'
  );
  
  const missedEvents = workerEvents.filter(e => 
    e.eventType === 'checkin_missed' || 
    e.eventType === 'followup_missed'
  );
  
  const onTimeEvents = respondedEvents.filter(e => e.wasOnTime);
  
  // Calculate response times
  const responseTimes = respondedEvents
    .filter(e => e.responseTimeMinutes !== null)
    .map(e => e.responseTimeMinutes!);
  
  const averageResponseTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;
  
  // Calculate response rate
  const totalRequests = checkinEvents.filter(e => e.eventType === 'checkin_requested').length;
  const totalResponses = respondedEvents.length;
  const responseRate = totalRequests > 0 ? Math.round((totalResponses / totalRequests) * 100) : 100;
  
  // Calculate on-time rate
  const onTimeRate = respondedEvents.length > 0
    ? Math.round((onTimeEvents.length / respondedEvents.length) * 100)
    : 100;
  
  // Calculate trend (compare last 7 days to previous 7 days)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  
  const recentEvents = workerEvents.filter(e => e.createdAt >= sevenDaysAgo);
  const previousEvents = workerEvents.filter(e => e.createdAt >= fourteenDaysAgo && e.createdAt < sevenDaysAgo);
  
  const recentResponseRate = calculateResponseRate(recentEvents);
  const previousResponseRate = calculateResponseRate(previousEvents);
  
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (recentResponseRate > previousResponseRate + 10) {
    trend = 'improving';
  } else if (recentResponseRate < previousResponseRate - 10) {
    trend = 'declining';
  }
  
  // Get last check-in date
  const lastCheckin = workerEvents
    .filter(e => e.eventType === 'checkin_responded')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  
  return {
    vaId,
    vaName,
    totalCheckins: totalRequests,
    respondedCheckins: totalResponses,
    missedCheckins: missedEvents.length,
    responseRate,
    averageResponseTimeMinutes: averageResponseTime,
    onTimeResponseRate: onTimeRate,
    lastCheckinDate: lastCheckin?.respondedAt || null,
    complianceTrend: trend,
  };
}

/**
 * Helper to calculate response rate from events
 */
function calculateResponseRate(events: ComplianceEvent[]): number {
  const requests = events.filter(e => e.eventType === 'checkin_requested').length;
  const responses = events.filter(e => 
    e.eventType === 'checkin_responded' || 
    e.eventType === 'followup_responded'
  ).length;
  
  return requests > 0 ? Math.round((responses / requests) * 100) : 100;
}

/**
 * Get compliance summaries for all workers
 */
export async function getAllWorkerComplianceSummaries(): Promise<WorkerComplianceSummary[]> {
  // Get unique VA IDs
  const vaIds = Array.from(new Set(complianceEvents.map(e => e.vaId)));
  
  const summaries: WorkerComplianceSummary[] = [];
  
  for (const vaId of vaIds) {
    const summary = await getWorkerComplianceSummary(vaId);
    if (summary) {
      summaries.push(summary);
    }
  }
  
  return summaries;
}

/**
 * Get recent compliance events for a worker
 */
export function getRecentComplianceEvents(vaId: number, limit: number = 20): ComplianceEvent[] {
  return complianceEvents
    .filter(e => e.vaId === vaId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

/**
 * Get compliance events for a specific card
 */
export function getCardComplianceEvents(cardId: string): ComplianceEvent[] {
  return complianceEvents
    .filter(e => e.cardId === cardId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get daily compliance stats
 */
export function getDailyComplianceStats(date: Date = new Date()): {
  totalCheckins: number;
  respondedCheckins: number;
  missedCheckins: number;
  responseRate: number;
  averageResponseTime: number;
} {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const dayEvents = complianceEvents.filter(e => 
    e.createdAt >= startOfDay && e.createdAt <= endOfDay
  );
  
  const requests = dayEvents.filter(e => e.eventType === 'checkin_requested').length;
  const responses = dayEvents.filter(e => 
    e.eventType === 'checkin_responded' || 
    e.eventType === 'followup_responded'
  ).length;
  const missed = dayEvents.filter(e => 
    e.eventType === 'checkin_missed' || 
    e.eventType === 'followup_missed'
  ).length;
  
  const responseTimes = dayEvents
    .filter(e => e.responseTimeMinutes !== null)
    .map(e => e.responseTimeMinutes!);
  
  const avgResponseTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;
  
  return {
    totalCheckins: requests,
    respondedCheckins: responses,
    missedCheckins: missed,
    responseRate: requests > 0 ? Math.round((responses / requests) * 100) : 100,
    averageResponseTime: avgResponseTime,
  };
}

export default {
  recordComplianceEvent,
  recordCheckinRequested,
  recordCheckinResponse,
  recordCheckinMissed,
  getWorkerComplianceSummary,
  getAllWorkerComplianceSummaries,
  getRecentComplianceEvents,
  getCardComplianceEvents,
  getDailyComplianceStats,
};
