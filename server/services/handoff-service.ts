import { getDb } from '../db';
import { taskAssignments, shiftSchedules, users } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { sendEmail } from './email';

export async function saveHandoffNote(taskId: string, workerId: number, notes: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.update(taskAssignments)
      .set({ 
        handoffNotes: notes,
        lastWorkedAt: new Date()
      })
      .where(and(
        eq(taskAssignments.taskId, taskId),
        eq(taskAssignments.vaId, workerId)
      ));
    return true;
  } catch (error) {
    console.error('Failed to save handoff note:', error);
    return false;
  }
}

export async function getHandoffContext(taskId: string): Promise<any> {
  const db = await getDb();
  if (!db) return null;

  try {
    const task = await db.select({
      notes: taskAssignments.handoffNotes,
      lastWorkedAt: taskAssignments.lastWorkedAt,
      vaId: taskAssignments.vaId
    }).from(taskAssignments)
      .where(eq(taskAssignments.taskId, taskId))
      .limit(1);

    if (task.length === 0) return null;
    return task[0];
  } catch (error) {
    console.error('Failed to get handoff context:', error);
    return null;
  }
}

export async function generateShiftSummary(workerId: number): Promise<boolean> {
  // Logic to generate an AI shift summary
  // Mocked for now to just record the action
  return true;
}
