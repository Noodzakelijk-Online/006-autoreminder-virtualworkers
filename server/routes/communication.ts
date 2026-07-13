import { Router } from 'express';
import { getDb } from '../db';
import { taskAssignments, vaProfiles } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from '../services/email';
import { postTrelloComment } from '../services/trello-chatbot';
import { storeConversation } from '../services/chatbot-history';

const router = Router();

// POST /api/communication/ask-founder
router.post('/ask-founder', async (req, res) => {
  const { taskId, workerId, question } = req.body;
  if (!taskId || !workerId || !question) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const db = await getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  try {
    // 1. Get worker profile name
    const worker = await db.select().from(vaProfiles).where(eq(vaProfiles.id, Number(workerId))).limit(1);
    const workerName = worker[0]?.name || 'Worker';

    // 2. Post comment to Trello card
    const commentText = `❓ **[Worker Question]**\n${workerName} asked:\n"${question}"`;
    const posted = await postTrelloComment(taskId, commentText);

    if (!posted) {
      console.warn(`[Communication] Failed to post worker question to Trello card ${taskId}`);
    }

    // 3. Save to chatbot_conversations table
    await storeConversation({
      cardTrelloId: taskId,
      command: 'ask_founder',
      responseText: question,
      authorName: workerName,
      responseStatus: posted ? 'success' : 'failed',
      receivedAt: new Date(),
      respondedAt: new Date(),
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Communication] Error processing ask-founder:', error);
    res.status(500).json({ error: 'Failed to process question' });
  }
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
