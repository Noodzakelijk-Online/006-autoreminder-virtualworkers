import { Router } from 'express';
import { getDb } from '../db';
import { timeEntries, taskAssignments } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// GET /api/reports/export
router.get('/export', async (req, res) => {
  const { format, type } = req.query;
  const db = await getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  try {
    if (format === 'csv' && type === 'time-entries') {
      const times = await db.select().from(timeEntries);
      const csv = ['id,userId,taskId,durationMinutes,date,source'].concat(
        times.map((t: any) => `${t.id},${t.userId},${t.taskId},${t.durationMinutes},${t.createdAt.toISOString()},${t.source}`)
      ).join('\n');
      
      res.header('Content-Type', 'text/csv');
      res.attachment('time-entries.csv');
      return res.send(csv);
    }
    
    if (format === 'csv' && type === 'task-summary') {
      const tasks = await db.select().from(taskAssignments);
      const csv = ['id,taskId,vaId,status,createdAt,completedAt'].concat(
        tasks.map((t: any) => `${t.id},${t.taskId},${t.vaId},${t.status},${t.createdAt.toISOString()},${t.updatedAt.toISOString()}`)
      ).join('\n');
      
      res.header('Content-Type', 'text/csv');
      res.attachment('task-summary.csv');
      return res.send(csv);
    }
    
    // PDF or other formats mocked for now
    res.status(400).json({ error: 'Unsupported export format or type' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export default router;
