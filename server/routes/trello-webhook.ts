import { Router, type Request, type Response } from 'express';
import { getDb } from '../db';
import { chatbotWebhooks, chatbotConversations } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

const router = Router();

const TRELLO_API_BASE = 'https://api.trello.com/1';

/**
 * POST /api/trello-webhook/register
 * Register a webhook for a Trello board/workspace
 */
router.post('/register', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { modelId, callbackUrl } = req.body;

    if (!modelId || !callbackUrl) {
      return res.status(400).json({ error: 'Missing modelId or callbackUrl' });
    }

    const apiKey = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;

    if (!apiKey || !token) {
      return res.status(500).json({ error: 'Trello credentials not configured' });
    }

    // Register webhook with Trello
    const response = await fetch(`${TRELLO_API_BASE}/webhooks?key=${apiKey}&token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idModel: modelId,
        callbackURL: callbackUrl,
        description: `VA Dashboard Webhook for ${modelId}`,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[TrelloWebhook] Trello API error:', error);
      return res.status(response.status).json({ error: 'Failed to register webhook with Trello' });
    }

    const webhookData = await response.json();

    // Store webhook in database
    const db = await getDb();
    if (db) {
      await db.insert(chatbotWebhooks).values({
        trelloWebhookId: webhookData.id,
        modelId: modelId,
        callbackUrl: callbackUrl,
        isActive: 1,
      }).catch((err: any) => console.error('[TrelloWebhook] DB insert error:', err));
    }

    res.json({ success: true, webhookId: webhookData.id });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error registering webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/trello-webhook/list
 * List all registered webhooks
 */
router.get('/list', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const apiKey = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;

    // Try Trello API first
    if (apiKey && token) {
      try {
        const response = await fetch(`${TRELLO_API_BASE}/webhooks?key=${apiKey}&token=${token}`);
        if (response.ok) {
          const webhooks = await response.json();
          console.log('[TrelloWebhook] Fetched webhooks from Trello API');
          return res.json({ webhooks, source: 'trello' });
        }
      } catch (err) {
        console.error('[TrelloWebhook] Trello API error:', err);
      }
    }

    // Fall back to database
    const db = await getDb();
    if (db) {
      const webhooks = await db.select().from(chatbotWebhooks).where(eq(chatbotWebhooks.isActive, 1));
      console.log('[TrelloWebhook] Fetched webhooks from database');
      return res.json({ webhooks, source: 'database' });
    }

    res.json({ webhooks: [], source: 'none' });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error listing webhooks:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/trello-webhook/delete/:webhookId
 * Delete a webhook
 */
router.delete('/delete/:webhookId', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { webhookId } = req.params;
    const apiKey = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;

    // Try to delete from Trello API
    if (apiKey && token) {
      try {
        const response = await fetch(`${TRELLO_API_BASE}/webhooks/${webhookId}?key=${apiKey}&token=${token}`, {
          method: 'DELETE',
        });
        console.log('[TrelloWebhook] Deleted webhook from Trello API');
      } catch (err) {
        console.error('[TrelloWebhook] Error deleting from Trello:', err);
      }
    }

    // Delete from database
    const db = await getDb();
    if (db) {
      await db.delete(chatbotWebhooks).where(eq(chatbotWebhooks.trelloWebhookId, webhookId));
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error deleting webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trello-webhook/callback
 * Webhook callback from Trello
 */
router.post('/callback', async (req: Request, res: Response) => {
  try {
    const action = req.body.action;
    const card = req.body.model;

    if (!action || !card) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    console.log('[TrelloWebhook] Received callback:', action.type);

    // Process the webhook action
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    // Store conversation data
    if (action.type === 'commentCard') {
      const comment = action.data.text;
      const member = action.memberCreator;

      await db.insert(chatbotConversations).values({
        cardTrelloId: card.id,
        authorTrelloId: member.id,
        authorName: member.fullName,
        message: comment,
        responseTimeMs: 0,
        receivedAt: new Date(),
      }).catch((err: any) => console.error('[TrelloWebhook] Error storing conversation:', err));
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error processing callback:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/trello-webhook/analytics
 * Get overall chatbot analytics
 */
router.get('/analytics', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const days = parseInt(req.query.days as string) || 30;

    const { getOverallStats } = await import('../services/chatbot-analytics');

    if (!getOverallStats) {
      console.error('[TrelloWebhook] getOverallStats function not found');
      return res.status(500).json({ error: 'Analytics service not available' });
    }

    const stats = await getOverallStats(days);

    if (!stats) {
      return res.status(500).json({ error: 'Failed to retrieve analytics data' });
    }

    return res.json(stats);
  } catch (error: any) {
    console.error('[TrelloWebhook] Error getting chatbot analytics:', error);
    return res.status(500).json({ error: error.message || 'Failed to load analytics' });
  }
});

/**
 * GET /api/chatbot/analytics
 * Get overall chatbot analytics (alias for /api/trello-webhook/analytics)
 */
router.get('/chatbot/analytics', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const days = parseInt(req.query.days as string) || 30;

    // Validate days parameter
    if (isNaN(days) || days < 1 || days > 365) {
      return res.status(400).json({ error: 'Invalid days parameter. Must be between 1 and 365.' });
    }

    const { getOverallStats } = await import('../services/chatbot-analytics');

    if (!getOverallStats) {
      console.error('[TrelloWebhook] getOverallStats function not found');
      return res.status(500).json({ error: 'Analytics service not available' });
    }

    const stats = await getOverallStats(days);

    if (!stats) {
      return res.status(500).json({ error: 'Failed to retrieve analytics data' });
    }

    return res.json(stats);
  } catch (error: any) {
    console.error('[TrelloWebhook] Error getting chatbot analytics:', error);
    return res.status(500).json({ error: error.message || 'Failed to load analytics' });
  }
});

/**
 * GET /api/trello-webhook/status
 * Get webhook status
 */
router.get('/status', async (req: any, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    // Get webhook count for this user
    const webhooks = await db.select().from(chatbotWebhooks).where(eq(chatbotWebhooks.isActive, 1));

    return res.json({
      status: webhooks.length > 0 ? 'active' : 'inactive',
      webhookCount: webhooks.length,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error getting webhook status:', error);
    return res.status(500).json({ error: error.message || 'Failed to get webhook status' });
  }
});

export default router;
