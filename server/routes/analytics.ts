import { Router } from 'express';
import { getDb } from '../db';
import { taskAssignments, vaProfiles, timeEntries } from '../../drizzle/schema';
import { eq, and, sql } from 'drizzle-orm';

const router = Router();

// GET /api/analytics/worker-productivity
router.get('/worker-productivity', async (req, res) => {
  const db = await getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const profiles = await db.select().from(vaProfiles);
    const tasks = await db.select().from(taskAssignments);
    const times = await db.select().from(timeEntries);

    const productivity = (profiles as any[]).map((profile: any) => {
      const workerTasks = (tasks as any[]).filter((t: any) => t.vaId === profile.id);
      const completedTasks = workerTasks.filter((t: any) => t.status === 'completed');
      
      const workerTimes = (times as any[]).filter((t: any) => t.userId === profile.userId);
      const actualMinutes = workerTimes.reduce((sum: number, t: any) => sum + (t.durationMinutes || 0), 0);
      
      return {
        workerId: profile.id,
        workerName: profile.name,
        totalAssigned: workerTasks.length,
        completed: completedTasks.length,
        actualMinutes,
        efficiencyScore: actualMinutes > 0 ? (completedTasks.length * 60) / actualMinutes : 1 // mock metric
      };
    });

    res.json({ success: true, productivity });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get productivity data' });
  }
});

// GET /api/analytics/team-capacity
router.get('/team-capacity', async (req, res) => {
  res.json({ success: true, utilization: 85 }); // mocked
});

// GET /api/analytics/trends
router.get('/trends', async (req, res) => {
  res.json({ success: true, trends: [] }); // mocked
});

export default router;
