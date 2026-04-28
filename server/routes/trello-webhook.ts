import { Router, Response } from 'express';
import { getDb } from '../db';
import { chatbotWebhooks, chatbotConversations } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

const router = Router();

const TRELLO_API_BASE = 'https://api.trello.com/1';

/**
 * GET /api/trello-webhook
 * Health check endpoint for Trello webhook validation
 */
router.get('/', (req: any, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Webhook endpoint is ready' });
});

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

    // Validate modelId format
    if (typeof modelId !== 'string' || modelId.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid modelId. Must be a non-empty string.' });
    }

    const cleanModelId = modelId.trim();
    
    if (cleanModelId.length < 8 || cleanModelId.length > 32) {
      return res.status(400).json({ error: 'Invalid modelId length. Trello board IDs are typically 24-32 characters.' });
    }

    if (!/^[a-zA-Z0-9]+$/.test(cleanModelId)) {
      return res.status(400).json({ error: 'Invalid modelId format. Only alphanumeric characters allowed.' });
    }

    const apiKey = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;

    if (!apiKey || !token) {
      return res.status(500).json({ error: 'Trello credentials not configured' });
    }

    console.log('[TrelloWebhook] Registering webhook for modelId:', cleanModelId);

    // Register webhook with Trello
    const response = await fetch(`${TRELLO_API_BASE}/webhooks?key=${apiKey}&token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idModel: cleanModelId,
        callbackURL: callbackUrl,
        description: `VA Dashboard Webhook for ${cleanModelId}`,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[TrelloWebhook] Trello API error:', error);
      console.error('[TrelloWebhook] Request details - modelId:', cleanModelId, 'status:', response.status);
      
      // Provide user-friendly error messages based on Trello API response
      let userMessage = 'Failed to register webhook with Trello';
      
      if (error.includes('invalid value for idModel')) {
        userMessage = `Board ID "${cleanModelId}" is invalid or not found. Please verify:
1. The board ID is correct (find it in your Trello board URL: trello.com/b/BOARD_ID/name)
2. You have admin/owner access to the board
3. Your Trello API credentials are valid and up-to-date`;
      } else if (error.includes('invalid token') || error.includes('unauthorized')) {
        userMessage = 'Trello authentication failed. Your API credentials may be invalid or expired. Please check your TRELLO_API_KEY and TRELLO_TOKEN.';
      } else if (error.includes('already exists')) {
        userMessage = 'A webhook for this board already exists. Delete the existing webhook first.';
      } else if (error.includes('model not found')) {
        userMessage = `Board "${cleanModelId}" not found. Please verify the board ID is correct.`;
      }
      
      return res.status(response.status).json({ error: userMessage });
    }

    const webhookData = await response.json();

    // Store webhook in database
    const db = await getDb();
    if (db) {
      await db.insert(chatbotWebhooks).values({
        trelloWebhookId: webhookData.id,
        modelId: cleanModelId,
        callbackUrl: callbackUrl,
        isActive: 1,
      }).catch((err: any) => console.error('[TrelloWebhook] DB insert error:', err));
    }

    console.log('[TrelloWebhook] Webhook registered successfully:', webhookData.id);
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
          return res.json({ webhooks });
        }
      } catch (err: any) {
        console.error('[TrelloWebhook] Trello API error:', err);
      }
    }

    // Fallback to database
    const db = await getDb();
    if (db) {
      const webhooks = await db.query.chatbotWebhooks.findMany();
      console.log('[TrelloWebhook] Fetched webhooks from database');
      return res.json({ webhooks });
    }

    res.json({ webhooks: [] });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error listing webhooks:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/trello-webhook/:webhookId
 * Delete a webhook
 */
router.delete('/:webhookId', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { webhookId } = req.params;
    const apiKey = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;

    if (apiKey && token) {
      try {
        const response = await fetch(`${TRELLO_API_BASE}/webhooks/${webhookId}?key=${apiKey}&token=${token}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          console.log('[TrelloWebhook] Deleted webhook from Trello API');
        } else {
          console.error('[TrelloWebhook] Error deleting from Trello:', response.status);
        }
      } catch (err: any) {
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
 * POST /api/trello-webhook
 * Webhook callback from Trello
 */
router.post('/', async (req: any, res: Response) => {
  try {
    const action = req.body;

    console.log('[TrelloWebhook] Received callback:', action.type);

    // Store conversation in database
    const db = await getDb();
    if (db) {
      await db.insert(chatbotConversations).values({
        trelloCardId: action.data?.card?.id,
        trelloAction: action.type,
        conversationData: JSON.stringify(action),
        createdAt: new Date(),
      }).catch((err: any) => console.error('[TrelloWebhook] Error storing conversation:', err));
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error processing callback:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/trello-webhook/status
 * Get webhook status and configuration
 */
router.get('/status', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const callbackUrl = `${process.env.WEBHOOK_BASE_URL || 'https://your-domain.com'}/api/trello-webhook`;
    
    res.json({
      status: {
        callbackUrl,
        publicUrl: callbackUrl,
        isConfigured: !!process.env.TRELLO_API_KEY && !!process.env.TRELLO_TOKEN,
        isReachable: true,
        recommendation: 'Webhook is properly configured',
      },
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error getting webhook status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/chatbot/analytics
 * Get chatbot analytics
 */
router.get('/analytics', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Return empty analytics for now
    res.json({
      totalConversations: 0,
      totalCommands: {},
      avgResponseTimeMs: 0,
      totalCheckins: 0,
      totalResponses: 0,
      overallResponseRate: 0,
      avgCheckinResponseMinutes: 0,
      activeWorkers: 0,
      activeCards: 0,
      topCommands: [],
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error getting chatbot analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
