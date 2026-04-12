/**
 * Trello Webhook Routes
 * 
 * Handles incoming webhooks from Trello for the chatbot functionality.
 * Trello webhooks require:
 * 1. A HEAD endpoint that returns 200 (for webhook verification)
 * 2. A POST endpoint that receives the webhook payload
 */

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { handleTrelloWebhook, postTrelloComment, parseBotCommand, processBotCommand } from '../services/trello-chatbot';

const router = Router();

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;

/**
 * HEAD /api/trello-webhook
 * Trello sends a HEAD request to verify the webhook URL is valid
 */
router.head('/', (req, res) => {
  console.log('[TrelloWebhook] Received HEAD verification request');
  res.status(200).send();
});

/**
 * POST /api/trello-webhook
 * Receives webhook events from Trello
 */
router.post('/', async (req, res) => {
  try {
    const payload = req.body;
    
    // Log the webhook event type
    const actionType = payload?.action?.type;
    console.log(`[TrelloWebhook] Received webhook: ${actionType}`);
    
    // Process the webhook asynchronously (don't block the response)
    // Trello expects a quick 200 response
    res.status(200).send('OK');
    
    // Handle the webhook in the background
    await handleTrelloWebhook(payload);
  } catch (error) {
    console.error('[TrelloWebhook] Error processing webhook:', error);
    // Still return 200 to prevent Trello from retrying
    res.status(200).send('OK');
  }
});

/**
 * POST /api/trello-webhook/register
 * Register a webhook with Trello for a specific model (board, card, etc.)
 */
router.post('/register', async (req, res) => {
  try {
    const { modelId, description, callbackUrl } = req.body;
    
    if (!modelId || !callbackUrl) {
      return res.status(400).json({ 
        error: 'Missing required fields: modelId, callbackUrl' 
      });
    }

    if (!TRELLO_API_KEY || !TRELLO_TOKEN) {
      return res.status(400).json({ 
        error: 'Trello API credentials not configured. Please set TRELLO_API_KEY and TRELLO_TOKEN environment variables.' 
      });
    }

    const response = await fetch(
      `https://api.trello.com/1/webhooks?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idModel: modelId,
          callbackURL: callbackUrl,
          description: description || 'VA Dashboard Chatbot Webhook',
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TrelloWebhook] Failed to register webhook:', errorText);
      return res.status(response.status).json({ 
        error: 'Failed to register webhook', 
        details: errorText 
      });
    }

    const webhook = await response.json();
    console.log('[TrelloWebhook] Registered webhook:', webhook.id);

    // Also store in local database for fallback
    try {
      const { getDb } = await import('../db');
      const { chatbotWebhooks } = await import('../../drizzle/schema');
      const db = await getDb();
      await db.insert(chatbotWebhooks).values({
        trelloWebhookId: webhook.id,
        modelId: modelId,
        description: description || 'VA Dashboard Chatbot',
        callbackUrl: callbackUrl,
        isActive: webhook.active ? 1 : 0,
      });
      console.log('[TrelloWebhook] Stored webhook in database');
    } catch (dbError) {
      console.warn('[TrelloWebhook] Failed to store webhook in database:', dbError);
    }
    
    res.json({ 
      success: true, 
      webhookId: webhook.id,
      webhook 
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error registering webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/trello-webhook/list
 * List all registered webhooks (from Trello API or local database)
 */
router.get('/list', async (req, res) => {
  try {
    let webhooks: any[] = [];
    let source = 'trello';

    // Try to fetch from Trello API first
    if (TRELLO_API_KEY && TRELLO_TOKEN) {
      try {
        const response = await fetch(
          `https://api.trello.com/1/tokens/${TRELLO_TOKEN}/webhooks?key=${TRELLO_API_KEY}`,
          { method: 'GET' }
        );

        if (response.ok) {
          webhooks = await response.json();
          console.log('[TrelloWebhook] Fetched webhooks from Trello API');
        } else {
          console.warn('[TrelloWebhook] Failed to fetch from Trello API, falling back to database');
          source = 'database';
        }
      } catch (error) {
        console.warn('[TrelloWebhook] Error fetching from Trello API, falling back to database:', error);
        source = 'database';
      }
    } else {
      console.warn('[TrelloWebhook] Trello credentials not configured, using database');
      source = 'database';
    }

    // Fall back to local database if Trello API failed or not configured
    if (webhooks.length === 0 && source === 'database') {
      try {
        const { getDb } = await import('../db');
        const { chatbotWebhooks } = await import('../../drizzle/schema');
        const db = await getDb();
        const stored = await db.select().from(chatbotWebhooks).where(eq(chatbotWebhooks.isActive, 1));
        webhooks = stored.map((w: any) => ({
          id: w.trelloWebhookId,
          idModel: w.modelId,
          description: w.description,
          callbackURL: w.callbackUrl,
          active: w.isActive === 1,
          createdAt: w.createdAt,
        }));
        console.log(`[TrelloWebhook] Fetched ${webhooks.length} webhooks from database`);
      } catch (dbError) {
        console.error('[TrelloWebhook] Error fetching from database:', dbError);
      }
    }

    res.json({ webhooks, source });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error listing webhooks:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/trello-webhook/:webhookId
 * Delete a specific webhook
 */
router.delete('/:webhookId', async (req, res) => {
  try {
    const { webhookId } = req.params;

    let success = false;

    // Try to delete from Trello API
    if (TRELLO_API_KEY && TRELLO_TOKEN) {
      try {
        const response = await fetch(
          `https://api.trello.com/1/webhooks/${webhookId}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`,
          { method: 'DELETE' }
        );

        if (response.ok) {
          success = true;
          console.log('[TrelloWebhook] Deleted webhook from Trello:', webhookId);
        } else {
          console.warn('[TrelloWebhook] Failed to delete from Trello API');
        }
      } catch (error) {
        console.warn('[TrelloWebhook] Error deleting from Trello API:', error);
      }
    }

    // Also delete from local database
    try {
      const { getDb } = await import('../db');
      const { chatbotWebhooks } = await import('../../drizzle/schema');
      const db = await getDb();
      await db.delete(chatbotWebhooks).where(eq(chatbotWebhooks.trelloWebhookId, webhookId));
      console.log('[TrelloWebhook] Deleted webhook from database:', webhookId);
    } catch (dbError) {
      console.warn('[TrelloWebhook] Failed to delete from database:', dbError);
    }

    res.json({ success: true, webhookId });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error deleting webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trello-webhook/test
 * Test the chatbot by simulating a comment
 */
router.post('/test', async (req, res) => {
  try {
    const { cardId, comment, authorName } = req.body;
    
    if (!cardId || !comment) {
      return res.status(400).json({ 
        error: 'Missing required fields: cardId, comment' 
      });
    }

    // Parse the command
    const cmd = parseBotCommand(
      comment, 
      cardId, 
      'test-comment-id', 
      'test-author-id', 
      authorName || 'Test User'
    );

    if (!cmd) {
      return res.json({ 
        success: false, 
        message: 'No @bot command found in comment' 
      });
    }

    // Process the command
    const response = await processBotCommand(cmd);

    res.json({ 
      success: true, 
      command: cmd.command,
      args: cmd.args,
      response: response.text,
      mentions: response.mentions 
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error testing chatbot:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trello-webhook/checkin
 * Manually trigger a check-in for a card
 */
router.post('/checkin', async (req, res) => {
  try {
    const { cardId, workerName, type } = req.body;
    
    if (!cardId) {
      return res.status(400).json({ error: 'Missing required field: cardId' });
    }

    const { triggerManualCheckin } = await import('../services/chatbot-scheduler');
    const sent = await triggerManualCheckin(cardId, workerName, type || 'midday');

    if (sent) {
      res.json({ success: true, message: 'Check-in sent successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send check-in' });
    }
  } catch (error: any) {
    console.error('[TrelloWebhook] Error sending check-in:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trello-webhook/send
 * Manually send a bot message to a card
 */
router.post('/send', async (req, res) => {
  try {
    const { cardId, message } = req.body;
    
    if (!cardId || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: cardId, message' 
      });
    }

    const posted = await postTrelloComment(cardId, message);

    if (posted) {
      res.json({ success: true, message: 'Comment posted successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to post comment' });
    }
  } catch (error: any) {
    console.error('[TrelloWebhook] Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trello-webhook/sync
 * Sync webhooks with all ATIS boards
 */
router.post('/sync', async (req, res) => {
  try {
    const { syncWebhooks } = await import('../services/webhook-auto-register');
    const results = await syncWebhooks();
    
    res.json({
      success: true,
      registered: results.registered,
      removed: results.removed,
      errors: results.errors,
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error syncing webhooks:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/trello-webhook/analytics
 * Get chatbot analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const { getOverallStats, getWorkerEngagement } = await import('../services/chatbot-analytics');
    
    const [stats, engagement] = await Promise.all([
      getOverallStats(days),
      getWorkerEngagement(days),
    ]);
    
    res.json({
      success: true,
      stats,
      engagement,
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error getting analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/trello-webhook/analytics/daily
 * Get daily analytics for a date range
 */
router.get('/analytics/daily', async (req, res) => {
  try {
    const startDate = req.query.start 
      ? new Date(req.query.start as string) 
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = req.query.end 
      ? new Date(req.query.end as string) 
      : new Date();
    
    const { getAnalyticsRange } = await import('../services/chatbot-analytics');
    const analytics = await getAnalyticsRange(startDate, endDate);
    
    res.json({
      success: true,
      analytics,
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error getting daily analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/trello-webhook/history/:cardId
 * Get conversation history for a card
 */
router.get('/history/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const { getCardConversations } = await import('../services/chatbot-history');
    const conversations = await getCardConversations(cardId, limit);
    
    res.json({
      success: true,
      conversations,
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error getting card history:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/trello-webhook/status
 * Get webhook configuration status including callback URL
 */
router.get('/status', async (req, res) => {
  try {
    const { getWebhookCallbackUrl } = await import('../services/webhook-auto-register');
    const callbackUrl = getWebhookCallbackUrl();
    const publicUrl = process.env.PUBLIC_URL;
    
    // Check if URL is reachable (basic check)
    let isReachable = false;
    if (callbackUrl) {
      try {
        // Just check if it's a valid URL format
        new URL(callbackUrl);
        isReachable = !callbackUrl.includes('localhost');
      } catch {
        isReachable = false;
      }
    }
    
    res.json({
      success: true,
      status: {
        callbackUrl,
        publicUrl,
        isConfigured: !!callbackUrl,
        isReachable,
        recommendation: !publicUrl 
          ? 'Set PUBLIC_URL environment variable to your deployed URL (e.g., https://your-app.manus.space)'
          : isReachable 
            ? 'Webhook URL is configured and should be reachable by Trello'
            : 'Webhook URL may not be reachable - ensure your app is publicly deployed',
      },
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error getting status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/trello-webhook/stored-webhooks
 * Get all webhooks stored in database
 */
router.get('/stored-webhooks', async (req, res) => {
  try {
    const { getDb } = await import('../db');
    const { sql } = await import('drizzle-orm');
    const { chatbotWebhooks } = await import('../../drizzle/schema');
    
    const db = await getDb();
    const webhooks = await db.select().from(chatbotWebhooks);
    
    res.json({
      success: true,
      webhooks,
      count: webhooks.length,
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error getting stored webhooks:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/chatbot/analytics
 * Get overall chatbot analytics (alias for /api/trello-webhook/analytics)
 */
router.get('/chatbot/analytics', async (req, res) => {
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

export default router;
