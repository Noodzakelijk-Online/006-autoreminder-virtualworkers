import { Router } from 'express';
import { saveHandoffNote, getHandoffContext, generateShiftSummary } from '../services/handoff-service';

const router = Router();

// POST /api/handoff/notes
router.post('/notes', async (req, res) => {
  const { taskId, workerId, notes } = req.body;
  if (!taskId || !workerId || typeof notes !== 'string') {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const success = await saveHandoffNote(taskId, workerId, notes);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to save handoff note' });
  }
});

// GET /api/handoff/:taskId
router.get('/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const context = await getHandoffContext(taskId);
  if (context) {
    res.json(context);
  } else {
    res.status(404).json({ error: 'Context not found' });
  }
});

// POST /api/handoff/shift-summary
router.post('/shift-summary', async (req, res) => {
  const { workerId } = req.body;
  if (!workerId) {
    return res.status(400).json({ error: 'Missing workerId' });
  }

  const success = await generateShiftSummary(workerId);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

export default router;
