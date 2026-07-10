import { Router } from 'express';
import { getDb } from '../db';
import { taskAssignments } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from '../services/email'; // assuming it exists

const router = Router();

// POST /api/communication/ask-founder
router.post('/ask-founder', async (req, res) => {
  const { taskId, workerId, question } = req.body;
  if (!taskId || !workerId || !question) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Record the communication in the DB (for now we can just log or send an email)
  console.log(`Worker ${workerId} asked about task ${taskId}: ${question}`);
  
  // Ideally, notify founder via email or WebSocket
  // await sendEmail(founderEmail, 'Question from Worker', ...);

  res.json({ success: true });
});

// POST /api/communication/decision-log
router.post('/decision-log', async (req, res) => {
  const { taskId, decision, reasoning, author } = req.body;
  const db = await getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const task = await db.select().from(taskAssignments).where(eq(taskAssignments.taskId, taskId)).limit(1);
    if (task.length === 0) return res.status(404).json({ error: 'Task not found' });

    let logs = [];
    try {
      logs = task[0].decisionLog ? JSON.parse(task[0].decisionLog) : [];
    } catch (e) {}

    logs.push({ decision, reasoning, author, timestamp: new Date().toISOString() });

    await db.update(taskAssignments)
      .set({ decisionLog: JSON.stringify(logs) })
      .where(eq(taskAssignments.taskId, taskId));

    res.json({ success: true, logs });
  } catch (error) {
    console.error('Failed to save decision log:', error);
    res.status(500).json({ error: 'Failed to save decision log' });
  }
});

// GET /api/communication/decision-log/:taskId
router.get('/decision-log/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const db = await getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const task = await db.select().from(taskAssignments).where(eq(taskAssignments.taskId, taskId)).limit(1);
    if (task.length === 0) return res.status(404).json({ error: 'Task not found' });

    let logs = [];
    try {
      logs = task[0].decisionLog ? JSON.parse(task[0].decisionLog) : [];
    } catch (e) {}

    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get decision log' });
  }
});

export default router;
