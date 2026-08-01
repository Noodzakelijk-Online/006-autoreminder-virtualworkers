import { Router } from 'express';
import { saveHandoffNote, getHandoffContext, generateShiftSummary } from '../services/handoff-service';
import { requireAuthenticated, requestUser, resolveWorkerProfileId } from '../middleware/auth';

const router = Router();
router.use(requireAuthenticated);

// POST /api/handoff/notes
router.post('/notes', async (req, res) => {
  const { taskId, notes } = req.body;
  const workerId = await resolveWorkerProfileId(req, req.body.workerId);
  if (!taskId || !workerId || typeof notes !== 'string' || !notes.trim()) {
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
  const user = requestUser(req)!;
  const workerId = user.role === 'admin' ? undefined : await resolveWorkerProfileId(req);
  if (user.role !== 'admin' && !workerId) return res.status(403).json({ error: 'Worker profile not found' });
  const context = await getHandoffContext(taskId, workerId ?? undefined);
  if (context) {
    res.json(context);
  } else {
    res.status(404).json({ error: 'Context not found' });
  }
});

// POST /api/handoff/shift-summary
router.post('/shift-summary', async (req, res) => {
  const workerId = await resolveWorkerProfileId(req, req.body.workerId);
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
