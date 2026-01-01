/**
 * Trello Webhook Routes
 * 
 * Handles incoming webhooks from Trello for the chatbot functionality.
 * Trello webhooks require:
 * 1. A HEAD endpoint that returns 200 (for webhook verification)
 * 2. A POST endpoint that receives the webhook payload
 */

import { Router } from 'express';
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
 * List all registered webhooks
 */
router.get('/list', async (req, res) => {
  try {
    const response = await fetch(
      `https://api.trello.com/1/tokens/${TRELLO_TOKEN}/webhooks?key=${TRELLO_API_KEY}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ 
        error: 'Failed to list webhooks', 
        details: errorText 
      });
    }

    const webhooks = await response.json();
    res.json({ webhooks });
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

    const response = await fetch(
      `https://api.trello.com/1/webhooks/${webhookId}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ 
        error: 'Failed to delete webhook', 
        details: errorText 
      });
    }

    console.log('[TrelloWebhook] Deleted webhook:', webhookId);
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
    
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    const result = await db.execute(sql`
      SELECT * FROM chatbot_webhooks ORDER BY createdAt DESC
    `);
    const webhooks = (result as any)[0] || [];
    
    res.json({
      success: true,
      webhooks,
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error getting stored webhooks:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trello-webhook/conversation-counts
 * Get conversation counts for multiple cards
 */
router.post('/conversation-counts', async (req, res) => {
  try {
    const { cardIds } = req.body;
    
    if (!cardIds || !Array.isArray(cardIds)) {
      return res.status(400).json({ error: 'cardIds array is required' });
    }

    const { getDb } = await import('../db');
    const { sql } = await import('drizzle-orm');
    
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    // Get counts for all requested cards in one query
    // Build the query with proper escaping
    const escapedIds = cardIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
    const result = await db.execute(sql`
      SELECT cardTrelloId as cardId, COUNT(*) as count 
      FROM chatbot_conversations 
      WHERE cardTrelloId IN (${sql.raw(escapedIds)})
      GROUP BY cardTrelloId
    `);
    
    const rows = (result as any)[0] || [];
    
    // Build counts map
    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.cardId] = parseInt(row.count) || 0;
    }
    
    // Fill in zeros for cards with no conversations
    for (const cardId of cardIds) {
      if (!(cardId in counts)) {
        counts[cardId] = 0;
      }
    }
    
    res.json({
      success: true,
      counts,
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error getting conversation counts:', error);
    res.status(500).json({ error: error.message });
  }
});

// In-memory storage for check-in settings (would be in database in production)
let checkinSettings = {
  useGlobal: true,
  settings: {
    morningEnabled: true,
    morningTime: '09:30',
    middayEnabled: true,
    middayTime: '13:00',
    eodEnabled: true,
    eodTime: '17:30',
  },
  workerSettings: null as any,
};

/**
 * GET /api/trello-webhook/checkin-settings
 * Get check-in schedule settings
 */
router.get('/checkin-settings', async (req, res) => {
  try {
    res.json({
      success: true,
      ...checkinSettings,
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error getting checkin settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trello-webhook/checkin-settings
 * Save check-in schedule settings
 */
router.post('/checkin-settings', async (req, res) => {
  try {
    const { useGlobal, settings, workerSettings } = req.body;
    
    checkinSettings = {
      useGlobal: useGlobal ?? true,
      settings: settings || checkinSettings.settings,
      workerSettings: workerSettings || null,
    };
    
    console.log('[TrelloWebhook] Check-in settings updated:', checkinSettings);
    
    res.json({
      success: true,
      message: 'Check-in settings saved',
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error saving checkin settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/trello-webhook/compliance
 * Get compliance metrics for all workers
 */
router.get('/compliance', async (req, res) => {
  try {
    const { getAllWorkerComplianceSummaries, getDailyComplianceStats } = await import('../services/compliance-tracking');
    
    const summaries = await getAllWorkerComplianceSummaries();
    const dailyStats = getDailyComplianceStats();
    
    res.json({
      success: true,
      workers: summaries,
      daily: dailyStats,
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error getting compliance metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/trello-webhook/compliance/:vaId
 * Get compliance metrics for a specific worker
 */
router.get('/compliance/:vaId', async (req, res) => {
  try {
    const vaId = parseInt(req.params.vaId);
    
    if (isNaN(vaId)) {
      return res.status(400).json({ error: 'Invalid vaId' });
    }
    
    const { getWorkerComplianceSummary, getRecentComplianceEvents } = await import('../services/compliance-tracking');
    
    const summary = await getWorkerComplianceSummary(vaId);
    const recentEvents = getRecentComplianceEvents(vaId, 20);
    
    if (!summary) {
      return res.json({
        success: true,
        summary: null,
        events: [],
        message: 'No compliance data found for this worker',
      });
    }
    
    res.json({
      success: true,
      summary,
      events: recentEvents,
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error getting worker compliance:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/trello-webhook/ai-settings
 * Get AI provider settings
 */
router.get('/ai-settings', async (req, res) => {
  try {
    const { getAIConfig } = await import('../services/ai-service');
    const config = getAIConfig();
    
    const { getAvailableModels } = await import('../services/ai-service');
    
    res.json({
      success: true,
      config: {
        provider: config.provider,
        model: config.model,
        groqApiKey: config.groqApiKey ? '***configured***' : null,
        togetherApiKey: config.togetherApiKey ? '***configured***' : null,
        openrouterApiKey: config.openrouterApiKey ? '***configured***' : null,
        ollamaUrl: config.ollamaUrl,
      },
      availableModels: getAvailableModels(config.provider),
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error getting AI settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trello-webhook/ai-settings
 * Update AI provider settings
 */
router.post('/ai-settings', async (req, res) => {
  try {
    const { provider, model, groqApiKey, togetherApiKey, openrouterApiKey, ollamaUrl } = req.body;
    
    const { setAIConfig } = await import('../services/ai-service');
    
    setAIConfig({
      provider,
      model,
      groqApiKey,
      togetherApiKey,
      openrouterApiKey,
      ollamaUrl,
    });
    
    res.json({
      success: true,
      message: 'AI settings updated',
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error updating AI settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trello-webhook/test-ai
 * Test AI connection and response
 */
router.post('/test-ai', async (req, res) => {
  try {
    const { generateAIResponse } = await import('../services/ai-service');
    
    const testPrompt = 'Say "Hello! AI is working correctly." in exactly those words.';
    const response = await generateAIResponse(testPrompt, 'Test context');
    
    res.json({
      success: true,
      response,
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error testing AI:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      hint: 'Check your AI provider settings and API key',
    });
  }
});

export default router;
