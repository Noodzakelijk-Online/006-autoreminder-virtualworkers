import { Router, Request, Response } from 'express';
import { fetchWithRetry } from '../utils/retry';

const router = Router();

// In-memory storage for completion labels (in production, use database)
const completionLabelsMap = new Map<string, string[]>();

/**
 * GET /api/trello/labels
 * Fetch all available labels from the connected Trello board
 */
router.get('/labels', async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.TRELLO_API_KEY;
    const apiToken = process.env.TRELLO_TOKEN;

    if (!apiKey || !apiToken) {
      return res.status(500).json({ error: 'Trello credentials not configured' });
    }

    // Get the first board (assuming single board setup)
    const boardsUrl = `https://api.trello.com/1/members/me/boards?key=${apiKey}&token=${apiToken}`;
    const boardsResponse = await fetchWithRetry(boardsUrl);
    const boards = await boardsResponse.json();

    if (!boards || boards.length === 0) {
      return res.json({ labels: [] });
    }

    // Get labels from the first board
    const boardId = boards[0].id;
    const labelsUrl = `https://api.trello.com/1/boards/${boardId}/labels?key=${apiKey}&token=${apiToken}`;
    const labelsResponse = await fetchWithRetry(labelsUrl);
    const labels = await labelsResponse.json();

    // Transform labels to include only necessary fields
    const transformedLabels = labels.map((label: any) => ({
      id: label.id,
      name: label.name || 'Untitled',
      color: label.color || '#cccccc',
    }));

    res.json({ labels: transformedLabels });
  } catch (error) {
    console.error('[Trello] Error fetching labels:', error);
    res.status(500).json({ error: 'Failed to fetch Trello labels' });
  }
});

/**
 * GET /api/trello/completion-labels
 * Get the current completion labels configuration for the user
 */
router.get('/completion-labels', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userKey = `user_${user.id}`;
    const labels = completionLabelsMap.get(userKey) || [];

    res.json({
      labels,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Trello] Error fetching completion labels config:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

/**
 * POST /api/trello/completion-labels
 * Save the completion labels configuration for the user
 */
router.post('/completion-labels', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { labels } = req.body;

    if (!Array.isArray(labels)) {
      return res.status(400).json({ error: 'Labels must be an array' });
    }

    const userKey = `user_${user.id}`;
    completionLabelsMap.set(userKey, labels);

    res.json({
      success: true,
      labels,
      message: 'Completion labels configuration saved successfully',
    });
  } catch (error) {
    console.error('[Trello] Error saving completion labels config:', error);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

export default router;
