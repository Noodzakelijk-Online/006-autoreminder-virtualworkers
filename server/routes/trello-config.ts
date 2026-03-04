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

/**
 * PUT /api/trello/tasks/:taskId/complete
 * Update task completion status via Trello checklist item
 */
router.put('/tasks/:taskId/complete', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { isCompleted, cardId, checklistId, checkItemId } = req.body;

    if (!cardId || !checklistId || !checkItemId) {
      return res.status(400).json({ error: 'Missing required fields: cardId, checklistId, checkItemId' });
    }

    const apiKey = process.env.TRELLO_API_KEY;
    const apiToken = process.env.TRELLO_TOKEN;

    if (!apiKey || !apiToken) {
      return res.status(500).json({ error: 'Trello credentials not configured' });
    }

    // Update the checklist item state
    const updateUrl = `https://api.trello.com/1/checklists/${checklistId}/checkItems/${checkItemId}?key=${apiKey}&token=${apiToken}`;
    
    const updateResponse = await fetchWithRetry(updateUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        state: isCompleted ? 'complete' : 'incomplete',
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('[Trello] Failed to update checklist item:', errorText);
      return res.status(updateResponse.status).json({ 
        error: `Failed to update checklist item: ${updateResponse.statusText}` 
      });
    }

    const result = await updateResponse.json();

    res.json({
      success: true,
      taskId,
      isCompleted,
      checkItemId,
      message: `Task marked as ${isCompleted ? 'complete' : 'incomplete'} in Trello`,
    });
  } catch (error) {
    console.error('[Trello] Error updating task completion:', error);
    res.status(500).json({ 
      error: `Failed to update task completion: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
  }
});

/**
 * PUT /api/trello/cards/:cardId/status
 * Update card status directly (fallback when checklist data is unavailable)
 */
router.put('/cards/:cardId/status', async (req: Request, res: Response) => {
  try {
    const { cardId } = req.params;
    const { isCompleted } = req.body;

    if (!cardId) {
      return res.status(400).json({ error: 'Missing required field: cardId' });
    }

    const apiKey = process.env.TRELLO_API_KEY;
    const apiToken = process.env.TRELLO_TOKEN;

    if (!apiKey || !apiToken) {
      return res.status(500).json({ error: 'Trello credentials not configured' });
    }

    // Fetch the card to get its current labels
    const cardUrl = `https://api.trello.com/1/cards/${cardId}?key=${apiKey}&token=${apiToken}&fields=labels,idLabels`;
    const cardResponse = await fetchWithRetry(cardUrl);

    if (!cardResponse.ok) {
      console.error('[Trello] Failed to fetch card:', cardResponse.statusText);
      return res.status(404).json({ error: 'Card not found' });
    }

    const card = await cardResponse.json();
    const currentLabels = card.idLabels || [];
    
    // Get the completion label ID (from config or use a default)
    const completionLabelId = 'completed'; // This should be configurable
    
    // Update labels based on completion status
    let newLabels = currentLabels;
    if (isCompleted && !currentLabels.includes(completionLabelId)) {
      newLabels = [...currentLabels, completionLabelId];
    } else if (!isCompleted && currentLabels.includes(completionLabelId)) {
      newLabels = currentLabels.filter((id: string) => id !== completionLabelId);
    }

    // Update the card with new labels
    const updateUrl = `https://api.trello.com/1/cards/${cardId}?key=${apiKey}&token=${apiToken}`;
    const updateResponse = await fetchWithRetry(updateUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idLabels: newLabels,
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('[Trello] Failed to update card status:', errorText);
      return res.status(updateResponse.status).json({ 
        error: `Failed to update card status: ${updateResponse.statusText}` 
      });
    }

    res.json({
      success: true,
      cardId,
      isCompleted,
      message: `Card status updated to ${isCompleted ? 'complete' : 'incomplete'}`,
    });
  } catch (error) {
    console.error('[Trello] Error updating card status:', error);
    res.status(500).json({ 
      error: `Failed to update card status: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
  }
});

export default router;
